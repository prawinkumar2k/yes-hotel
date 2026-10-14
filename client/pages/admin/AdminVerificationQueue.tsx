import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, CheckCircle2, XCircle, RotateCcw, History, Search } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/context/PermissionContext";

type Tab = "PENDING" | "APPROVED" | "REJECTED" | "RESUBMITTED" | "RETURNED" | "ALL";

const TABS: { id: Tab; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "RETURNED", label: "Returned for correction" },
  { id: "RESUBMITTED", label: "Resubmitted" },
  { id: "APPROVED", label: "Verified" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All" },
];

const TYPES = [
  ["", "All types"],
  ["ROOM_RELEASE", "Room cleaned — release"],
  ["SHIFT_VARIANCE", "Cash variance"],
  ["REFUND", "Refund"],
  ["TARIFF_BELOW_DEFAULT", "Tariff below default"],
  ["FOLIO_VOID", "Folio line voided"],
  ["CANCEL_WITH_ADVANCE", "Cancelled with advance"],
] as const;

const QUEUE_LABEL: Record<string, string> = { HOUSEKEEPING: "Housekeeping", FRONT_DESK: "Front Desk", CASHIER: "Cashier & Billing" };
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-800 border-red-200",
};

const who = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "—" : "System");
const when = (d?: string) => (d ? format(new Date(d), "dd MMM yyyy, HH:mm") : "—");
const inr = (n?: number) => (n || n === 0 ? `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "");

export default function AdminVerificationQueue() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canReview = hasPermission("VERIFICATIONS", "APPROVE" as any);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["verifications", tab, type, search],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (tab === "RETURNED") p.set("returned", "true");
      else p.set("status", tab);
      if (type) p.set("type", type);
      if (search.trim()) p.set("search", search.trim());
      return (await api.get(`/verifications?${p.toString()}`)).data.data as any[];
    },
    refetchInterval: 30000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["verifications"] });
    queryClient.invalidateQueries({ queryKey: ["verification-counts"] });
  };

  const act = useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: "approve" | "reject" | "resubmit"; body: any }) =>
      (await api.post(`/verifications/${id}/${action}`, body)).data,
    onSuccess: (res) => {
      toast({ title: res.message || "Done" });
      refresh();
    },
    onError: (e: any) => toast({ title: "Could not complete", description: e?.response?.data?.message || e.message, variant: "destructive" }),
  });

  const approve = (r: any) => {
    const note = window.prompt(`Verify: ${r.summary}\n\nOptional note:`) ?? null;
    if (note === null) return;
    act.mutate({ id: r._id, action: "approve", body: { note } });
  };
  const reject = (r: any) => {
    const reason = window.prompt(`Reject and return to ${QUEUE_LABEL[r.returnQueue]}:\n${r.summary}\n\nReason (required):`)?.trim();
    if (!reason) return;
    if (reason.length < 3) return toast({ title: "Enter a rejection reason", variant: "destructive" });
    act.mutate({ id: r._id, action: "reject", body: { reason } });
  };
  const resubmit = (r: any) => {
    const note = window.prompt(`Resubmit after correction:\n${r.summary}\n\nWhat did you correct?`)?.trim();
    if (!note) return;
    act.mutate({ id: r._id, action: "resubmit", body: { note } });
  };

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">Verification Queue</h1>
        <p className="text-sm text-slate-500">Completed work waiting to be verified. Rejected tasks return to the desk that did them.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${tab === t.id ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, room, reservation…" className="pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white w-56" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-600" size={28} /></div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load the queue: {(error as any)?.response?.data?.message || (error as any)?.message}</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400 bg-white border border-slate-200 rounded-xl">Nothing here.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r._id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{r.typeLabel}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLE[r.status] ?? ""}`}>{r.status === "APPROVED" ? "VERIFIED" : r.status}</span>
                    {r.attempt > 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-50 text-blue-800 border-blue-200">Attempt {r.attempt}</span>}
                    {r.status === "REJECTED" && !r.resubmittedAs && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">Returned to {QUEUE_LABEL[r.returnQueue]}</span>}
                  </div>
                  <div className="font-semibold text-slate-900 mt-1">{r.summary}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Completed by <b>{who(r.submittedBy)}</b>{r.submittedRole ? ` (${r.submittedRole})` : ""} · {when(r.createdAt)}
                    {r.amount ? <> · <b>{inr(r.amount)}</b></> : null}
                  </div>
                  {r.submittedNote && <div className="text-xs text-slate-600 mt-1">Note: {r.submittedNote}</div>}
                  {r.reviewedAt && (
                    <div className="text-xs mt-1 text-slate-600">
                      {r.status === "APPROVED" ? "Verified" : "Rejected"} by <b>{who(r.reviewedBy)}</b> · {when(r.reviewedAt)}
                      {r.reviewNote ? <> — “{r.reviewNote}”</> : null}
                    </div>
                  )}
                  {r.details?.bookingReference && (
                    <div className="text-xs mt-1 text-slate-500">
                      Reservation <Link className="text-amber-700 hover:underline" to={`/admin/bookings/${r.booking}`}>{r.details.bookingReference}</Link>
                      {r.details.room ? ` · Room ${r.details.room}` : ""}{r.details.guest ? ` · ${r.details.guest}` : ""}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "PENDING" && canReview && (
                    <>
                      <button disabled={act.isPending} onClick={() => approve(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"><CheckCircle2 size={14} /> Verify</button>
                      <button disabled={act.isPending} onClick={() => reject(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50"><XCircle size={14} /> Reject</button>
                    </>
                  )}
                  {r.status === "REJECTED" && !r.resubmittedAs && r.type !== "ROOM_RELEASE" && (
                    <button disabled={act.isPending} onClick={() => resubmit(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"><RotateCcw size={14} /> Resubmit</button>
                  )}
                  {r.status === "REJECTED" && !r.resubmittedAs && r.type === "ROOM_RELEASE" && (
                    <span className="text-[11px] text-slate-500">Back with housekeeping; returns here when re-cleaned.</span>
                  )}
                  <button onClick={() => setOpenHistory(openHistory === r._id ? null : r._id)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="History"><History size={14} /></button>
                </div>
              </div>
              {openHistory === r._id && (
                <ol className="mt-3 border-t border-slate-100 pt-3 space-y-1">
                  {(r.history ?? []).map((h: any, i: number) => (
                    <li key={i} className="text-xs text-slate-600">
                      <b>{h.action}</b> · {who(h.by)}{h.role ? ` (${h.role})` : ""} · {when(h.at)}{h.note ? ` — ${h.note}` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
