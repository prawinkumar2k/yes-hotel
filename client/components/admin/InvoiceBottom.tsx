import { format } from "date-fns";
import type { Settlement } from "@/lib/invoiceSettlement";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dm = (d: any) => { try { return format(new Date(d), "dd.MM"); } catch { return ""; } };

/** Payments grouped by date and method, so six payments of one amount read as one line. */
function groupPayments(lines: any[], fallbackMode = "—") {
  const map = new Map<string, { date: any; mode: string; count: number; total: number }>();
  for (const l of lines) {
    const mode = l.paymentMode || fallbackMode;
    const key = `${dm(l.date)}|${mode}`;
    const cur = map.get(key) ?? { date: l.date, mode, count: 0, total: 0 };
    cur.count += 1; cur.total += Number(l.amount) || 0;
    map.set(key, cur);
  }
  return [...map.values()];
}

interface Props {
  s: Settlement;
  grandTotal: number;
  advancesList: any[];
  checkInDate: any;
  primaryAdvance: any;
  discount?: { amount: number; type?: string; value?: number; reason?: string };
  fnbTotal: number;
  amountInWords: string;
}

/** "Payments and balance" block of the GST invoice: every figure on one line, totals on the right. */
export default function InvoiceBottom({ s, grandTotal, advancesList, checkInDate, primaryAdvance, discount, fnbTotal, amountInWords }: Props) {
  const advanceRows = s.advanceLines.length > 0 ? groupPayments(s.advanceLines, "ADV") : [];
  const settleRows = groupPayments(s.settlementLines);
  const refundRows = groupPayments(s.refundLines, "Refund");

  // Money received (advance + settlement) by method; refunds shown separately so nothing is hidden.
  const byMode = new Map<string, number>();
  const add = (mode: string | undefined, amt: number) => byMode.set(mode || "Not recorded", (byMode.get(mode || "Not recorded") || 0) + (Number(amt) || 0));
  if (s.advanceLines.length > 0) s.advanceLines.forEach((l) => add(l.paymentMode, l.amount));
  else advancesList.forEach((x) => add(x.method, x.amount));
  s.settlementLines.forEach((l) => add(l.paymentMode, l.amount));

  const rows: Array<[string, string, string?]> = [
    ["Total Bill", inr(grandTotal)],
    ["Advance", inr(s.advanceTotal)],
    ["Paid at checkout", inr(s.settlementTotal)],
  ];
  if (s.refundTotal > 0) rows.push(["Less: Refunded", `-${inr(s.refundTotal)}`]);
  rows.push(["Round Off", inr(s.roundOff)]);

  return (
    <div className="flex break-inside-avoid">
      <div className="w-3/4 border-r border-black p-1 flex flex-col justify-between min-h-[8rem]">
        <div className="space-y-0.5 text-[9px]">
          <div className="flex font-bold">
            <div className="w-24 shrink-0 text-[10px]">Advance</div>
            <div className="flex-1 font-mono">
              {advanceRows.length > 0
                ? advanceRows.map((a, i) => <span key={i} className="mr-2 whitespace-nowrap">| {dm(a.date)}. Rs.{inr(a.total)} ({a.mode}){a.count > 1 ? ` ×${a.count}` : ""}</span>)
                : s.advanceTotal > 0
                  ? <span>| {dm(checkInDate)}. Rs.{inr(s.advanceTotal)} ({primaryAdvance?.advanceNumber || "ADV"}): {primaryAdvance?.method || primaryAdvance?.paymentMode || "—"}</span>
                  : <span>-</span>}
            </div>
          </div>
          {discount && discount.amount > 0 && (
            <div className="flex font-bold">
              <div className="w-24 shrink-0 text-[10px]">Discount</div>
              <div className="flex-1 font-mono">Rs.{discount.amount.toFixed(2)}{discount.type === "PERCENT" ? ` (${discount.value}%)` : ""} already deducted from the tariff{discount.reason ? ` — ${discount.reason}` : ""}</div>
            </div>
          )}
          {settleRows.length > 0 && (
            <div className="flex font-bold">
              <div className="w-24 shrink-0 text-[10px] text-gray-700">Paid at checkout</div>
              <div className="flex-1 font-mono text-green-800">
                {settleRows.map((p, i) => <span key={i} className="mr-2 whitespace-nowrap">| {dm(p.date)}. Rs.{inr(p.total)} ({p.mode}){p.count > 1 ? ` ×${p.count}` : ""}</span>)}
              </div>
            </div>
          )}
          {refundRows.length > 0 && (
            <div className="flex font-bold">
              <div className="w-24 shrink-0 text-[10px] text-red-700">Refunded to guest</div>
              <div className="flex-1 font-mono text-red-700">
                {refundRows.map((p, i) => <span key={i} className="mr-2 whitespace-nowrap">| {dm(p.date)}. Rs.{inr(p.total)} returned</span>)}
                <span className="font-sans font-normal">(not a charge: it is deducted from the amount received)</span>
              </div>
            </div>
          )}
          <div className="pt-1">
            <span className="font-bold">Received by mode: </span>
            <span className="font-mono">
              {byMode.size === 0 ? "— No payment received yet" : [...byMode.entries()].map(([m, v]) => `${m} ₹${inr(v)}`).join("  |  ")}
              {s.refundTotal > 0 ? `  |  Refunded −₹${inr(s.refundTotal)}  |  Net kept ₹${inr(s.paidNet)}` : ""}
            </span>
          </div>
        </div>
        <div className="text-[10px] pt-1">
          <div className="font-bold flex">
            <span className="w-32 shrink-0">Balance Rupees:</span>
            <span className="uppercase font-mono text-[9px]">{amountInWords}</span>
          </div>
          <div>
            <span className="font-bold">Service Bills:</span>
            <span className="text-[9px] ml-1 font-mono">{fnbTotal > 0 ? `|${format(new Date(), "dd.MM")}. Rs.${fnbTotal} (#POS) |` : "— None recorded"}</span>
          </div>
        </div>
      </div>

      <div className="w-1/4 flex flex-col">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-1 border-b border-black font-bold items-center">
            <div className="w-3/5 px-1 py-0.5 border-r border-black h-full flex items-center">{label}</div>
            <div className="w-2/5 px-1 py-0.5 text-right tabular-nums">{value}</div>
          </div>
        ))}
        <div className="flex flex-1 font-bold bg-gray-50 items-center">
          <div className="w-3/5 px-1 py-0.5 border-r border-black h-full flex items-center font-black">Net Balance</div>
          <div className="w-2/5 px-1 py-0.5 text-right font-black text-sm tabular-nums">{inr(s.roundedNet)}</div>
        </div>
      </div>
    </div>
  );
}
