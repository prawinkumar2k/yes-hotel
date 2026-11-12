/**
 * How a GST invoice shows what the guest has paid.
 *
 * A "Checkout Refund" is money handed BACK to the guest. In the folio it is a REFUND line (stored as a debit, so the
 * folio can balance), but it is NOT a charge for the stay. It must never be added to the invoice total.
 *   Bill total          = room charges + tax + extras           (REFUND lines excluded)
 *   Paid (net)          = advance + payments at checkout - refunds
 *   Balance             = Bill total - Paid (net)
 */
export interface SettlementInput {
  lines: any[];
  advancesList: any[];
  bookingAdvanceAmount?: number;
  grandTotal: number;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const isRefund = (l: any) => l?.lineType === "REFUND";

/** Lines that are charges for the stay (everything except money received or returned). */
export const isStayChargeLine = (l: any) => l.direction !== "CREDIT" && !isRefund(l);

export function computeSettlement({ lines, advancesList, bookingAdvanceAmount = 0, grandTotal }: SettlementInput) {
  const advanceLines = lines.filter((l) => !isRefund(l) && l.direction === "CREDIT" && (l.lineType === "ADVANCE_ADJUSTMENT" || l.lineType === "ADVANCE" || l.description?.toLowerCase().includes("adv")));
  const settlementLines = lines.filter((l) => !isRefund(l) && l.direction === "CREDIT" && !advanceLines.includes(l) && (l.lineType === "PAYMENT" || l.description?.toLowerCase().includes("checkout") || l.description?.toLowerCase().includes("settl")));
  const refundLines = lines.filter(isRefund);

  const sum = (xs: any[]) => r2(xs.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const advanceFromLines = sum(advanceLines);
  const advanceFromList = r2(advancesList.reduce((s, a) => s + (a.amount || 0), 0));
  const advanceTotal = advanceFromLines > 0 ? advanceFromLines : advanceFromList > 0 ? advanceFromList : r2(bookingAdvanceAmount);
  const settlementTotal = sum(settlementLines);
  const refundTotal = sum(refundLines);

  const received = r2(advanceTotal + settlementTotal);
  const paidNet = r2(received - refundTotal);
  const net = Math.max(0, r2(grandTotal - paidNet));
  const roundedNet = Math.round(net);
  return {
    advanceLines, settlementLines, refundLines,
    advanceTotal, settlementTotal, refundTotal, received, paidNet,
    net, roundedNet, roundOff: r2(roundedNet - net),
    /** Money the hotel holds above the bill (a refund is still owed to the guest). */
    creditHeld: Math.max(0, r2(paidNet - grandTotal)),
  };
}

export type Settlement = ReturnType<typeof computeSettlement>;

/** Several INV numbers in a row become one short range: INV/2026-27/000012 to 000018 (7 invoices). */
export function compactInvoiceNumbers(nos: string[]): string {
  const list = [...new Set(nos.filter(Boolean))];
  if (list.length <= 1) return list[0] || "";
  const parsed = list.map((n) => {
    const m = n.match(/^(.*?)(\d+)$/);
    return m ? { prefix: m[1], num: Number(m[2]), width: m[2].length } : null;
  });
  if (parsed.every(Boolean) && parsed.every((p) => p!.prefix === parsed[0]!.prefix)) {
    const nums = parsed.map((p) => p!.num).sort((a, b) => a - b);
    const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    if (contiguous) {
      const w = parsed[0]!.width;
      const pad = (n: number) => String(n).padStart(w, "0");
      return `${parsed[0]!.prefix}${pad(nums[0])} to ${pad(nums[nums.length - 1])} (${nums.length} invoices)`;
    }
  }
  return list.join(" / ");
}
