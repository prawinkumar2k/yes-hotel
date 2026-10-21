/**
 * Website chat.
 *
 * Guest (no login; the conversation's secret token in the X-Chat-Token header):
 *   POST /api/chat/conversations                 start → { conversation, token }
 *   GET  /api/chat/conversations/:id             conversation + messages (?after=ISO for catch-up)
 *   POST /api/chat/conversations/:id/messages    { text, clientMessageId, sender: GUEST|BOT }
 *   POST /api/chat/conversations/:id/request-staff
 *   POST /api/chat/conversations/:id/details     { name, phone, email }
 *   POST /api/chat/conversations/:id/read
 *
 * Staff (ENQUIRIES permission; Admin, Manager and Reception):
 *   GET  /api/chat/staff/conversations?status=&search=   GET /api/chat/staff/counts
 *   GET  /api/chat/staff/presence                         guests with the chat open right now
 *   GET  /api/chat/staff/conversations/:id                (marks read)
 *   POST /api/chat/staff/conversations/:id/reply          { text, clientMessageId }
 *   POST /api/chat/staff/conversations/:id/assign | resolve | reopen
 */
import { Router, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { protect } from "../middleware/auth.middleware";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { ChatConversation, ChatStatus } from "../models/ChatConversation";
import { ChatMessage, ChatSender } from "../models/ChatMessage";
import { getJwtSecret } from "../config/jwt";
import { createAuditLog } from "../services/audit.service";
import {
  ChatRuleError, addMessage, assertGuestToken, conversationView, markRead, messageView, requestStaff, setStatus, startConversation, sweepAbandoned,
} from "../services/chat.service";
import { onlineGuests } from "../realtime/socket";
import "../models/User";

const fail = (res: Response, e: any) =>
  e instanceof ChatRuleError ? res.status(e.status).json({ success: false, message: e.message }) : res.status(500).json({ success: false, message: e.message });

// Guests share no login, so limit chat traffic per IP generously (a busy conversation is still fine).
// Counted per conversation (its chat token), not per IP: many guests share one mobile-network or hotel Wi-Fi
// address, and each line of the conversation (guest + bot) is one request.
const guestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CHAT_MAX) || (process.env.NODE_ENV === "production" ? 120 : 1000),
  keyGenerator: (req) => {
    const t = String(req.headers["x-chat-token"] || "").slice(0, 80);
    return t ? `chat:${t}` : ipKeyGenerator(req.ip || "");
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "You're sending messages too fast. Please wait a moment." },
});

const guestRouter = Router();
guestRouter.use(guestLimiter);

const guestSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.literal(""), z.string().trim().email().max(160)]).optional(),
});

/** A signed-in guest (optional) is attached to the conversation. */
function optionalCustomerId(req: Request): string | undefined {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return undefined;
  try {
    const d: any = jwt.verify(h.slice(7), getJwtSecret());
    return d?.role === "CUSTOMER" ? String(d.id) : undefined;
  } catch {
    return undefined;
  }
}

guestRouter.post("/conversations", async (req, res) => {
  try {
    const parsed = guestSchema.safeParse(req.body?.guest ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Check the name, phone or email" });
    const pageUrl = typeof req.body?.pageUrl === "string" ? req.body.pageUrl.slice(0, 300) : undefined;
    const { conversation, token } = await startConversation({ guest: { ...parsed.data, email: parsed.data.email || undefined }, customerId: optionalCustomerId(req), pageUrl });
    return res.status(201).json({ success: true, data: { conversation: conversationView(conversation), token } });
  } catch (e) {
    return fail(res, e);
  }
});

const tokenOf = (req: Request) => String(req.headers["x-chat-token"] || "");

guestRouter.get("/conversations/:id", async (req, res) => {
  try {
    const conv = await assertGuestToken(String(req.params.id), tokenOf(req));
    const after = req.query.after ? new Date(String(req.query.after)) : null;
    const filter: Record<string, unknown> = { conversation: conv._id };
    if (after && !isNaN(after.getTime())) filter.createdAt = { $gt: after };
    const messages = await ChatMessage.find(filter).sort({ createdAt: 1 }).limit(500).lean();
    return res.json({ success: true, data: { conversation: conversationView(conv), messages: messages.map(messageView) } });
  } catch (e) {
    return fail(res, e);
  }
});

const messageSchema = z.object({
  text: z.string().trim().min(1, "Message is empty").max(2000),
  clientMessageId: z.string().trim().min(1).max(80),
  sender: z.enum(["GUEST", "BOT"]).default("GUEST"),
});

guestRouter.post("/conversations/:id/messages", async (req, res) => {
  try {
    const conv = await assertGuestToken(String(req.params.id), tokenOf(req));
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid message" });
    const out = await addMessage({ conversationId: String(conv._id), sender: parsed.data.sender as ChatSender, text: parsed.data.text, clientMessageId: parsed.data.clientMessageId });
    return res.status(out.duplicate ? 200 : 201).json({ success: true, data: out });
  } catch (e) {
    return fail(res, e);
  }
});

guestRouter.post("/conversations/:id/request-staff", async (req, res) => {
  try {
    const conv = await assertGuestToken(String(req.params.id), tokenOf(req));
    return res.json({ success: true, data: await requestStaff(String(conv._id)) });
  } catch (e) {
    return fail(res, e);
  }
});

guestRouter.post("/conversations/:id/details", async (req, res) => {
  try {
    const conv = await assertGuestToken(String(req.params.id), tokenOf(req));
    const parsed = guestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Check the name, phone or email" });
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) if (v) set[`guest.${k}`] = v;
    const updated = await ChatConversation.findByIdAndUpdate(conv._id, { $set: set }, { returnDocument: "after" }).lean();
    const view = conversationView(updated);
    const { emitToStaff } = await import("../realtime/socket");
    emitToStaff("chat:conversation", view, updated?.propertyId);
    return res.json({ success: true, data: view });
  } catch (e) {
    return fail(res, e);
  }
});

guestRouter.post("/conversations/:id/read", async (req, res) => {
  try {
    const conv = await assertGuestToken(String(req.params.id), tokenOf(req));
    return res.json({ success: true, data: await markRead(String(conv._id), "GUEST") });
  } catch (e) {
    return fail(res, e);
  }
});

// ─────────────────────────────────────────────── staff
const staffRouter = Router();
staffRouter.use(protect, requirePropertyAccess);

const scopeOf = (req: Request) =>
  (req as any).propertyId ? { $or: [{ propertyId: (req as any).propertyId }, { propertyId: { $exists: false } }] } : {};

/** A chat only appears in the inbox once the guest wrote, left contact details, or while they are online. */
const hasSomethingFilter = (onlineIds: string[]) => ({
  $or: [
    { lastGuestMessageAt: { $exists: true } },
    { "guest.phone": { $nin: [null, ""] } },
    { "guest.email": { $nin: [null, ""] } },
    { "guest.name": { $nin: [null, ""] } },
    ...(onlineIds.length ? [{ _id: { $in: onlineIds.map((id) => new mongoose.Types.ObjectId(id)) } }] : []),
  ],
});

async function staffConversation(req: Request) {
  const id = String(req.params.id);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new ChatRuleError("Conversation not found", 404);
  const conv = await ChatConversation.findOne({ _id: id, ...scopeOf(req) }).lean();
  if (!conv) throw new ChatRuleError("Conversation not found", 404);
  return conv;
}

staffRouter.get("/conversations", requirePermission("ENQUIRIES", "VIEW"), async (req, res) => {
  try {
    await sweepAbandoned();
    const status = String(req.query.status ?? "OPEN");
    const filter: Record<string, any> = { ...scopeOf(req) };
    if (status === "OPEN") filter.status = { $in: [ChatStatus.WAITING, ChatStatus.ASSIGNED, ChatStatus.BOT] };
    else if (status !== "ALL") filter.status = status;
    const search = String(req.query.search ?? "").trim();
    filter.$and = [hasSomethingFilter(onlineGuests().map((g) => g.conversationId))];
    if (search) {
      const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$and.push({ $or: [{ "guest.name": rx }, { "guest.phone": rx }, { "guest.email": rx }, { lastMessagePreview: rx }] });
    }
    const rows = await ChatConversation.find(filter).sort({ lastMessageAt: -1 }).limit(200).populate("assignedTo", "firstName lastName").lean();
    return res.json({ success: true, data: rows.map((c) => ({ ...conversationView(c), assignedTo: c.assignedTo ?? null })) });
  } catch (e) {
    return fail(res, e);
  }
});

staffRouter.get("/counts", requirePermission("ENQUIRIES", "VIEW"), async (req, res) => {
  try {
    const scope = scopeOf(req);
    const [waiting, unread] = await Promise.all([
      ChatConversation.countDocuments({ ...scope, status: ChatStatus.WAITING }),
      ChatConversation.aggregate([{ $match: { ...(scope as any), status: { $nin: [ChatStatus.RESOLVED] } } }, { $group: { _id: null, n: { $sum: "$unreadForStaff" } } }]),
    ]);
    const online = (await onlineInScope(req)).length;
    return res.json({ success: true, data: { waiting, unread: unread[0]?.n ?? 0, online } });
  } catch (e) {
    return fail(res, e);
  }
});

/** Online guests this staff member may see, with their conversation. */
async function onlineInScope(req: Request) {
  const live = onlineGuests();
  if (!live.length) return [];
  const convs = await ChatConversation.find({ _id: { $in: live.map((g) => g.conversationId) }, ...scopeOf(req) }).lean();
  const byId = new Map(convs.map((c) => [String(c._id), c]));
  return live.filter((g) => byId.has(g.conversationId)).map((g) => ({ ...g, conversation: conversationView(byId.get(g.conversationId)) }));
}

staffRouter.get("/presence", requirePermission("ENQUIRIES", "VIEW"), async (req, res) => {
  try {
    return res.json({ success: true, data: await onlineInScope(req) });
  } catch (e) {
    return fail(res, e);
  }
});

staffRouter.get("/conversations/:id", requirePermission("ENQUIRIES", "VIEW"), async (req, res) => {
  try {
    const conv = await staffConversation(req);
    const messages = await ChatMessage.find({ conversation: conv._id }).sort({ createdAt: 1 }).limit(1000).populate("staff", "firstName lastName").lean();
    const view = await markRead(String(conv._id), "STAFF");
    return res.json({ success: true, data: { conversation: view, messages: messages.map((m) => ({ ...messageView(m), staff: m.staff ?? null })) } });
  } catch (e) {
    return fail(res, e);
  }
});

const replySchema = z.object({ text: z.string().trim().min(1, "Message is empty").max(2000), clientMessageId: z.string().trim().min(1).max(80) });

staffRouter.post("/conversations/:id/reply", requirePermission("ENQUIRIES", "EDIT"), async (req, res) => {
  try {
    const conv = await staffConversation(req);
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid reply" });
    const out = await addMessage({ conversationId: String(conv._id), sender: ChatSender.STAFF, text: parsed.data.text, clientMessageId: parsed.data.clientMessageId, staffId: (req as any).user.id });
    if (!out.duplicate) await createAuditLog({ req, action: "chat.staff_reply", resourceType: "ChatConversation", resourceId: String(conv._id) });
    return res.status(out.duplicate ? 200 : 201).json({ success: true, data: out });
  } catch (e) {
    return fail(res, e);
  }
});

for (const [action, status] of [["assign", ChatStatus.ASSIGNED], ["resolve", ChatStatus.RESOLVED], ["reopen", ChatStatus.WAITING]] as const) {
  staffRouter.post(`/conversations/:id/${action}`, requirePermission("ENQUIRIES", "EDIT"), async (req, res) => {
    try {
      const conv = await staffConversation(req);
      const view = await setStatus(String(conv._id), status, (req as any).user.id);
      await createAuditLog({ req, action: `chat.${action}`, resourceType: "ChatConversation", resourceId: String(conv._id) });
      return res.json({ success: true, data: view });
    } catch (e) {
      return fail(res, e);
    }
  });
}

const router = Router();
router.use("/staff", staffRouter);
router.use("/", guestRouter);
export default router;
