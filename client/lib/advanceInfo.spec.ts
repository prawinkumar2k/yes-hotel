import { describe, expect, it } from "vitest";
import { advanceInfo, settlementKind } from "./advanceInfo";

describe("advanceInfo", () => {
  it("lists the advance receipts (net of refunds) when they are linked to the booking", () => {
    const r = advanceInfo({ advances: [{ advanceNumber: "ADV-202610-0010", amount: 1564.6, totalRefunded: 0, method: "CASH" }, { advanceNumber: "ADV-202610-0011", amount: 500, totalRefunded: 100, method: "UPI" }] });
    expect(r.numbers).toEqual(["ADV-202610-0010", "ADV-202610-0011"]);
    expect(r.total).toBeCloseTo(1964.6);
  });
  it("falls back to the credit lines on the bill (advance not linked to the booking) and finds the receipt number", () => {
    const r = advanceInfo({ lines: [{ direction: "CREDIT", lineType: "ADVANCE_ADJUSTMENT", amount: 1564.6, description: "Advance ADV-202610-0010 applied", paymentMode: "OTHER" }], booking: { advanceAmount: 0 } });
    expect(r.numbers).toEqual(["ADV-202610-0010"]);
    expect(r.total).toBeCloseTo(1564.6);
  });
  it("uses the amount stored on the booking when there is nothing else, and ignores voided advances", () => {
    expect(advanceInfo({ booking: { advanceAmount: 800 } }).total).toBe(800);
    expect(advanceInfo({ advances: [{ advanceNumber: "ADV-1", amount: 100, status: "VOIDED" }] }).total).toBe(0);
  });
});

describe("settlementKind", () => {
  it("ticks the box for the billing instruction, not the advance mode", () => {
    expect(settlementKind("CASH", "UPI")).toBe("CASH");
    expect(settlementKind("OTA Prepaid (VCC)", "")).toBe("NET");
    expect(settlementKind("", "UPI")).toBe("UPI");
    expect(settlementKind("", "", true)).toBe("NET");
    expect(settlementKind("", "")).toBe("");
  });
});
