/**
 * Folio ledger: the one place folio totals and balance are computed.
 *
 *   DEBIT  (raise the balance): charges, taxes, and REFUNDS (money returned to the guest
 *          reduces the credit they hold).
 *   CREDIT (lower the balance): payments, advance adjustments, discounts, complimentary.
 *   REVERSAL: undoes one earlier line (reversedLineId) in that line's own bucket.
 *
 *   balance = charges + tax + refunds − discounts − paid − advances
 *   > 0 guest owes · < 0 hotel owes the guest (refund or deposit) · 0 settled.
 *
 * Line effects are determined by line type, not by the stored direction, so legacy
 * REFUND lines stored as CREDIT are counted correctly.
 */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LedgerLine {
  _id?: unknown;
  lineType: string;
  direction?: string;
  amount: number;
  reversedLineId?: unknown;
}

export interface FolioTotals {
  totalCharges: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalDiscounts: number;
  totalPaid: number;
  totalAdvanceAdjusted: number;
  totalRefunded: number;
  balance: number;
}

type Bucket = "charges" | "cgst" | "sgst" | "igst" | "discounts" | "paid" | "advances" | "refunds";

export function bucketFor(lineType: string): Bucket {
  switch (lineType) {
    case "TAX_CGST": return "cgst";
    case "TAX_SGST": return "sgst";
    case "TAX_IGST": return "igst";
    case "DISCOUNT":
    case "COMPLIMENTARY": return "discounts";
    case "PAYMENT": return "paid";
    case "ADVANCE_ADJUSTMENT": return "advances";
    case "REFUND": return "refunds";
    default: return "charges";
  }
}

export function computeFolioTotals(lines: LedgerLine[]): FolioTotals {
  const b: Record<Bucket, number> = { charges: 0, cgst: 0, sgst: 0, igst: 0, discounts: 0, paid: 0, advances: 0, refunds: 0 };
  const byId = new Map(lines.filter((l) => l._id != null).map((l) => [String(l._id), l]));
  for (const l of lines) {
    if (l.lineType === "REVERSAL") {
      const original = l.reversedLineId != null ? byId.get(String(l.reversedLineId)) : undefined;
      // Legacy reversals with no target reduced charges.
      b[original ? bucketFor(original.lineType) : "charges"] -= l.amount;
      continue;
    }
    b[bucketFor(l.lineType)] += l.amount;
  }
  const totalTax = b.cgst + b.sgst + b.igst;
  return {
    totalCharges: r2(b.charges),
    totalTax: r2(totalTax),
    cgst: r2(b.cgst),
    sgst: r2(b.sgst),
    igst: r2(b.igst),
    totalDiscounts: r2(b.discounts),
    totalPaid: r2(b.paid),
    totalAdvanceAdjusted: r2(b.advances),
    totalRefunded: r2(b.refunds),
    balance: r2(b.charges + totalTax + b.refunds - b.discounts - b.paid - b.advances),
  };
}

/** Indian financial year label (April–March) for a business date, e.g. 2026-10-13 → "2026-27". */
export function financialYear(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(6, "0")}`;
}
