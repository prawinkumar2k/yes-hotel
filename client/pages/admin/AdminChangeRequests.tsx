import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/context/PermissionContext";

type Tab = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN" | "ALL";
const TABS: { id: Tab; label: string }[] = [
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "DECLINED", label: "Declined" },
  { id: "WITHDRAWN", label: "Withdrawn by guest" },
  { id: "ALL", label: "All" },
];
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DECLINED: "bg-red-50 text-red-800 border-red-200",
  WITHDRAWN: "bg-slate-50 text-slate-600 border-slate-200",
};

const day = (d?: string) => (d ? format(new Date(d), "dd MMM yyyy") : "—");
const when = (d?: string) => (d ? format(new Date(d), "dd MMM yyyy, HH:mm") : "—");
const who = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "—" : "—");

/** One "was → requested" line, shown only for what the guest asked to change. */
function Diff({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-slate-500 line-through">{from}</span>
      <ArrowRight size={13} className="text-slate-400" />
      <span className="font-semibold text-slate-900">{to}</span>
    </div>
  );
}

export default function AdminChangeRequests() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canDecide = hasPermission("BOOKINGS", "EDIT" as any);
  const [tab, setTab] = useState<Tab>("PENDING");

  const { data, isLoading, error } = useQuery({
    queryKey: ["change-requests", tab],
    queryFn: async () => (await api.get(`/change-requests?status=${tab}`)).data.data as any[],
    refetchInterval: 30000,
  });

  const act = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "approve" | "decline"; note?: string }) =>
      (await api.post(`/change-requests/${id}/${action}`, { note })).data,
    onSuccess: (res) => {
      toast({ title: res.message || "Done" });
      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["change-request-counts"] });
    },
    onError: (e: any) => toast({ title: "Could not complete", description: e?.response?.data?.message || e.message, variant: "destructive" }),
  });

  const approve = (r: any) => {
    const ok = window.confirm(
      `Approve the change for ${r.booking?.bookingReference}?\n\nFirst update the reservation (dates / guests / rate) from its booking page — approving only records the decision and tells the guest.`,
    );
    if (!ok) return;
    const note = window.prompt("Message to the guest (optional), e.g. new total or room:") ?? undefined;
    act.mutate({ id: r._id, action: "approve", note: note?.trim() || undefined });
  };
  const decline = (r: any) => {
    const note = window.prompt(`Decline the change for ${r.booking?.bookingReference}.\n\nReason for the guest (required):`)?.trim();
    if (!note) return;
    act.mutate({ id: r._id, action: "decline", note });
  };

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">Guest Change Requests</h1>
        <p className="text-sm text-slate-500">
          Guests ask from their account to change dates or guests. Check availability and price, update the reservation, then approve, or decline with a reason. The guest sees your reply.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${tab === t.id ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-600" size={28} /></div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load requests: {(error as any)?.response?.data?.message || (error as any)?.message}</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400 bg-white border border-slate-200 rounded-xl">Nothing here.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const b = r.booking ?? {};
            const g = b.guestDetails ?? {};
            const q = r.requested ?? {};
            const c = r.current ?? {};
            return (
              <div key={r._id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/bookings/${b._id}`} className="font-semibold text-amber-700 hover:underline font-mono">{b.bookingReference ?? "—"}</Link>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">Booking {b.status}</span>
                    </div>
                    <div className="text-sm text-slate-700">
                      {`${g.firstName ?? ""} ${g.lastName ?? ""}`.trim() || who(r.customer)} · {g.phone ?? r.customer?.phone ?? ""} · {b.roomCategory?.name ?? ""}
                    </div>
                    <div className="pt-1 space-y-0.5">
                      {q.checkInDate && <Diff label="Check-in" from={day(c.checkInDate)} to={day(q.checkInDate)} />}
                      {q.checkOutDate && <Diff label="Check-out" from={day(c.checkOutDate)} to={day(q.checkOutDate)} />}
                      {q.adults != null && <Diff label="Adults" from={String(c.adults)} to={String(q.adults)} />}
                      {q.children != null && <Diff label="Children" from={String(c.children)} to={String(q.children)} />}
                    </div>
                    {r.note && <div className="text-xs text-slate-600">Guest note: “{r.note}”</div>}
                    <div className="text-xs text-slate-500">Asked {when(r.createdAt)}</div>
                    {r.handledAt && r.status !== "WITHDRAWN" && (
                      <div className="text-xs text-slate-600">
                        {r.status === "APPROVED" ? "Approved" : "Declined"} by <b>{who(r.handledBy)}</b> · {when(r.handledAt)}
                        {r.responseNote ? <> — “{r.responseNote}”</> : null}
                      </div>
                    )}
                  </div>
                  {r.status === "PENDING" && canDecide && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/admin/bookings/${b._id}`} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50">Open reservation</Link>
                      <button disabled={act.isPending} onClick={() => approve(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"><CheckCircle2 size={14} /> Approve</button>
                      <button disabled={act.isPending} onClick={() => decline(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50"><XCircle size={14} /> Decline</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
