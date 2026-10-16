/**
 * Live presence over Socket.IO: a guest opening the chat shows "online" to Reception (event +
 * GET /presence), their step and what they type arrive live, Reception's typing reaches the guest,
 * and closing the chat goes "offline". Housekeeping can't see presence; an empty chat stays out of
 * the inbox until the guest is online or writes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { io as connect, type Socket } from "socket.io-client";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { attachRealtime } from "../realtime/socket";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const users = { reception: oid(), housekeeping: oid() };
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = (who: keyof typeof users) => jwt.sign({ id: String(users[who]), role: who === "reception" ? "RECEPTIONIST" : "HOUSEKEEPING" }, getJwtSecret(), { expiresIn: "5m" });
let conversationId = "";
let guestToken = "";
let staffSocket: Socket;
let guestSocket: Socket;
const staffEvents: any[] = [];
const guestEvents: any[] = [];

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const waitFor = async (pred: () => boolean, ms = 4000) => {
  const t = Date.now();
  while (!pred()) {
    if (Date.now() - t > ms) throw new Error("timed out waiting for live event");
    await new Promise((r) => setTimeout(r, 25));
  }
};
const connectSocket = (ns: string, auth: Record<string, string>) =>
  new Promise<Socket>((resolve, reject) => {
    const s = connect(base + ns, { path: "/socket.io", auth, transports: ["websocket"], reconnection: false, forceNew: true });
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => { s.close(); reject(e); });
  });
const staffGet = (path: string, who: keyof typeof users = "reception") => call("GET", path, undefined, { Authorization: `Bearer ${tok(who)}` });

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  attachRealtime(server);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  const u = (_id: mongoose.Types.ObjectId, role: string) => ({ _id, role, firstName: "Presence", lastName: role, email: `presence-${role.toLowerCase()}-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("users").insertMany([u(users.reception, "RECEPTIONIST"), u(users.housekeeping, "HOUSEKEEPING")]);
  staffSocket = await connectSocket("/staff", { token: tok("reception") });
  staffSocket.onAny((event, payload) => staffEvents.push({ event, payload }));
});

afterAll(async () => {
  staffSocket?.close();
  guestSocket?.close();
  if (conversationId) {
    await db().collection("chatmessages").deleteMany({ conversation: new mongoose.Types.ObjectId(conversationId) });
    await db().collection("chatconversations").deleteMany({ _id: new mongoose.Types.ObjectId(conversationId) });
  }
  await db().collection("users").deleteMany({ _id: { $in: Object.values(users) } });
  await new Promise((r) => server.close(r));
});

describe("Live chat presence", () => {
  it("an opened-but-empty chat is not in the inbox until the guest is online", async () => {
    const r = await call("POST", "/api/chat/conversations", { pageUrl: "/" });
    expect(r.status).toBe(201);
    conversationId = r.json.data.conversation._id;
    guestToken = r.json.data.token;
    const list = await staffGet("/api/chat/staff/conversations?status=ALL");
    expect(list.json.data.some((c: any) => c._id === conversationId)).toBe(false);
  });

  it("opening the chat shows the guest online to Reception", async () => {
    guestSocket = await connectSocket("/guest", { conversationId, token: guestToken, page: "/rooms" });
    guestSocket.onAny((event, payload) => guestEvents.push({ event, payload }));
    await waitFor(() => staffEvents.some((e) => e.event === "chat:presence" && e.payload.conversationId === conversationId && e.payload.online));
    const presence = await staffGet("/api/chat/staff/presence");
    expect(presence.status).toBe(200);
    const me = presence.json.data.find((p: any) => p.conversationId === conversationId);
    expect(me?.page).toBe("/rooms");
    const list = await staffGet("/api/chat/staff/conversations?status=OPEN");
    expect(list.json.data.some((c: any) => c._id === conversationId)).toBe(true);
    const counts = await staffGet("/api/chat/staff/counts");
    expect(counts.json.data.online).toBeGreaterThanOrEqual(1);
  });

  it("Reception sees the step and what the guest is typing, live", async () => {
    guestSocket.emit("guest:activity", { step: "Entering email", field: "Entering email", text: `asha.${tag}@exa` });
    await waitFor(() => staffEvents.some((e) => e.event === "chat:activity" && e.payload.conversationId === conversationId && e.payload.text === `asha.${tag}@exa`));
    const ev = staffEvents.filter((e) => e.event === "chat:activity").pop();
    expect(ev.payload.step).toBe("Entering email");
    const presence = await staffGet("/api/chat/staff/presence");
    expect(presence.json.data.find((p: any) => p.conversationId === conversationId)?.text).toBe(`asha.${tag}@exa`);
  });

  it("Reception typing a reply shows 'Reception is typing' to that guest", async () => {
    staffSocket.emit("staff:typing", { conversationId, typing: true });
    await waitFor(() => guestEvents.some((e) => e.event === "chat:staff-typing" && e.payload.typing === true));
  });

  it("Housekeeping can't see who is online", async () => {
    expect((await staffGet("/api/chat/staff/presence", "housekeeping")).status).toBe(403);
  });

  it("closing the chat goes offline", async () => {
    guestSocket.close();
    await waitFor(() => staffEvents.some((e) => e.event === "chat:presence" && e.payload.conversationId === conversationId && e.payload.online === false));
    const presence = await staffGet("/api/chat/staff/presence");
    expect(presence.json.data.some((p: any) => p.conversationId === conversationId)).toBe(false);
  });
});
