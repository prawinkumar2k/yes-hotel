import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Printer, Download } from "lucide-react";
import { api } from "@/lib/api";
import { todayBusinessDate, addDays } from "@shared/dates";

// ─── Shared building blocks ──────────────────────────────────────────────────

type Col<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
  align?: "right";
  money?: boolean;
};

const inr = (n: unknown) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (v: unknown) => (v ? format(new Date(v as string), "dd-MMM-yy HH:mm") : "");
const day = (v: unknown) => (v ? format(new Date(`${v}T00:00:00`), "dd-MMM-yy") : "");

function cell<T>(c: Col<T>, row: T) {
  const v = c.value(row);
  if (c.money) return inr(v);
  return v ?? "";
}

function toCsv<T>(cols: Col<T>[], rows: T[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(c.money ? Number(c.value(r) || 0).toFixed(2) : c.value(r))).join(","))].join("\r\n");
}

function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function useRange(defaultDays = 0, fixed?: { from: string; to: string }) {
  const today = todayBusinessDate();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, defaultDays));
  // `fixed`: embedded under another report (e.g. the Day Summary) for one chosen day; no date pickers.
  if (fixed) return { from: fixed.from, to: fixed.to, setFrom, setTo, fixed: true };
  return { from, to, setFrom, setTo, fixed: false };
}

function ReportShell(props: {
  title: string;
  subtitle: string;
  range: ReturnType<typeof useRange>;
  onCsv?: () => void;
  loading: boolean;
  error?: unknown;
  children: ReactNode;
}) {
  const { range } = props;
  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-end justify-between gap-3 ${range.fixed ? "" : "print:hidden"}`}>
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-900">{props.title}</h2>
          <p className="text-xs text-gray-500">{props.subtitle}</p>
        </div>
        <div className={`flex flex-wrap items-end gap-2 ${range.fixed ? "hidden" : ""}`}>
          <label className="text-xs font-semibold text-gray-600">
            From
            <input type="date" value={range.from} max={range.to} onChange={(e) => range.setFrom(e.target.value)} className="block mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white" />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            To
            <input type="date" value={range.to} min={range.from} onChange={(e) => range.setTo(e.target.value)} className="block mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white" />
          </label>
          <button type="button" onClick={props.onCsv} disabled={!props.onCsv} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Download size={14} /> Export CSV
          </button>
          <button type="button" onClick={() => window.print()} className="px-3 py-2 bg-black text-[#e5c76b] rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>
      <div className="hidden print:block text-center">
        <div className="font-serif text-xl font-black">YES HOTELS</div>
        <div className="font-bold">{props.title}</div>
        <div className="text-xs">{day(range.from)} to {day(range.to)}</div>
      </div>
      {props.loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-hotel-gold" size={28} /></div>
      ) : props.error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load the report: {(props.error as any)?.response?.data?.message || (props.error as any)?.message}</div>
      ) : (
        props.children
      )}
    </div>
  );
}

function SummaryCards({ items }: { items: [string, string | number][] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(([k, v]) => (
        <div key={k} className="bg-white border border-gray-200 rounded-xl p-3 print:border-black print:rounded-none">
          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{k}</div>
          <div className="text-lg font-bold font-serif tabular-nums text-gray-900">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Table<T>({ cols, rows, empty, totals }: { cols: Col<T>[]; rows: T[]; empty: string; totals?: Record<string, string | number> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto print:border-black print:rounded-none">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 print:bg-gray-100">
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap border-b border-gray-200 ${c.align === "right" || c.money ? "text-right" : "text-left"}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-gray-400">{empty}</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.align === "right" || c.money ? "text-right tabular-nums" : ""}`}>{cell(c, r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {totals && rows.length > 0 && (
          <tfoot className="bg-gray-50 font-bold">
            <tr>
              {cols.map((c, i) => (
                <td key={c.key} className={`px-3 py-2 whitespace-nowrap border-t border-gray-300 ${c.align === "right" || c.money ? "text-right tabular-nums" : ""}`}>
                  {i === 0 ? "TOTAL" : totals[c.key] !== undefined ? (c.money ? inr(totals[c.key]) : totals[c.key]) : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function useReport(path: string, from: string, to: string) {
  return useQuery({
    queryKey: ["ops-report", path, from, to],
    queryFn: async () => (await api.get(`/reports/ops/${path}?from=${from}&to=${to}`)).data.data,
  });
}

// ─── Check-in report ─────────────────────────────────────────────────────────
export function CheckInReport({ day: fixedDay }: { day?: string } = {}) {
  const range = useRange(0, fixedDay ? { from: fixedDay, to: fixedDay } : undefined);
  const { data, isLoading, error } = useReport("check-ins", range.from, range.to);
  const cols: Col<any>[] = [
    { key: "checkedInAt", label: "Checked In", value: (r) => dt(r.checkedInAt) },
    { key: "bookingReference", label: "Reservation", value: (r) => r.bookingReference },
    { key: "billNumber", label: "Bill No.", value: (r) => r.billNumber },
    { key: "guest", label: "Guest", value: (r) => r.guest },
    { key: "phone", label: "Mobile", value: (r) => r.phone },
    { key: "room", label: "Room", value: (r) => r.room },
    { key: "category", label: "Category", value: (r) => r.category },
    { key: "stayType", label: "Stay", value: (r) => r.stayType },
    { key: "departure", label: "Departure", value: (r) => day(r.departure) },
    { key: "nights", label: "Nights", value: (r) => r.nights, align: "right" },
    { key: "pax", label: "Pax", value: (r) => r.pax, align: "right" },
    { key: "source", label: "Source", value: (r) => r.source },
    { key: "ratePerNight", label: "Rate/Night", value: (r) => r.ratePerNight, money: true },
    { key: "totalAmount", label: "Booking Value", value: (r) => r.totalAmount, money: true },
    { key: "advance", label: "Advance", value: (r) => r.advance, money: true },
    { key: "checkedInBy", label: "By", value: (r) => r.checkedInBy },
  ];
  const t = data?.totals;
  return (
    <ReportShell title="Check-in Report" subtitle="Guests checked in during the selected days" range={range} loading={isLoading} error={error}
      onCsv={data ? () => downloadCsv(`check-ins-${range.from}-to-${range.to}.csv`, toCsv(cols, data.rows)) : undefined}>
      {t && <SummaryCards items={[["Check-ins", t.checkIns], ["Rooms", t.rooms], ["Guests", t.pax], ["Booking Value", inr(t.totalAmount)], ["Advance Taken", inr(t.advance)]]} />}
      <Table cols={cols} rows={data?.rows ?? []} empty="No check-ins in this period." totals={t ? { pax: t.pax, totalAmount: t.totalAmount, advance: t.advance } : undefined} />
    </ReportShell>
  );
}

// ─── Check-out report ────────────────────────────────────────────────────────
export function CheckOutReport({ day: fixedDay }: { day?: string } = {}) {
  const range = useRange(0, fixedDay ? { from: fixedDay, to: fixedDay } : undefined);
  const { data, isLoading, error } = useReport("check-outs", range.from, range.to);
  const cols: Col<any>[] = [
    { key: "checkedOutAt", label: "Checked Out", value: (r) => dt(r.checkedOutAt) },
    { key: "bookingReference", label: "Reservation", value: (r) => r.bookingReference },
    { key: "invoiceNumber", label: "Invoice No.", value: (r) => r.invoiceNumber || "—" },
    { key: "guest", label: "Guest", value: (r) => r.guest },
    { key: "room", label: "Room", value: (r) => r.room },
    { key: "category", label: "Category", value: (r) => r.category },
    { key: "arrival", label: "Arrived", value: (r) => day(r.arrival) },
    { key: "nights", label: "Nights", value: (r) => r.nights, align: "right" },
    { key: "billAmount", label: "Bill Amount", value: (r) => r.billAmount, money: true },
    { key: "tax", label: "GST", value: (r) => r.tax, money: true },
    { key: "received", label: "Received", value: (r) => r.received, money: true },
    { key: "refunded", label: "Refunded", value: (r) => r.refunded, money: true },
    { key: "balance", label: "Balance", value: (r) => r.balance, money: true },
    { key: "paymentModes", label: "Mode of Payment", value: (r) => r.paymentModes || "—" },
    { key: "checkedOutBy", label: "By", value: (r) => r.checkedOutBy },
  ];
  const t = data?.totals;
  return (
    <ReportShell title="Check-out Report" subtitle="Guests checked out during the selected days, with the bill and how it was paid" range={range} loading={isLoading} error={error}
      onCsv={data ? () => downloadCsv(`check-outs-${range.from}-to-${range.to}.csv`, toCsv(cols, data.rows)) : undefined}>
      {t && <SummaryCards items={[["Check-outs", t.checkOuts], ["Billed", inr(t.billAmount)], ["GST", inr(t.tax)], ["Received", inr(t.received)], ["Refunded", inr(t.refunded)], ["Balance", inr(t.balance)]]} />}
      <Table cols={cols} rows={data?.rows ?? []} empty="No check-outs in this period." totals={t ? { billAmount: t.billAmount, tax: t.tax, received: t.received, refunded: t.refunded, balance: t.balance } : undefined} />
    </ReportShell>
  );
}

// ─── Day-use / hourly sales report ───────────────────────────────────────────
export function DayUseSalesReport({ day: fixedDay }: { day?: string } = {}) {
  const range = useRange(0, fixedDay ? { from: fixedDay, to: fixedDay } : undefined);
  const { data, isLoading, error } = useReport("day-use-sales", range.from, range.to);
  const cols: Col<any>[] = [
    { key: "date", label: "Date", value: (r) => day(r.date) },
    { key: "timeIn", label: "In", value: (r) => (r.timeIn ? format(new Date(r.timeIn), "HH:mm") : "") },
    { key: "timeOut", label: "Out", value: (r) => (r.timeOut ? format(new Date(r.timeOut), "HH:mm") : "") },
    { key: "hours", label: "Hours", value: (r) => r.hours, align: "right" },
    { key: "bookingReference", label: "Reservation", value: (r) => r.bookingReference },
    { key: "guest", label: "Guest", value: (r) => r.guest },
    { key: "room", label: "Room", value: (r) => r.room },
    { key: "category", label: "Category", value: (r) => r.category },
    { key: "taxable", label: "Taxable", value: (r) => r.taxable, money: true },
    { key: "cgst", label: "CGST", value: (r) => r.cgst, money: true },
    { key: "sgst", label: "SGST", value: (r) => r.sgst, money: true },
    { key: "total", label: "Total", value: (r) => r.total, money: true },
    { key: "received", label: "Received", value: (r) => r.received, money: true },
    { key: "paymentModes", label: "Mode of Payment", value: (r) => r.paymentModes || "—" },
    { key: "status", label: "Status", value: (r) => r.status },
  ];
  const dayCols: Col<any>[] = [
    { key: "date", label: "Date", value: (r) => day(r.date) },
    { key: "stays", label: "Stays", value: (r) => r.stays, align: "right" },
    { key: "hours", label: "Hours Sold", value: (r) => r.hours, align: "right" },
    { key: "taxable", label: "Taxable", value: (r) => r.taxable, money: true },
    { key: "tax", label: "GST", value: (r) => r.tax, money: true },
    { key: "total", label: "Total", value: (r) => r.total, money: true },
  ];
  const t = data?.totals;
  return (
    <ReportShell title="Day / Hourly Sales Report" subtitle="Day-use (hourly) stays and their sales" range={range} loading={isLoading} error={error}
      onCsv={data ? () => downloadCsv(`day-use-sales-${range.from}-to-${range.to}.csv`, toCsv(cols, data.rows)) : undefined}>
      {t && <SummaryCards items={[["Stays", t.stays], ["Hours Sold", t.hours], ["Taxable", inr(t.taxable)], ["GST", inr(t.cgst + t.sgst)], ["Total Sales", inr(t.total)], ["Received", inr(t.received)]]} />}
      <h3 className="text-sm font-bold text-gray-700 pt-2">Day-wise summary</h3>
      <Table cols={dayCols} rows={data?.byDay ?? []} empty="No day-use stays in this period." totals={t ? { stays: t.stays, hours: t.hours, taxable: t.taxable, tax: Math.round((t.cgst + t.sgst) * 100) / 100, total: t.total } : undefined} />
      <h3 className="text-sm font-bold text-gray-700 pt-2">Stays</h3>
      <Table cols={cols} rows={data?.rows ?? []} empty="No day-use stays in this period." totals={t ? { hours: t.hours, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, total: t.total, received: t.received } : undefined} />
    </ReportShell>
  );
}

// ─── Advance report: received + expected ─────────────────────────────────────
export function AdvanceReport() {
  const range = useRange(7);
  const { data, isLoading, error } = useReport("advances", range.from, range.to);
  const receivedCols: Col<any>[] = [
    { key: "receivedAt", label: "Received", value: (r) => dt(r.receivedAt) },
    { key: "advanceNumber", label: "Receipt No.", value: (r) => r.advanceNumber },
    { key: "guest", label: "Guest", value: (r) => r.guest },
    { key: "phone", label: "Mobile", value: (r) => r.phone },
    { key: "bookingReference", label: "Reservation", value: (r) => r.bookingReference },
    { key: "room", label: "Room", value: (r) => r.room || "—" },
    { key: "arrival", label: "Arrival", value: (r) => (r.arrival ? day(r.arrival) : "—") },
    { key: "method", label: "Mode", value: (r) => r.method },
    { key: "reference", label: "Ref.", value: (r) => r.reference },
    { key: "amount", label: "Amount", value: (r) => r.amount, money: true },
    { key: "adjusted", label: "Adjusted", value: (r) => r.adjusted, money: true },
    { key: "refunded", label: "Refunded", value: (r) => r.refunded, money: true },
    { key: "balance", label: "Balance Held", value: (r) => r.balance, money: true },
    { key: "status", label: "Status", value: (r) => r.status },
    { key: "receivedBy", label: "By", value: (r) => r.receivedBy },
  ];
  const expectedCols: Col<any>[] = [
    { key: "arrival", label: "Arrival", value: (r) => day(r.arrival) },
    { key: "departure", label: "Departure", value: (r) => day(r.departure) },
    { key: "bookingReference", label: "Reservation", value: (r) => r.bookingReference },
    { key: "guest", label: "Guest", value: (r) => r.guest },
    { key: "phone", label: "Mobile", value: (r) => r.phone },
    { key: "room", label: "Room", value: (r) => r.room },
    { key: "category", label: "Category", value: (r) => r.category },
    { key: "source", label: "Source", value: (r) => r.source },
    { key: "bookingValue", label: "Booking Value", value: (r) => r.bookingValue, money: true },
    { key: "advanceReceived", label: "Advance Received", value: (r) => r.advanceReceived, money: true },
    { key: "balanceDue", label: "Balance Due", value: (r) => r.balanceDue, money: true },
    { key: "status", label: "Status", value: (r) => r.status },
  ];
  const t = data?.totals;
  return (
    <ReportShell title="Advance Report" subtitle="Advances received in the period, and arrivals in the period with the advance expected" range={range} loading={isLoading} error={error}
      onCsv={data ? () => {
        downloadCsv(`advances-received-${range.from}-to-${range.to}.csv`, toCsv(receivedCols, data.received));
        downloadCsv(`advances-expected-${range.from}-to-${range.to}.csv`, toCsv(expectedCols, data.expected));
      } : undefined}>
      {t && (
        <SummaryCards items={[
          ["Advances Received", t.received.count],
          ["Amount Received", inr(t.received.amount)],
          ["Balance Held", inr(t.received.balance)],
          ["Arrivals", t.expected.arrivals],
          ["Balance Due", inr(t.expected.balanceDue)],
          ["Arrivals w/o Advance", t.expected.withoutAdvance],
        ]} />
      )}
      <h3 className="text-sm font-bold text-gray-700 pt-2">Advances received</h3>
      <Table cols={receivedCols} rows={data?.received ?? []} empty="No advances received in this period." totals={t ? { amount: t.received.amount, adjusted: t.received.adjusted, refunded: t.received.refunded, balance: t.received.balance } : undefined} />
      <h3 className="text-sm font-bold text-gray-700 pt-2">Advance expected — arrivals in this period</h3>
      <Table cols={expectedCols} rows={data?.expected ?? []} empty="No pending arrivals in this period." totals={t ? { bookingValue: t.expected.bookingValue, advanceReceived: t.expected.advanceReceived, balanceDue: t.expected.balanceDue } : undefined} />
    </ReportShell>
  );
}
