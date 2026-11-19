import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Loader2, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { addDays, todayBusinessDate } from "@shared/dates";
import ReportPrintHeader, { ReportSignOff } from "@/components/admin/ReportPrintHeader";
import { usePrintLayout } from "@/lib/usePrintLayout";

type Row = { key: string; label: string; amount: number; discount: number; taxVal: number; cgst: number; sgst: number; vat: number; roff: number; total: number };
type Data = {
  from: string; to: string; days: number;
  departments: { name: string; rows: Row[]; subtotal: Row }[];
  grand: Row; totalCollection: number; taxCollection: number; averagePerDay: number; monthAverage: number;
};

const num = (n: number) => (n ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");
const d = (v: string) => format(new Date(`${v}T00:00:00`), "dd-MMM-yy");
const COLS: [keyof Row, string][] = [["amount", "Amount"], ["discount", "Discount"], ["taxVal", "Tax.Val"], ["cgst", "CGST"], ["sgst", "SGST"], ["vat", "VAT"], ["roff", "ROff"], ["total", "Total"]];

function csv(data: Data) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Department", "Item", ...COLS.map(([, l]) => l)].map(q).join(",")];
  for (const dep of data.departments) {
    for (const r of dep.rows) lines.push([dep.name, r.label, ...COLS.map(([k]) => (r[k] as number).toFixed(2))].map(q).join(","));
    lines.push([dep.name, "Sub total", ...COLS.map(([k]) => (dep.subtotal[k] as number).toFixed(2))].map(q).join(","));
  }
  lines.push(["", "Grand total", ...COLS.map(([k]) => (data.grand[k] as number).toFixed(2))].map(q).join(","));
  return lines.join("\r\n");
}

/** Revenue Summary: the hotel's revenue by department for a period (Amount, Discount, Tax value, CGST, SGST, VAT, round-off, Total). */
export default function RevenueSummaryReport() {
  usePrintLayout("portrait");
  const today = todayBusinessDate();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const { data, isLoading, error } = useQuery({
    queryKey: ["revenue-summary", from, to],
    queryFn: async () => (await api.get(`/reports/revenue-summary?from=${from}&to=${to}`)).data.data as Data,
    enabled: !!from && !!to && to >= from,
  });

  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob(["﻿" + csv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `revenue-summary-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 report-print mx-auto w-full max-w-[210mm]">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="hidden" />
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-gray-600">From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="block mt-1 px-1.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white" />
          </label>
          <label className="text-xs font-semibold text-gray-600">To
            <input type="date" value={to} min={from} max={addDays(today, 0)} onChange={(e) => setTo(e.target.value)} className="block mt-1 px-1.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white" />
          </label>
          <button type="button" onClick={download} disabled={!data} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"><Download size={14} /> Export CSV</button>
          <button type="button" onClick={() => window.print()} className="px-3 py-2 bg-black text-[#e5c76b] rounded-lg text-xs font-bold flex items-center gap-1.5"><Printer size={14} /> Print</button>
        </div>
      </div>
      <ReportPrintHeader title="Revenue Summary" period={`From : ${d(from)}  To : ${d(to)}`} />

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-hotel-gold" size={28} /></div>
      ) : error || !data ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load the report: {(error as any)?.response?.data?.message || (error as any)?.message || "choose a valid period"}</div>
      ) : (
        <>
          <div className="bg-white border border-gray-300 overflow-x-auto print:border-black">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="border border-gray-300 print:border-black px-1.5 py-1.5 text-left">Department</th>
                  {COLS.map(([k, l]) => <th key={k} className="border border-gray-300 print:border-black px-1.5 py-1.5 text-right">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.departments.map((dep, i) => (
                  <DeptBlock key={dep.name} n={i + 1} dep={dep} />
                ))}
                <tr className="font-bold bg-gray-50 print:bg-gray-100">
                  <td className="border border-gray-300 print:border-black px-1.5 py-1.5">Grand total</td>
                  {COLS.map(([k]) => <td key={k} className="border border-gray-300 print:border-black px-1.5 py-1.5 text-right tabular-nums">{num(data.grand[k] as number)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-sm bg-white border border-gray-300 print:border-black text-sm">
            {([["Total Collection", data.totalCollection], ["Tax Collection", data.taxCollection], [`Average Per Day (${data.days} day${data.days === 1 ? "" : "s"})`, data.averagePerDay], ["Month Average", data.monthAverage]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex justify-between px-3 py-1.5 border-b last:border-b-0 border-gray-200 print:border-black">
                <span>{k}</span><span className="tabular-nums font-semibold">{num(v)}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-500">
            Charges only: refunds, payments and advances are not revenue. Room charges are counted for the nights they cover in the period. GST is shown against Room Sales.
            Discount is the discount given on stays that checked in during the period (Amount is before it). OTA Commission is a deduction on stays that checked in in the period.
            Month Average is the total divided by the days in the month of the end date.
          </p>
        </>
      )}
      <ReportSignOff />
    </div>
  );
}

function DeptBlock({ n, dep }: { n: number; dep: Data["departments"][number] }) {
  return (
    <>
      <tr className="bg-white"><td colSpan={9} className="border border-gray-300 print:border-black px-2 py-1 font-bold">{n}.{dep.name}</td></tr>
      {dep.rows.map((r) => (
        <tr key={r.key}>
          <td className="border border-gray-300 print:border-black px-2 py-1 pl-4">{r.label}</td>
          {COLS.map(([k]) => <td key={k} className="border border-gray-300 print:border-black px-2 py-1 text-right tabular-nums">{num(r[k] as number)}</td>)}
        </tr>
      ))}
      <tr className="font-bold bg-gray-50 print:bg-gray-100">
        <td className="border border-gray-300 print:border-black px-2 py-1 pl-4">Sub total</td>
        {COLS.map(([k]) => <td key={k} className="border border-gray-300 print:border-black px-2 py-1 text-right tabular-nums">{num(dep.subtotal[k] as number)}</td>)}
      </tr>
    </>
  );
}
