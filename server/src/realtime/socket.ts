/**
 * Real-time updates over Socket.IO (path /socket.io). The database is the source of truth:
 * services emit only AFTER a change is saved, and clients re-fetch on (re)connect, so a missed
 * event never loses data.
 *
 *   /staff  — staff sign in with their access token; must have ENQUIRIES:VIEW. They join
 *             "staff:all" (property-wide roles) or "staff:<propertyId>" rooms.
 *   /guest  — a website guest joins only their own conversation, proven by its secret token.
 *
 * Live presence (memory only, never stored): while a guest has the chat open, staff see them
 * "online", which step of the chatbot they are on and what they are typing ("chat:presence",
 * "chat:activity"). Staff typing a reply shows "Reception is typing…" to that guest.
 */
import type { Server as HttpServer } from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { getJwtSecret } from "../config/jwt";
import { allowedOrigins } from "../config/origins";
import { logger } from "../services/logger.service";

let io: Server | null = null;

export function getIO() {
  return io;
}

export type GuestPresence = { conversationId: string; propertyId?: string; since: string; page?: string; step?: string; field?: string; text?: string; at?: string };
const presence = new Map<string, GuestPresence & { sockets: number }>();

/** Guests who have the chat open right now. */
export function onlineGuests(): GuestPresence[] {
  return [...presence.values()].map(({ sockets: _s, ...p }) => p);
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

export const hashChatToken = (token: string) => crypto.createHash("sha256").update(String(token)).digest("hex");

/** Attaches Socket.IO to an HTTP server once (production server, Vite dev server, tests). */
export function attachRealtime(httpServer: HttpServer) {
  if ((httpServer as any).__yesRealtime) return (httpServer as any).__yesRealtime as Server;
  const server = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: process.env.CLIENT_URL ? allowedOrigins() : true, credentials: true },
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  // ── staff
  const staff = server.of("/staff");
  staff.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || "");
      const decoded: any = jwt.verify(token, getJwtSecret());
      if (!decoded?.id || decoded.role === "CUSTOMER") return next(new Error("forbidden"));
      const { PermissionService } = await import("../services/PermissionService");
      if (!(await PermissionService.can({ id: decoded.id, role: decoded.role }, "ENQUIRIES", "VIEW"))) return next(new Error("forbidden"));
      const { User } = await import("../models/User");
      const u: any = await User.findById(decoded.id).select("isActive propertyId propertyIds").lean();
      if (!u || u.isActive === false) return next(new Error("forbidden"));
      socket.data.user = { id: String(decoded.id), role: decoded.role };
      const systemRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"];
      socket.data.rooms = systemRoles.includes(decoded.role)
        ? ["staff:all"]
        : [...new Set([u.propertyId, ...(u.propertyIds || [])].filter(Boolean).map((p: any) => `staff:${p}`))];
      if (!socket.data.rooms.length) socket.data.rooms = ["staff:unassigned"];
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  staff.on("connection", (socket) => {
    for (const r of socket.data.rooms) socket.join(r);
    // A staff member typing a reply → "Reception is typing…" for that guest (only for chats they may see).
    socket.on("staff:typing", async (p: { conversationId?: string; typing?: boolean }) => {
      try {
        const id = String(p?.conversationId ?? "");
        if (!/^[a-f0-9]{24}$/i.test(id)) return;
        const rooms: string[] = socket.data.rooms;
        if (!rooms.includes("staff:all")) {
          const { ChatConversation } = await import("../models/ChatConversation");
          const conv = await ChatConversation.findById(id).select("propertyId").lean();
          if (!conv || !rooms.includes(conv.propertyId ? `staff:${conv.propertyId}` : "staff:unassigned")) return;
        }
        emitToGuest(id, "chat:staff-typing", { typing: Boolean(p?.typing) });
      } catch { /* typing hints are best-effort */ }
    });
  });

  // ── guest
  const guest = server.of("/guest");
  guest.use(async (socket, next) => {
    try {
      const conversationId = String(socket.handshake.auth?.conversationId || "");
      const token = String(socket.handshake.auth?.token || "");
      if (!/^[a-f0-9]{24}$/i.test(conversationId) || token.length < 20) return next(new Error("unauthorized"));
      const { ChatConversation } = await import("../models/ChatConversation");
      const conv = await ChatConversation.findById(conversationId).select("+guestTokenHash propertyId").lean();
      if (!conv || conv.guestTokenHash !== hashChatToken(token)) return next(new Error("unauthorized"));
      socket.data.conversationId = conversationId;
      socket.data.propertyId = conv.propertyId ? String(conv.propertyId) : undefined;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  guest.on("connection", (socket) => {
    const id: string = socket.data.conversationId;
    const propertyId: string | undefined = socket.data.propertyId;
    socket.join(`conv:${id}`);

    const entry = presence.get(id) ?? { conversationId: id, propertyId, since: new Date().toISOString(), sockets: 0 };
    entry.sockets += 1;
    entry.page = clip(socket.handshake.auth?.page, 200) ?? entry.page;
    presence.set(id, entry);
    if (entry.sockets === 1) emitToStaff("chat:presence", { conversationId: id, online: true, since: entry.since, page: entry.page }, propertyId);

    // What the guest is doing in the chat window: step, the field they are in and its current text.
    let windowStart = Date.now();
    let inWindow = 0;
    socket.on("guest:activity", (p: { step?: string; field?: string; text?: string; page?: string }) => {
      const now = Date.now();
      if (now - windowStart > 1000) { windowStart = now; inWindow = 0; }
      if (++inWindow > 15) return; // the client sends at most a few per second
      const cur = presence.get(id);
      if (!cur) return;
      if (p?.step !== undefined) cur.step = clip(p.step, 40);
      if (p?.field !== undefined) cur.field = clip(p.field, 60);
      if (p?.text !== undefined) cur.text = clip(p.text, 500);
      if (p?.page !== undefined) cur.page = clip(p.page, 200);
      cur.at = new Date(now).toISOString();
      emitToStaff("chat:activity", { conversationId: id, step: cur.step, field: cur.field, text: cur.text, page: cur.page, at: cur.at }, propertyId);
    });

    socket.on("disconnect", () => {
      const cur = presence.get(id);
      if (!cur) return;
      cur.sockets -= 1;
      if (cur.sockets > 0) return;
      presence.delete(id);
      emitToStaff("chat:presence", { conversationId: id, online: false }, propertyId);
    });
  });

  io = server;
  (httpServer as any).__yesRealtime = server;
  logger.info("realtime_attached", { path: "/socket.io" });
  return server;
}

/** Tells permitted staff about a saved change. */
export function emitToStaff(event: string, payload: unknown, propertyId?: unknown) {
  if (!io) return;
  const ns = io.of("/staff");
  ns.to("staff:all").emit(event, payload);
  if (propertyId) ns.to(`staff:${propertyId}`).emit(event, payload);
  else ns.to("staff:unassigned").emit(event, payload);
}

/** Tells the guest of one conversation about a saved change. */
export function emitToGuest(conversationId: string, event: string, payload: unknown) {
  io?.of("/guest").to(`conv:${conversationId}`).emit(event, payload);
}
