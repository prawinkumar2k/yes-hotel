import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Download, Loader2, Printer, RefreshCcw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import ReportPrintHeader from "@/components/admin/ReportPrintHeader";
import RefundDialog from "@/components/admin/RefundDialog";
import { usePrintLayout } from "@/lib/usePrintLayout";
import { usePermissions } from "@/context/PermissionContext";
import { todayBusinessDate } from "@shared/dates";

const inr = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const KIND: Record<string, { label: string; cls: string }> = {
  PAYMENT: { label: "Payment", cls: "bg-green-50 text-green-700 border-green-200" },
  ADVANCE: { label: "Advance", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  REFUND: { label: "Refund", cls: "bg-red-50 text-red-700 border-red-200" },
};

/** Every payment and refund in a period as a report: totals, split by method, a list, and Refund on each row that can be refunded. */
export default function PaymentsRefundsReport() {
  usePrintLayout("landscape", 8);
  const { hasPermission } = usePermissions();
  const today = todayBusinessDate();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [refundFor, setRefundFor] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payments-refunds-report", from, to, method, search],
    queryFn: async () => (await api.get(`/reports/payments-refunds?from=${from}&to=${to}&method=${encodeURIComponent(method)}&search=${encodeURIComponent(search)}`)).data.data,
  });
  const canRefund = hasPermission("REFUNDS", "CREATE");
  const methods = useMemo(() => ["CASH", "UPI", "CARD", "RAZORPAY", "BANK_TRANSFER", "CHEQUE", "OTHER"], []);
  const period = `${format(parseISO(from), "dd MMM yyyy")} to ${format(parseISO(to), "dd MMM yyyy")}`;

  const csv = () => {
    if (!data) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Date", "Type", "Booking", "Guest", "Method", "Reference", "Status", "Amount", "Refunded", "Note"];
    const lines = [head.map(esc).join(",")];
    for (const r of data.rows) lines.push([format(new Date(r.at), "dd-MM-yyyy HH:mm"), KIND[r.kind].label, r.bookingRef, r.guest, r.method, r.reference, r.status, r.kind === "REFUND" ? -r.amount : r.amount, r.refunded, r.note].map(esc).join(","));
    lines.push(["", "", "", "", "", "", "Collected", data.totals.collected, "", ""].map(esc).join(","), ["", "", "", "", "", "", "Refunded", data.totals.refunded, "", ""].map(esc).join(","), ["", "", "", "", "", "", "Net", data.totals.net, "", ""].map(esc).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `payments-refunds-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 report-print">
      <ReportPrintHeader title="Payments & Refunds Report" period={period} />
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">From</label><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">To</label><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All</option>{methods.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select></div>
        <div className="flex-1 min-w-[180px]"><label className="block text-xs font-semibold text-gray-600 mb-1">Search</label><Input placeholder="Booking no., guest, reference…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Button variant="outline" onClick={csv} disabled={!data}><Download className="w-4 h-4 mr-1.5" /> Export CSV</Button>
        <Button onClick={() => window.print()} className="bg-black text-[#e5c76b]"><Printer className="w-4 h-4 mr-1.5" /> Print</Button>
        {canRefund && <Button variant="destructive" onClick={() => setRefundFor("")}><RefreshCcw className="w-4 h-4 mr-1.5" /> Initiate refund</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-hotel-gold" size={28} /></div>
      ) : error || !data ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load the report.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Collected", data.totals.collected, "text-gray-900", `${data.totals.payments} payments · ${data.totals.advances} advances`],
              ["Refunded", data.totals.refunded, "text-red-600", `${data.totals.refunds} refunds`],
              ["Net", data.totals.net, "text-green-700", "collected minus refunded"],
              ["Still refundable", data.totals.refundable, "text-gray-700", "on the payments listed"],
            ].map(([label, value, cls, sub]) => (
              <div key={String(label)} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${cls}`}>{inr(Number(value))}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {data.byMethod.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="text-left p-2">By method</th><th className="text-right p-2">Collected</th><th className="text-right p-2">Refunded</th><th className="text-right p-2">Net</th></tr></thead>
                <tbody>
                  {data.byMethod.map((m: any) => (
                    <tr key={m.method} className="border-t border-gray-100"><td className="p-2 font-medium">{String(m.method).replace("_", " ")}</td><td className="p-2 text-right tabular-nums">{inr(m.collected)}</td><td className="p-2 text-right tabular-nums text-red-600">{inr(m.refunded)}</td><td className="p-2 text-right tabular-nums font-semibold">{inr(m.net)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left p-2">Date</th><th className="text-left p-2">Type</th><th className="text-left p-2">Booking</th><th className="text-left p-2">Guest</th>
                  <th className="text-left p-2">Method</th><th className="text-left p-2">Reference</th><th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Amount</th><th className="text-right p-2">Refunded</th><th className="p-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-gray-500">No payments or refunds in this period.</td></tr>}
                {data.rows.map((r: any) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-t border-gray-100 align-top">
                    <td className="p-2 whitespace-nowrap">{format(new Date(r.at), "dd-MM-yyyy HH:mm")}</td>
                    <td className="p-2 whitespace-nowrap"><Badge variant="outline" className={KIND[r.kind].cls}>{KIND[r.kind].label}</Badge></td>
                    <td className="p-2 font-mono text-xs whitespace-nowrap">{r.bookingRef || "–"}</td>
                    <td className="p-2 min-w-[170px]">{r.guest || "–"}{r.note && <div className="text-[11px] text-gray-500">{r.note}</div>}</td>
                    <td className="p-2 whitespace-nowrap">{String(r.method || "–").replace("_", " ")}</td>
                    <td className="p-2 font-mono text-[11px] whitespace-nowrap">{r.reference || "–"}</td>
                    <td className="p-2 text-xs whitespace-nowrap">{String(r.status).replace("_", " ")}</td>
                    <td className={`p-2 text-right tabular-nums font-medium whitespace-nowrap ${r.kind === "REFUND" ? "text-red-600" : ""}`}>{r.kind === "REFUND" ? "−" : ""}{inr(r.amount)}</td>
                    <td className="p-2 text-right tabular-nums text-gray-600 whitespace-nowrap">{r.refunded > 0 ? inr(r.refunded) : "–"}</td>
                    <td className="p-2 text-right whitespace-nowrap print:hidden">
                      {r.kind === "PAYMENT" && r.refundable > 0 && canRefund && (
                        <Button size="sm" variant="outline" className="text-red-700 border-red-200" onClick={() => setRefundFor(r.bookingRef)}>Refund</Button>
                      )}
                      {r.kind === "ADVANCE" && <Link to="/admin/advances" className="text-xs text-blue-700 underline">Advance deposits</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500">Collected = booking payments and advance deposits received in the period. Refunded = refunds started in the period (failed ones are not counted). Advance deposits are refunded from Advance Deposits.</p>
        </>
      )}

      <RefundDialog open={refundFor !== null} onOpenChange={(o) => !o && setRefundFor(null)} bookingRef={refundFor ?? ""} onDone={() => setRefundFor(null)} />
    </div>
  );
}
