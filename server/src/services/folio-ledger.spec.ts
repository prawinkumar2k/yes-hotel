import { describe, expect, it } from "vitest";
import { computeFolioTotals, financialYear, formatInvoiceNumber } from "./folio-ledger";

const L = (id: string, lineType: string, amount: number, reversedLineId?: string) => ({ _id: id, lineType, amount, reversedLineId });

describe("folio ledger", () => {
  it("balance = charges + tax + refunds − discounts − paid − advances", () => {
    const t = computeFolioTotals([
      L("1", "ROOM_CHARGE", 5000), L("2", "TAX_CGST", 450), L("3", "TAX_SGST", 450),
      L("4", "DISCOUNT", 500), L("5", "PAYMENT", 3000), L("6", "ADVANCE_ADJUSTMENT", 1000),
    ]);
    expect(t).toMatchObject({ totalCharges: 5000, totalTax: 900, cgst: 450, sgst: 450, totalDiscounts: 500, totalPaid: 3000, totalAdvanceAdjusted: 1000, balance: 1400 });
  });

  it("a refund returns a guest credit to zero (refund is a debit)", () => {
    const t = computeFolioTotals([L("1", "ROOM_CHARGE", 2000), L("2", "PAYMENT", 2500), L("3", "REFUND", 500)]);
    expect(t.balance).toBe(0);
    expect(t.totalRefunded).toBe(500);
  });

  it("a reversal undoes the reversed line in its own bucket", () => {
    const pay = computeFolioTotals([L("1", "ROOM_CHARGE", 2000), L("2", "PAYMENT", 2000), L("3", "REVERSAL", 2000, "2")]);
    expect(pay.totalPaid).toBe(0);
    expect(pay.totalCharges).toBe(2000);
    expect(pay.balance).toBe(2000);
    const chg = computeFolioTotals([L("1", "MINIBAR", 300), L("2", "REVERSAL", 300, "1")]);
    expect(chg.balance).toBe(0);
  });

  it("rounds to paise without float drift", () => {
    const t = computeFolioTotals([L("1", "ROOM_CHARGE", 0.1), L("2", "ROOM_CHARGE", 0.2), L("3", "PAYMENT", 0.3)]);
    expect(t.balance).toBe(0);
  });

  it("financial year and invoice format", () => {
    expect(financialYear("2026-10-13")).toBe("2026-27");
    expect(financialYear("2027-03-31")).toBe("2026-27");
    expect(financialYear("2027-04-01")).toBe("2027-28");
    expect(formatInvoiceNumber("YES", "2026-27", 42)).toBe("YES/2026-27/000042");
  });
});
