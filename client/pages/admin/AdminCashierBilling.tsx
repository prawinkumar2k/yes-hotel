import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Wallet, CreditCard, RotateCcw, LogOut, Printer, FileText, X, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const inr = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

type Row = {
  bookingId: string; bookingReference: string; billNumber?: string; guest: string; phone?: string; room?: string; category?: string;
  checkInDate: string; checkOutDate: string; overdue: boolean; checkoutInitiated: boolean; folioId?: string;
  charges: number; paid: number; advancesApplied: number; refunded: number; balance: number; advanceAvailable: number; readyToCheckOut: boolean;
};

export default function AdminCashierBilling() {
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [pay, setPay] = useState({ amount: "", method: "CASH", reference: "", key: "" });
  const [doc, setDoc] = useState<{ title: string; src: string } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-queue", showAll],
    queryFn: async () => (await api.get(`/reception/billing-queue${showAll ? "?all=true" : ""}`)).data.data as Row[],
    refetchInterval: 30000,
  });
  const { data: counts } = useQuery({
    queryKey: ["verification-counts"],
    queryFn: async () => (await api.get("/verifications/counts")).data.data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["billing-queue"] });
    queryClient.invalidateQueries({ queryKey: ["verification-counts"] });
    queryClient.invalidateQueries({ queryKey: ["front-desk-summary"] });
  };
  const onError = (e: any) => toast({ title: "Could not complete", description: e?.response?.data?.message || e.message, variant: "destructive" });

  const applyAdvances = useMutation({
    mutationFn: async (r: Row) => (await api.post(`/reception/folios/${r.folioId}/apply-advances`, {})).data,
    onSuccess: (res) => { toast({ title: res.message }); refresh(); },
    onError,
  });
  const recordPayment = useMutation({
    mutationFn: async () =>
      (await api.post(`/reception/folios/${payFor!.folioId}/payments`, {
        amount: Number(pay.amount), method: pay.method, reference: pay.reference || undefined, clientRequestId: pay.key,
      })).data,
    onSuccess: (res) => {
      toast({ title: res.duplicate ? "Already recorded" : "Payment received", description: res.message });
      const paymentId = res.data?.payment?._id;
      setPayFor(null);
      refresh();
      if (paymentId) setDoc({ title: "Payment Receipt", src: `/admin/payments/${paymentId}/receipt` });
    },
    onError,
  });
  const refundCredit = useMutation({
    mutationFn: async ({ r, amount, reason, method }: { r: Row; amount: number; reason: string; method: string }) =>
      (await api.post(`/reception/folios/${r.folioId}/refunds`, { amount, reason, method })).data,
    onSuccess: (res) => { toast({ title: res.message }); refresh(); },
    onError,
  });
  const checkout = useMutation({
    mutationFn: async (r: Row) => (await api.post(`/bookings/${r.bookingId}/check-out`, { notes: "Checked out from Cashier & Billing" })).data,
    onSuccess: (res, r) => {
      toast({ title: "Checked out", description: res.message });
      refresh();
      setDoc({ title: "GST Invoice", src: `/admin/bookings/${r.bookingId}/folio-print` });
    },
    onError,
  });

  const openPay = (r: Row) => {
    setPayFor(r);
    setPay({ amount: String(Math.max(0, r.balance)), method: "CASH", reference: "", key: newKey() });
  };
  const askRefund = (r: Row) => {
    const credit = -r.balance;
    const amount = Number(window.prompt(`Guest credit is ${inr(credit)}. Amount to refund:`, String(credit)));
    if (!(amount > 0)) return;
    const reason = window.prompt("Reason for the refund:")?.trim();
    if (!reason) return;
    refundCredit.mutate({ r, amount, reason, method: "CASH" });
  };

  const rows = data ?? [];
  const returnedToCashier = counts?.returned?.CASHIER ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Cashier &amp; Billing</h1>
          <p className="text-sm text-slate-500">Settle bills, take payments, apply advances and complete checkout. Advances are deposits, not revenue, until applied to a bill.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <Link to="/admin/verifications" className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
            Returned to Cashier {returnedToCashier > 0 && <span className="ml-1 px-1.5 rounded bg-red-100 text-red-700">{returnedToCashier}</span>}
          </Link>
          <Link to="/admin/advances" className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Advance Deposits</Link>
          <Link to="/admin/cashier-shifts" className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Cashier Shift</Link>
          <Link to="/admin/payments" className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Payment History</Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setShowAll(false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${!showAll ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-white border-slate-200 text-slate-600"}`}>Bills to settle</button>
        <button onClick={() => setShowAll(true)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${showAll ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-white border-slate-200 text-slate-600"}`}>All in-house</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-600" size={28} /></div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load bills: {(error as any)?.response?.data?.message || (error as any)?.message}</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400 bg-white border border-slate-200 rounded-xl">No bills waiting. Stays sent from the Front Desk, due out today or overdue appear here.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                {["Room", "Guest / Reservation", "Stay", "Charges", "Paid", "Advance applied", "Balance", "Advance available", "Actions"].map((h) => (
                  <th key={h} className={`px-3 py-2 font-bold whitespace-nowrap ${["Charges", "Paid", "Advance applied", "Balance", "Advance available"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bookingId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-bold">{r.room ?? "—"}<div className="font-normal text-slate-500">{r.category}</div></td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{r.guest}</div>
                    <Link to={`/admin/bookings/${r.bookingId}`} className="text-amber-700 hover:underline">{r.bookingReference}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.checkoutInitiated && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">Sent for checkout</span>}
                      {r.overdue && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold">Overdue</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.checkInDate), "dd MMM")} → {format(new Date(r.checkOutDate), "dd MMM")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(r.charges)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(r.paid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(r.advancesApplied)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${r.balance > 0 ? "text-red-700" : r.balance < 0 ? "text-blue-700" : "text-emerald-700"}`}>
                    {r.balance < 0 ? `Credit ${inr(-r.balance)}` : inr(r.balance)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(r.advanceAvailable)}</td>
                  <td className="px-3 py-2">
                    {!r.folioId ? (
                      <span className="text-slate-400">No folio</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {r.advanceAvailable > 0 && r.balance > 0 && (
                          <button disabled={applyAdvances.isPending} onClick={() => applyAdvances.mutate(r)} className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 font-bold flex items-center gap-1 disabled:opacity-50"><Wallet size={12} /> Apply advance</button>
                        )}
                        {r.balance > 0 && (
                          <button onClick={() => openPay(r)} className="px-2 py-1 rounded bg-black text-[#e5c76b] font-bold flex items-center gap-1"><CreditCard size={12} /> Record payment</button>
                        )}
                        {r.balance < 0 && (
                          <button disabled={refundCredit.isPending} onClick={() => askRefund(r)} className="px-2 py-1 rounded border border-blue-300 text-blue-800 bg-white font-bold flex items-center gap-1 disabled:opacity-50"><RotateCcw size={12} /> Refund credit</button>
                        )}
                        {r.readyToCheckOut && (
                          <button disabled={checkout.isPending} onClick={() => window.confirm(`Complete checkout for ${r.guest} (Room ${r.room})?`) && checkout.mutate(r)} className="px-2 py-1 rounded bg-emerald-600 text-white font-bold flex items-center gap-1 disabled:opacity-50"><LogOut size={12} /> Complete checkout</button>
                        )}
                        <button onClick={() => setDoc({ title: "Bill / GST Invoice", src: `/admin/bookings/${r.bookingId}/folio-print` })} className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 font-bold flex items-center gap-1"><FileText size={12} /> Bill</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payFor && (
        <div role="dialog" aria-modal="true" aria-label="Record payment" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !recordPayment.isPending && setPayFor(null)}>
          <form
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); recordPayment.mutate(); }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg flex items-center gap-2"><Receipt size={18} /> Record payment</h3>
              <button type="button" onClick={() => setPayFor(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600">{payFor.guest} · Room {payFor.room} · Due <b>{inr(payFor.balance)}</b></p>
            <label className="block text-xs font-bold text-slate-600">Amount (₹)
              <input type="number" min="0.01" step="0.01" max={payFor.balance} required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </label>
            <label className="block text-xs font-bold text-slate-600">Method
              <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option>
              </select>
            </label>
            {pay.method !== "CASH" && (
              <label className="block text-xs font-bold text-slate-600">{pay.method === "CARD" ? "Approval code" : "UTR / reference"} *
                <input required value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </label>
            )}
            <button type="submit" disabled={recordPayment.isPending} className="w-full py-2.5 rounded-xl bg-black text-[#e5c76b] font-bold text-sm disabled:opacity-50">
              {recordPayment.isPending ? "Recording…" : `Receive ${inr(Number(pay.amount) || 0)}`}
            </button>
          </form>
        </div>
      )}

      {doc && (
        <div role="dialog" aria-modal="true" aria-label={doc.title} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="font-bold text-sm">{doc.title}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => frameRef.current?.contentWindow?.print()} className="px-3 py-2 bg-black text-[#e5c76b] rounded-xl font-bold text-xs flex items-center gap-1.5"><Printer size={14} /> Print</button>
                <button type="button" onClick={() => setDoc(null)} className="px-3 py-2 border border-slate-300 rounded-xl font-bold text-xs">Close</button>
              </div>
            </div>
            <iframe ref={frameRef} title={doc.title} src={doc.src} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
}
