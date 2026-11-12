import { describe, expect, it } from "vitest";
import { compactInvoiceNumbers, computeSettlement, isStayChargeLine } from "./invoiceSettlement";

// The disputed bill: 7 rooms x 2010.01 = 14070.07 (incl. GST), advance 14070.07 by UPI,
// six settlement payments of 2010.01 at checkout and one "Checkout Refund" of 12060.06 posted as a DEBIT line.
const room = (n: number) => ({ direction: "DEBIT", lineType: "ROOM_CHARGE", amount: 2010.01, description: `30${n}` });
const lines = [
  ...[2, 3, 4, 5, 6, 7, 10].map(room),
  { direction: "DEBIT", lineType: "REFUND", amount: 12060.06, description: "Checkout Refund", paymentMode: "CASH" },
  { direction: "CREDIT", lineType: "ADVANCE_ADJUSTMENT", amount: 14070.07, paymentMode: "UPI", description: "Advance" },
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ direction: "CREDIT", lineType: "PAYMENT", amount: 2010.01, paymentMode: i <= 2 ? "UPI" : "CASH", description: "Checkout Payment" })),
];

describe("invoice settlement", () => {
  it("a refund is never a charge", () => {
    expect(lines.filter(isStayChargeLine)).toHaveLength(7);
  });
  it("bill 14070.07, advance 14070.07, refund deducted, balance 0", () => {
    const grand = 14070.07;
    const s = computeSettlement({ lines, advancesList: [], grandTotal: grand });
    expect(s.advanceTotal).toBe(14070.07);
    expect(s.settlementTotal).toBe(12060.06);
    expect(s.refundTotal).toBe(12060.06);
    expect(s.paidNet).toBe(14070.07);
    expect(s.net).toBe(0);
    expect(s.creditHeld).toBe(0);
  });
  it("part payment: bill 17000, advance 4000, nothing else paid -> balance 13000", () => {
    const s = computeSettlement({ lines: [{ direction: "CREDIT", lineType: "ADVANCE_ADJUSTMENT", amount: 4000 }], advancesList: [], grandTotal: 17000 });
    expect(s.net).toBe(13000);
  });
  it("a refund line stored as CREDIT is still a refund, not a payment", () => {
    const s = computeSettlement({ lines: [{ direction: "CREDIT", lineType: "REFUND", amount: 500, description: "Checkout Refund" }, { direction: "CREDIT", lineType: "PAYMENT", amount: 1500 }], advancesList: [], grandTotal: 1000 });
    expect(s.settlementTotal).toBe(1500);
    expect(s.refundTotal).toBe(500);
    expect(s.net).toBe(0);
  });
  it("compacts consecutive invoice numbers", () => {
    const nos = [14, 15, 17, 13, 18, 16, 12].map((n) => `INV/2026-27/${String(n).padStart(6, "0")}`);
    expect(compactInvoiceNumbers(nos)).toBe("INV/2026-27/000012 to 000018 (7 invoices)");
    expect(compactInvoiceNumbers(["INV/1", "INV/3"])).toBe("INV/1 / INV/3");
    expect(compactInvoiceNumbers(["INV/2026-27/000012"])).toBe("INV/2026-27/000012");
  });
});
