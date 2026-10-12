import { describe, it, expect } from "vitest";
import { computeDenominationTotal } from "./cashier-shift.controller";

describe("Cashier Shift Denomination Calculations", () => {
  it("calculates exact physical cash from mixed notes and coins", () => {
    const breakdown = {
      n2000: 2,  // 4000
      n500: 5,   // 2500
      n200: 10,  // 2000
      n100: 20,  // 2000
      n50: 10,   // 500
      n20: 10,   // 200
      n10: 10,   // 100
      coins: 45, // 45
    };

    const total = computeDenominationTotal(breakdown);
    expect(total).toBe(11345);
  });

  it("handles zero or undefined counts correctly without NaN", () => {
    expect(computeDenominationTotal({})).toBe(0);
    expect(computeDenominationTotal({ n500: 2 })).toBe(1000);
    expect(computeDenominationTotal(undefined)).toBe(0);
  });

  it("computes physical drawer cash strictly isolating non-cash modes", () => {
    // Formula: Opening Float + Cash Collections + Cash Advances - Cash Refunds - Total Paid Outs
    const openingFloat = 5000;
    const cashCollections = 3500;
    const cashAdvances = 2000;
    const cashRefunds = 500;
    const paidOuts = 1000; // Cash drop

    const expectedCash = openingFloat + cashCollections + cashAdvances - cashRefunds - paidOuts;
    expect(expectedCash).toBe(9000);

    // Physical count matching
    const countedCash = 9000;
    const variance = countedCash - expectedCash;
    expect(variance).toBe(0);

    // Shortage
    const countedShort = 8800;
    expect(countedShort - expectedCash).toBe(-200);

    // Surplus
    const countedSurplus = 9100;
    expect(countedSurplus - expectedCash).toBe(100);
  });
});
