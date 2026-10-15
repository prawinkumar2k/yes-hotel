/**
 * Live chat over HTTP + Socket.IO:
 *   guest starts a chat → Reception's live connection gets the new conversation and each message;
 *   guest asks for a person → WAITING; Reception replies → the guest's live connection gets it and
 *   the chat is ASSIGNED; a resent message is stored once; history survives a reload (GET);
 *   unread counts; resolve; Housekeeping and a wrong guest token are refused.
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
let P: mongoose.Types.ObjectId;
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

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  attachRealtime(server);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  const u = (_id: mongoose.Types.ObjectId, role: string) => ({ _id, role, firstName: "Chat", lastName: role, email: `chat-${role.toLowerCase()}-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
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

describe("Live chat", () => {
  it("a new chat appears live for Reception", async () => {
    const r = await call("POST", "/api/chat/conversations", { guest: { name: `Guest ${tag}` }, pageUrl: "/rooms" });
    expect(r.status).toBe(201);
    conversationId = r.json.data.conversation._id;
    guestToken = r.json.data.token;
    expect(r.json.data.conversation.status).toBe("BOT");
    await waitFor(() => staffEvents.some((e) => e.event === "chat:conversation" && e.payload._id === conversationId));
    guestSocket = await connectSocket("/guest", { conversationId, token: guestToken });
    guestSocket.onAny((event, payload) => guestEvents.push({ event, payload }));
  });

  it("guest messages reach Reception live, are stored once and survive a reload", async () => {
    const H = { "X-Chat-Token": guestToken };
    const first = await call("POST", `/api/chat/conversations/${conversationId}/messages`, { text: "Hi, is parking free?", clientMessageId: `g1-${tag}` }, H);
    expect(first.status).toBe(201);
    await waitFor(() => staffEvents.some((e) => e.event === "chat:message" && e.payload.message.text === "Hi, is parking free?"));
    const again = await call("POST", `/api/chat/conversations/${conversationId}/messages`, { text: "Hi, is parking free?", clientMessageId: `g1-${tag}` }, H);
    expect(again.status).toBe(200);
    expect(again.json.data.duplicate).toBe(true);
    await call("POST", `/api/chat/conversations/${conversationId}/messages`, { text: "Yes, parking is free.", clientMessageId: `b1-${tag}`, sender: "BOT" }, H);
    const reload = await call("GET", `/api/chat/conversations/${conversationId}`, undefined, H);
    expect(reload.json.data.messages.map((m: any) => m.sender)).toEqual(["GUEST", "BOT"]);
    expect(await db().collection("chatmessages").countDocuments({ conversation: new mongoose.Types.ObjectId(conversationId) })).toBe(2);
  });

  it("asking for a person makes it WAITING with an unread count for staff", async () => {
    const r = await call("POST", `/api/chat/conversations/${conversationId}/request-staff`, {}, { "X-Chat-Token": guestToken });
    expect(r.json.data.status).toBe("WAITING");
    const counts = await call("GET", "/api/chat/staff/counts", undefined, { Authorization: `Bearer ${tok("reception")}` });
    expect(counts.json.data.waiting).toBeGreaterThanOrEqual(1);
    expect(counts.json.data.unread).toBeGreaterThanOrEqual(1);
  });

  it("Reception's reply reaches the guest live and assigns the chat", async () => {
    const A = { Authorization: `Bearer ${tok("reception")}` };
    const open = await call("GET", `/api/chat/staff/conversations/${conversationId}`, undefined, A);
    expect(open.status).toBe(200);
    expect(open.json.data.conversation.unreadForStaff).toBe(0);
    const reply = await call("POST", `/api/chat/staff/conversations/${conversationId}/reply`, { text: "Yes — free on-site parking.", clientMessageId: `s1-${tag}` }, A);
    expect(reply.status).toBe(201);
    await waitFor(() => guestEvents.some((e) => e.event === "chat:message" && e.payload.message.sender === "STAFF"));
    const list = await call("GET", "/api/chat/staff/conversations?status=OPEN", undefined, A);
    const row = list.json.data.find((c: any) => c._id === conversationId);
    expect(row.status).toBe("ASSIGNED");
    const resolved = await call("POST", `/api/chat/staff/conversations/${conversationId}/resolve`, {}, A);
    expect(resolved.json.data.status).toBe("RESOLVED");
    await waitFor(() => guestEvents.some((e) => e.event === "chat:status" && e.payload.status === "RESOLVED"));
  });

  it("refuses Housekeeping and a wrong guest token", async () => {
    expect((await call("GET", "/api/chat/staff/conversations", undefined, { Authorization: `Bearer ${tok("housekeeping")}` })).status).toBe(403);
    await expect(connectSocket("/staff", { token: tok("housekeeping") })).rejects.toBeTruthy();
    await expect(connectSocket("/guest", { conversationId, token: "x".repeat(32) })).rejects.toBeTruthy();
    expect((await call("GET", `/api/chat/conversations/${conversationId}`, undefined, { "X-Chat-Token": "wrong-token-wrong-token" })).status).toBe(404);
  });
});
