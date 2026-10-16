/**
 * Website chat: saved first, then broadcast (realtime/socket.ts). Sending is idempotent per
 * clientMessageId, so retries and reconnect re-sends are stored once.
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import { ChatConversation, ChatStatus } from "../models/ChatConversation";
import { ChatMessage, ChatSender } from "../models/ChatMessage";
import { emitToGuest, emitToStaff, hashChatToken } from "../realtime/socket";

export class ChatRuleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/** The public view of a conversation (never the token hash). */
export function conversationView(c: any) {
  return {
    _id: String(c._id),
    status: c.status,
    guest: c.guest ?? {},
    assignedTo: c.assignedTo ?? null,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview ?? "",
    unreadForStaff: c.unreadForStaff ?? 0,
    unreadForGuest: c.unreadForGuest ?? 0,
    propertyId: c.propertyId ? String(c.propertyId) : null,
    createdAt: c.createdAt,
  };
}
export const messageView = (m: any) => ({
  _id: String(m._id),
  conversation: String(m.conversation),
  sender: m.sender,
  staff: m.staff ?? null,
  text: m.text,
  clientMessageId: m.clientMessageId,
  createdAt: m.createdAt,
});

export async function startConversation(p: { guest?: { name?: string; phone?: string; email?: string }; customerId?: string; pageUrl?: string }) {
  const token = crypto.randomBytes(24).toString("base64url");
  const { Property } = await import("../models/Property");
  const property = await Property.findOne({ isActive: { $ne: false } }).select("_id").lean();
  const conv = await ChatConversation.create({
    propertyId: property?._id,
    guestTokenHash: hashChatToken(token),
    guest: p.guest ?? {},
    customer: p.customerId,
    pageUrl: p.pageUrl,
    lastMessageAt: new Date(),
  });
  emitToStaff("chat:conversation", conversationView(conv), conv.propertyId);
  return { conversation: conv, token };
}

/** Throws unless the token belongs to the conversation. */
export async function assertGuestToken(conversationId: string, token: string) {
  if (!/^[a-f0-9]{24}$/i.test(conversationId)) throw new ChatRuleError("Conversation not found", 404);
  const conv = await ChatConversation.findById(conversationId).select("+guestTokenHash");
  if (!conv || !token || conv.guestTokenHash !== hashChatToken(token)) throw new ChatRuleError("Conversation not found", 404);
  return conv;
}

/**
 * Saves a message once and updates the conversation:
 *   GUEST → staff unread +1; reopens RESOLVED/ABANDONED as WAITING (or stays BOT if never escalated).
 *   STAFF → guest unread +1; status ASSIGNED to that staff member.
 */
export async function addMessage(p: { conversationId: string; sender: ChatSender; text: string; clientMessageId: string; staffId?: string }) {
  const text = String(p.text ?? "").trim();
  if (!text) throw new ChatRuleError("Message is empty");
  if (text.length > 2000) throw new ChatRuleError("Message is too long (2,000 characters max)");
  const clientMessageId = String(p.clientMessageId ?? "").slice(0, 80);
  if (!clientMessageId) throw new ChatRuleError("clientMessageId is required");

  let message: any;
  try {
    message = await ChatMessage.create({ conversation: p.conversationId, sender: p.sender, staff: p.staffId, text, clientMessageId });
  } catch (e: any) {
    if (e?.code === 11000) {
      // Already stored (retry / reconnect) — return the original, broadcast nothing new.
      const existing = await ChatMessage.findOne({ conversation: p.conversationId, clientMessageId }).lean();
      const conv = await ChatConversation.findById(p.conversationId).lean();
      return { message: messageView(existing), conversation: conversationView(conv), duplicate: true };
    }
    throw e;
  }

  const now = new Date();
  const set: Record<string, unknown> = { lastMessageAt: now, lastMessagePreview: text.slice(0, 200) };
  const inc: Record<string, number> = {};
  const current = await ChatConversation.findById(p.conversationId).select("status").lean();
  if (p.sender === ChatSender.GUEST) {
    inc.unreadForStaff = 1;
    set.lastGuestMessageAt = now;
    if (current && [ChatStatus.RESOLVED, ChatStatus.ABANDONED].includes(current.status)) set.status = ChatStatus.WAITING;
  } else if (p.sender === ChatSender.STAFF) {
    inc.unreadForGuest = 1;
    set.status = ChatStatus.ASSIGNED;
    set.assignedTo = new mongoose.Types.ObjectId(p.staffId);
  }
  const conv = await ChatConversation.findByIdAndUpdate(p.conversationId, { $set: set, ...(Object.keys(inc).length ? { $inc: inc } : {}) }, { returnDocument: "after" }).lean();
  const mv = messageView(message);
  const cv = conversationView(conv);
  emitToStaff("chat:message", { conversation: cv, message: mv }, conv?.propertyId);
  emitToGuest(p.conversationId, "chat:message", { message: mv, status: cv.status });
  return { message: mv, conversation: cv, duplicate: false };
}

export async function setStatus(conversationId: string, status: ChatStatus, staffId?: string) {
  const set: Record<string, unknown> = { status };
  if (status === ChatStatus.ASSIGNED && staffId) set.assignedTo = new mongoose.Types.ObjectId(staffId);
  if (status === ChatStatus.RESOLVED) { set.resolvedAt = new Date(); if (staffId) set.resolvedBy = new mongoose.Types.ObjectId(staffId); }
  const conv = await ChatConversation.findByIdAndUpdate(conversationId, { $set: set }, { returnDocument: "after" }).lean();
  if (!conv) throw new ChatRuleError("Conversation not found", 404);
  const cv = conversationView(conv);
  emitToStaff("chat:conversation", cv, conv.propertyId);
  emitToGuest(conversationId, "chat:status", { status: cv.status });
  return cv;
}

/** Guest asks for a person: BOT/RESOLVED/ABANDONED → WAITING (ASSIGNED stays with its staff member). */
export async function requestStaff(conversationId: string) {
  const conv = await ChatConversation.findById(conversationId).select("status").lean();
  if (!conv) throw new ChatRuleError("Conversation not found", 404);
  if (conv.status === ChatStatus.ASSIGNED || conv.status === ChatStatus.WAITING) return conversationView(await ChatConversation.findById(conversationId).lean());
  return setStatus(conversationId, ChatStatus.WAITING);
}

/**
 * Marks unattended conversations ABANDONED (no guest message for 24 h, not resolved), and removes
 * chats that were only opened (no guest message, no contact details) more than 24 h ago.
 */
export async function sweepAbandoned() {
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);
  const empty = await ChatConversation.find({
    createdAt: { $lt: cutoff },
    lastGuestMessageAt: { $exists: false },
    "guest.phone": { $in: [null, ""] },
    "guest.email": { $in: [null, ""] },
    "guest.name": { $in: [null, ""] },
  }).select("_id").limit(500).lean();
  if (empty.length) {
    const ids = empty.map((c) => c._id);
    await ChatMessage.deleteMany({ conversation: { $in: ids } });
    await ChatConversation.deleteMany({ _id: { $in: ids } });
  }
  await ChatConversation.updateMany(
    { status: { $in: [ChatStatus.BOT, ChatStatus.WAITING] }, lastMessageAt: { $lt: cutoff } },
    { $set: { status: ChatStatus.ABANDONED } },
  );
}

export async function markRead(conversationId: string, by: "STAFF" | "GUEST") {
  const conv = await ChatConversation.findByIdAndUpdate(conversationId, { $set: by === "STAFF" ? { unreadForStaff: 0 } : { unreadForGuest: 0 } }, { returnDocument: "after" }).lean();
  if (conv && by === "STAFF") emitToStaff("chat:conversation", conversationView(conv), conv.propertyId);
  return conv ? conversationView(conv) : null;
}
