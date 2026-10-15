import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Loader2, Send, CheckCircle2, RotateCcw, UserCheck, Search, ArrowLeft, Wifi, WifiOff, Phone, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/context/PermissionContext";
import { useStaffRealtime } from "@/hooks/useStaffRealtime";

type Tab = "OPEN" | "WAITING" | "ASSIGNED" | "RESOLVED" | "ABANDONED" | "ALL";
const TABS: { id: Tab; label: string }[] = [
  { id: "OPEN", label: "Open" },
  { id: "WAITING", label: "Waiting" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "ABANDONED", label: "Abandoned" },
  { id: "ALL", label: "All" },
];
const STATUS_STYLE: Record<string, string> = {
  BOT: "bg-slate-50 text-slate-600 border-slate-200",
  WAITING: "bg-amber-50 text-amber-800 border-amber-300",
  ASSIGNED: "bg-blue-50 text-blue-800 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  ABANDONED: "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_LABEL: Record<string, string> = { BOT: "With chatbot", WAITING: "Waiting for staff", ASSIGNED: "Assigned", RESOLVED: "Resolved", ABANDONED: "Abandoned" };
const guestName = (c: any) => c?.guest?.name || c?.guest?.phone || c?.guest?.email || "Website guest";
const newId = () => `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AdminLiveChat() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canReply = hasPermission("ENQUIRIES", "EDIT" as any);
  const [tab, setTab] = useState<Tab>("OPEN");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const list = useQuery({
    queryKey: ["live-chats", tab, search],
    queryFn: async () => (await api.get(`/chat/staff/conversations?status=${tab}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`)).data.data as any[],
  });
  const thread = useQuery({
    queryKey: ["live-chat", selected],
    queryFn: async () => (await api.get(`/chat/staff/conversations/${selected}`)).data.data as { conversation: any; messages: any[] },
    enabled: Boolean(selected),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["live-chats"] });
    queryClient.invalidateQueries({ queryKey: ["live-chat-counts"] });
    if (selected) queryClient.invalidateQueries({ queryKey: ["live-chat", selected] });
  };

  // Live: new chats, messages and status changes; full re-sync after a reconnect.
  const { connected } = useStaffRealtime((event, payload) => {
    if (event === "chat:message") {
      const convId = payload?.conversation?._id;
      if (convId && convId === selected) {
        queryClient.setQueryData(["live-chat", selected], (old: any) => {
          if (!old) return old;
          if (old.messages.some((m: any) => m._id === payload.message._id || m.clientMessageId === payload.message.clientMessageId)) return old;
          return { ...old, conversation: payload.conversation, messages: [...old.messages, payload.message] };
        });
        if (payload.message.sender === "GUEST") api.get(`/chat/staff/conversations/${selected}`).catch(() => undefined); // marks read
      }
      queryClient.invalidateQueries({ queryKey: ["live-chats"] });
      queryClient.invalidateQueries({ queryKey: ["live-chat-counts"] });
    } else if (event === "chat:conversation") {
      queryClient.invalidateQueries({ queryKey: ["live-chats"] });
      queryClient.invalidateQueries({ queryKey: ["live-chat-counts"] });
      if (payload?._id === selected) queryClient.invalidateQueries({ queryKey: ["live-chat", selected] });
    }
  }, refreshAll);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.data?.messages?.length]);

  const reply = useMutation({
    mutationFn: async (text: string) => (await api.post(`/chat/staff/conversations/${selected}/reply`, { text, clientMessageId: newId() })).data,
    onSuccess: () => { setDraft(""); refreshAll(); },
    onError: (e: any) => toast({ title: "Reply not sent", description: e?.response?.data?.message || e.message, variant: "destructive" }),
  });
  const act = useMutation({
    mutationFn: async (action: "assign" | "resolve" | "reopen") => (await api.post(`/chat/staff/conversations/${selected}/${action}`, {})).data,
    onSuccess: () => refreshAll(),
    onError: (e: any) => toast({ title: "Could not update", description: e?.response?.data?.message || e.message, variant: "destructive" }),
  });

  const conv = thread.data?.conversation;
  const rows = list.data ?? [];
  const sortedRows = useMemo(() => [...rows].sort((a, b) => (b.status === "WAITING" ? 1 : 0) - (a.status === "WAITING" ? 1 : 0) || +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Live Chat</h1>
          <p className="text-sm text-slate-500">Website chats with guests. New messages appear instantly; reply here and the guest sees it in their chat.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-semibold ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />} {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Conversation list (hidden on mobile while a chat is open) */}
        <div className={`${selected ? "hidden lg:block" : ""} rounded-xl border border-slate-200 bg-white`}>
          <div className="space-y-2 border-b border-slate-100 p-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`min-h-[36px] shrink-0 rounded-lg border px-3 text-xs font-bold ${tab === t.id ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-600"}`}>{t.label}</button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-3 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email, message…" className="min-h-[40px] w-full rounded-lg border border-slate-200 pl-8 pr-2 text-sm" />
            </div>
          </div>
          {list.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-600" /></div>
          ) : list.isError ? (
            <div className="p-4 text-sm text-red-700">Could not load chats. <button className="underline" onClick={() => list.refetch()}>Retry</button></div>
          ) : sortedRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No chats here.</div>
          ) : (
            <ul className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
              {sortedRows.map((c) => (
                <li key={c._id}>
                  <button onClick={() => setSelected(c._id)} className={`w-full px-3 py-3 text-left hover:bg-slate-50 ${selected === c._id ? "bg-amber-50/60" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-slate-900">{guestName(c)}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatDistanceToNowStrict(new Date(c.lastMessageAt), { addSuffix: true })}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-500">{c.lastMessagePreview || "—"}</span>
                      {c.unreadForStaff > 0 && <span className="shrink-0 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{c.unreadForStaff}</span>}
                    </div>
                    <span className={`mt-1.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className={`${selected ? "" : "hidden lg:flex"} flex min-h-[60vh] flex-col rounded-xl border border-slate-200 bg-white`}>
          {!selected ? (
            <div className="m-auto p-8 text-sm text-slate-400">Choose a chat on the left.</div>
          ) : thread.isLoading ? (
            <div className="m-auto"><Loader2 className="animate-spin text-amber-600" /></div>
          ) : thread.isError || !conv ? (
            <div className="m-auto p-6 text-sm text-red-700">Could not load this chat. <button className="underline" onClick={() => thread.refetch()}>Retry</button></div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-3">
                <div className="flex min-w-0 items-start gap-2">
                  <button onClick={() => setSelected(null)} className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 lg:hidden" aria-label="Back to chats"><ArrowLeft size={16} className="mx-auto" /></button>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{guestName(conv)}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                      {conv.guest?.phone && <a href={`tel:${conv.guest.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone size={11} />{conv.guest.phone}</a>}
                      {conv.guest?.email && <a href={`mailto:${conv.guest.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail size={11} />{conv.guest.email}</a>}
                      <span>Started {format(new Date(conv.createdAt), "dd MMM, HH:mm")}</span>
                    </p>
                    <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[conv.status]}`}>{STATUS_LABEL[conv.status]}</span>
                  </div>
                </div>
                {canReply && (
                  <div className="flex flex-wrap gap-2">
                    {conv.status !== "ASSIGNED" && conv.status !== "RESOLVED" && <button disabled={act.isPending} onClick={() => act.mutate("assign")} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-bold"><UserCheck size={14} /> Take over</button>}
                    {conv.status !== "RESOLVED" ? (
                      <button disabled={act.isPending} onClick={() => act.mutate("resolve")} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white"><CheckCircle2 size={14} /> Resolve</button>
                    ) : (
                      <button disabled={act.isPending} onClick={() => act.mutate("reopen")} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-bold"><RotateCcw size={14} /> Reopen</button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-3 max-h-[55vh]">
                {thread.data!.messages.map((m) => (
                  <div key={m._id} className={m.sender === "STAFF" ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
                    <div className={`whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${m.sender === "GUEST" ? "border border-slate-200 bg-white" : m.sender === "STAFF" ? "border border-amber-300 bg-amber-100 text-slate-900" : "border border-dashed border-slate-300 bg-slate-100 text-slate-600"}`}>{m.text}</div>
                    <p className={`mt-0.5 text-[10px] text-slate-400 ${m.sender === "STAFF" ? "text-right" : ""}`}>
                      {m.sender === "GUEST" ? "Guest" : m.sender === "BOT" ? "Chatbot" : m.sender === "STAFF" ? `${m.staff?.firstName ?? "Staff"}` : "System"} · {format(new Date(m.createdAt), "dd MMM, HH:mm")}
                    </p>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              {canReply && (
                <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) reply.mutate(draft.trim()); }} className="flex gap-2 border-t border-slate-100 p-3">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) reply.mutate(draft.trim()); } }} rows={2} maxLength={2000} placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)" className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-200 p-2 text-sm" />
                  <button type="submit" disabled={reply.isPending || !draft.trim()} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-amber-500 px-3 font-bold text-white disabled:opacity-50" aria-label="Send reply">
                    {reply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
