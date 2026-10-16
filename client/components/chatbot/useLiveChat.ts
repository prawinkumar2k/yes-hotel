/**
 * Connects the website chatbot to the hotel: the conversation (guest + bot lines) is saved on the
 * server, Reception / Admin see it live, and their replies come back here in real time.
 * The server is the source of truth — after any (re)connect we fetch what we missed.
 *
 * While the chat window is open, Reception sees the guest "online", the chatbot step they are on
 * and what they are typing (activity(), sent a few times a second at most, never stored).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getStoredAuthToken } from "@/lib/authStorage";
import type { ChatMessage } from "./types";

const KEY = "yes_chat_session_v1";
type Session = { conversationId: string; token: string };
export type LiveStatus = "BOT" | "WAITING" | "ASSIGNED" | "RESOLVED" | "ABANDONED";
type ServerMessage = { _id: string; sender: "GUEST" | "BOT" | "STAFF" | "SYSTEM"; text: string; clientMessageId: string; createdAt: string };

const readSession = (): Session | null => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s?.conversationId && s?.token ? s : null;
  } catch {
    return null;
  }
};
const writeSession = (s: Session | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* private mode: chat still works for this page view */ }
};

export const toChatMessage = (m: ServerMessage): ChatMessage => ({
  id: m.clientMessageId,
  sender: m.sender === "GUEST" ? "user" : m.sender === "STAFF" ? "staff" : "assistant",
  text: m.text,
});

export function useLiveChat(opts: { onIncoming: (messages: ChatMessage[]) => void }) {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [status, setStatus] = useState<LiveStatus>("BOT");
  const [connected, setConnected] = useState(false);
  const [staffTyping, setStaffTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pendingActivity = useRef<Record<string, string> | null>(null);
  const activityTimer = useRef<number | null>(null);
  const staffTypingTimer = useRef<number | null>(null);
  const synced = useRef<Set<string>>(new Set());
  const lastSeen = useRef<string | null>(null);
  const creating = useRef<Promise<Session> | null>(null);
  const onIncoming = useRef(opts.onIncoming);
  onIncoming.current = opts.onIncoming;

  const headers = (s: Session) => ({ "Content-Type": "application/json", "X-Chat-Token": s.token });

  /** Fetches messages after the last one we saw and hands new ones to the window. */
  const catchUp = useCallback(async (s: Session, initial = false) => {
    const qs = !initial && lastSeen.current ? `?after=${encodeURIComponent(lastSeen.current)}` : "";
    const res = await fetch(`/api/chat/conversations/${s.conversationId}${qs}`, { headers: headers(s) });
    if (res.status === 404) { writeSession(null); setSession(null); return; }
    const json = await res.json().catch(() => null);
    if (!json?.success) return;
    setStatus(json.data.conversation.status);
    const msgs: ServerMessage[] = json.data.messages;
    if (msgs.length) lastSeen.current = msgs[msgs.length - 1].createdAt;
    msgs.forEach((m) => synced.current.add(m.clientMessageId));
    const fresh = initial ? msgs : msgs.filter((m) => m.sender === "STAFF" || m.sender === "SYSTEM");
    if (fresh.length) onIncoming.current(fresh.map(toChatMessage));
    if (msgs.some((m) => m.sender === "STAFF")) fetch(`/api/chat/conversations/${s.conversationId}/read`, { method: "POST", headers: headers(s) }).catch(() => undefined);
  }, []);

  // Restore an existing conversation's history when the chat opens.
  useEffect(() => {
    if (session) catchUp(session, true).catch(() => undefined);
    // only on mount / session change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.conversationId]);

  // Live connection for this conversation.
  useEffect(() => {
    if (!session) return;
    const socket: Socket = io("/guest", { path: "/socket.io", auth: { conversationId: session.conversationId, token: session.token, page: window.location.pathname }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      catchUp(session).catch(() => undefined);
      if (pendingActivity.current) { socket.emit("guest:activity", pendingActivity.current); pendingActivity.current = null; }
    });
    socket.on("chat:staff-typing", (p: { typing: boolean }) => {
      setStaffTyping(Boolean(p?.typing));
      if (staffTypingTimer.current) window.clearTimeout(staffTypingTimer.current);
      if (p?.typing) staffTypingTimer.current = window.setTimeout(() => setStaffTyping(false), 6000);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("chat:message", (p: { message: ServerMessage; status: LiveStatus }) => {
      setStatus(p.status);
      if (p.message.sender === "STAFF") setStaffTyping(false);
      lastSeen.current = p.message.createdAt;
      if (synced.current.has(p.message.clientMessageId)) return; // our own echo / duplicate
      synced.current.add(p.message.clientMessageId);
      onIncoming.current([toChatMessage(p.message)]);
      fetch(`/api/chat/conversations/${session.conversationId}/read`, { method: "POST", headers: headers(session) }).catch(() => undefined);
    });
    socket.on("chat:status", (p: { status: LiveStatus }) => setStatus(p.status));
    return () => { socket.close(); socketRef.current = null; };
  }, [session, catchUp]);

  /** Tells Reception what the guest is doing right now (step, field, text). Batched to ~4 per second. */
  const activity = useCallback((p: { step?: string; field?: string; text?: string }) => {
    pendingActivity.current = { ...(pendingActivity.current ?? {}), ...p, page: window.location.pathname } as Record<string, string>;
    if (activityTimer.current) return;
    activityTimer.current = window.setTimeout(() => {
      activityTimer.current = null;
      const socket = socketRef.current;
      if (socket?.connected && pendingActivity.current) { socket.emit("guest:activity", pendingActivity.current); pendingActivity.current = null; }
    }, 250);
  }, []);

  const ensureSession = useCallback(async (): Promise<Session> => {
    if (session) return session;
    if (!creating.current) {
      creating.current = (async () => {
        const auth = getStoredAuthToken();
        const res = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
          body: JSON.stringify({ pageUrl: window.location.pathname }),
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.message || "Chat unavailable");
        const s = { conversationId: json.data.conversation._id, token: json.data.token };
        writeSession(s);
        setSession(s);
        return s;
      })().finally(() => { creating.current = null; });
    }
    return creating.current;
  }, [session]);

  /** Saves guest / bot lines that aren't on the server yet (idempotent per message id). */
  const sync = useCallback(async (messages: ChatMessage[]) => {
    const pending = messages.filter((m) => (m.sender === "user" || m.sender === "assistant") && !synced.current.has(m.id) && m.text?.trim());
    if (!pending.length || !messages.some((m) => m.sender === "user")) return;
    const s = await ensureSession();
    for (const m of pending) {
      synced.current.add(m.id);
      const text = m.kind === "availability" && m.rooms?.length ? `${m.text}\n${m.rooms.map((r) => `• ${r.name}${r.pricePerNight ? ` ₹${r.pricePerNight}/night` : ""}`).join("\n")}` : m.text;
      const res = await fetch(`/api/chat/conversations/${s.conversationId}/messages`, {
        method: "POST",
        headers: headers(s),
        body: JSON.stringify({ text: text.slice(0, 2000), clientMessageId: m.id.slice(0, 80), sender: m.sender === "user" ? "GUEST" : "BOT" }),
      }).catch(() => null);
      if (!res || !res.ok) synced.current.delete(m.id); // retry on the next change
    }
  }, [ensureSession]);

  const requestStaff = useCallback(async () => {
    const s = await ensureSession();
    const res = await fetch(`/api/chat/conversations/${s.conversationId}/request-staff`, { method: "POST", headers: headers(s) });
    const json = await res.json().catch(() => null);
    if (json?.success) setStatus(json.data.status);
  }, [ensureSession]);

  const setDetails = useCallback(async (d: { name?: string; phone?: string; email?: string }) => {
    if (!session) return;
    await fetch(`/api/chat/conversations/${session.conversationId}/details`, { method: "POST", headers: headers(session), body: JSON.stringify(d) }).catch(() => undefined);
  }, [session]);

  /** Starts over: the next message opens a new conversation. */
  const reset = useCallback(() => {
    writeSession(null);
    setSession(null);
    setStatus("BOT");
    synced.current = new Set();
    lastSeen.current = null;
  }, []);

  /** Opening the chat window starts (or resumes) the conversation so Reception sees the guest online. */
  const open = useCallback(() => ensureSession().then(() => undefined), [ensureSession]);

  const withStaff = status === "WAITING" || status === "ASSIGNED";
  return { status, withStaff, connected, staffTyping, hasSession: Boolean(session), sync, requestStaff, setDetails, reset, open, activity };
}
