import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Download, Loader2, Printer } from "lucide-react";
import { api } from "@/lib/api";
import ReportPrintHeader from "@/components/admin/ReportPrintHeader";
import { usePrintLayout } from "@/lib/usePrintLayout";

type Col = { key: string; label: string; money?: boolean };
type Group = { title: string; cols: Col[] };

/** The daily MIS sheet in the hotel's Excel layout: rooms, receipts, who booked, sales and money by mode. */
const GROUPS: Group[] = [
  { title: "Rooms", cols: [
    { key: "checkIns", label: "Check In" }, { key: "checkOuts", label: "Check Out" }, { key: "occupancyRooms", label: "Occupancy Room" },
    { key: "occupancyPax", label: "Occupancy Pax" }, { key: "cancelled", label: "Cancelled" }, { key: "noShow", label: "No Show" },
  ] },
  { title: "Receipts", cols: [
    { key: "recAdvance", label: "Advance", money: true }, { key: "recPartial", label: "Partial", money: true },
    { key: "recFinal", label: "Final", money: true }, { key: "recTotal", label: "Total", money: true },
  ] },
  { title: "Reserved through", cols: [
    { key: "walkin", label: "Walk In" }, { key: "reserved", label: "Reserved" }, { key: "ota", label: "OTA" }, { key: "travel", label: "Travel" },
  ] },
  { title: "Sales", cols: [
    { key: "roomSales", label: "Room Sales", money: true }, { key: "fbSales", label: "F&B", money: true }, { key: "misc", label: "Misc.", money: true },
  ] },
  { title: "Money received", cols: [
    { key: "cash", label: "CASH", money: true }, { key: "card", label: "Paytm / Card", money: true }, { key: "upi", label: "HDFC QR / UPI", money: true },
    { key: "other", label: "Bank / Other", money: true }, { key: "kkm", label: "KKM", money: true }, { key: "otaPayment", label: "OTA Payment", money: true },
    { key: "modeTotal", label: "Total", money: true },
  ] },
  { title: "Adjustments", cols: [
    { key: "refunds", label: "Refunds", money: true }, { key: "expenses", label: "Expenses", money: true }, { key: "credit", label: "Credit (Kadan)", money: true },
    { key: "netCollection", label: "Net Collection", money: true },
  ] },
];
const money = (n: number) => (n ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–");

export default function MisSheetReport() {
  usePrintLayout("landscape", 6);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const { data, isLoading, error } = useQuery({
    queryKey: ["mis-sheet", month],
    queryFn: async () => (await api.get(`/reports/mis-sheet?month=${month}`)).data.data,
  });
  const allCols = GROUPS.flatMap((g) => g.cols);

  const csv = () => {
    if (!data) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Date", "Day", ...allCols.map((c) => c.label)].map(esc).join(",")];
    for (const d of data.days) lines.push([d.date, d.day, ...allCols.map((c) => d[c.key])].map(esc).join(","));
    lines.push(["TOTAL", "", ...allCols.map((c) => data.totals[c.key])].map(esc).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `mis-sheet-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 report-print">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-900">MIS Daily Sheet</h2>
          <p className="text-xs text-gray-500">Day-by-day rooms, receipts, who booked, sales and money received, in the hotel's sheet layout</p>
        </div>
        <div className="flex items-end gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white" />
          <button type="button" onClick={csv} disabled={!data} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Download size={14} /> Export CSV</button>
          <button type="button" onClick={() => window.print()} className="px-3 py-2 bg-black text-[#e5c76b] rounded-lg text-xs font-bold flex items-center gap-1.5"><Printer size={14} /> Print</button>
        </div>
      </div>
      <ReportPrintHeader title="MIS Daily Sheet" period={format(parseISO(`${month}-01`), "MMMM yyyy")} />

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-hotel-gold" size={28} /></div>
      ) : error || !data ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load the MIS sheet.</div>
      ) : (
        <div className="bg-white border border-gray-300 overflow-x-auto print:border-black">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-100 text-center">
                <th rowSpan={2} className="border border-gray-400 px-2 py-1 text-left">Date</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1">Day</th>
                {GROUPS.map((g) => <th key={g.title} colSpan={g.cols.length} className="border border-gray-400 px-2 py-1 uppercase tracking-wide">{g.title}</th>)}
              </tr>
              <tr className="bg-gray-50 text-center">
                {allCols.map((c) => <th key={c.key} className="border border-gray-400 px-1.5 py-1 font-semibold">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.days.map((d: any) => {
                const sunday = d.day === "Sun";
                return (
                  <tr key={d.date} className="hover:bg-yellow-50/50">
                    <td className="border border-gray-300 px-2 py-0.5 whitespace-nowrap">{format(parseISO(d.date), "dd-MM-yyyy")}</td>
                    <td className={`border border-gray-300 px-2 py-0.5 text-center font-semibold ${sunday ? "text-red-600" : ""}`}>{d.day.toUpperCase()}</td>
                    {allCols.map((c) => <td key={c.key} className={`border border-gray-300 px-1.5 py-0.5 tabular-nums ${c.money ? "text-right" : "text-center"}`}>{c.money ? money(d[c.key]) : d[c.key] || "–"}</td>)}
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-bold">
                <td colSpan={2} className="border border-gray-400 px-2 py-1 text-center">Total</td>
                {allCols.map((c) => <td key={c.key} className={`border border-gray-400 px-1.5 py-1 tabular-nums ${c.money ? "text-right" : "text-center"}`}>{c.money ? money(data.totals[c.key]) : data.totals[c.key] || "–"}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-gray-500">
        Money received = payments, advances and counter sales by the day they were received. OTA Payment = amounts the OTA collected for OTA-prepaid check-ins of the day. KKM = Kovai Kongu Mess counter sales.
        Room Sales are spread over the nights each room charge covers. Credit is what guests left unpaid on that day.
      </p>
    </div>
  );
}
