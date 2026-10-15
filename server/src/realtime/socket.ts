/**
 * Real-time updates over Socket.IO (path /socket.io). The database is the source of truth:
 * services emit only AFTER a change is saved, and clients re-fetch on (re)connect, so a missed
 * event never loses data.
 *
 *   /staff  — staff sign in with their access token; must have ENQUIRIES:VIEW. They join
 *             "staff:all" (property-wide roles) or "staff:<propertyId>" rooms.
 *   /guest  — a website guest joins only their own conversation, proven by its secret token.
 */
import type { Server as HttpServer } from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { getJwtSecret } from "../config/jwt";
import { logger } from "../services/logger.service";

let io: Server | null = null;

export function getIO() {
  return io;
}

export const hashChatToken = (token: string) => crypto.createHash("sha256").update(String(token)).digest("hex");

/** Attaches Socket.IO to an HTTP server once (production server, Vite dev server, tests). */
export function attachRealtime(httpServer: HttpServer) {
  if ((httpServer as any).__yesRealtime) return (httpServer as any).__yesRealtime as Server;
  const server = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL] : true, credentials: true },
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
  });

  // ── guest
  const guest = server.of("/guest");
  guest.use(async (socket, next) => {
    try {
      const conversationId = String(socket.handshake.auth?.conversationId || "");
      const token = String(socket.handshake.auth?.token || "");
      if (!/^[a-f0-9]{24}$/i.test(conversationId) || token.length < 20) return next(new Error("unauthorized"));
      const { ChatConversation } = await import("../models/ChatConversation");
      const conv = await ChatConversation.findById(conversationId).select("+guestTokenHash").lean();
      if (!conv || conv.guestTokenHash !== hashChatToken(token)) return next(new Error("unauthorized"));
      socket.data.conversationId = conversationId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  guest.on("connection", (socket) => {
    socket.join(`conv:${socket.data.conversationId}`);
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
