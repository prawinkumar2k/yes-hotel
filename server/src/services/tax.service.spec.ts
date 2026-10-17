import { describe, expect, it } from "vitest";
import {
  DEFAULT_GST_RULES as R,
  DEFAULT_GST_RULES,
  computeChargeTax,
  netOfIncludedTax,
  computeRoomNightTax,
  computeRoomTax,
  computeSupplyTax,
  gstRate,
  splitTax,
  validateGstRules,
} from "./tax.service";

describe("room GST slabs (from 22 Sep 2025)", () => {
  it("≤ ₹7,500 per night is 5%, above is 18%", () => {
    expect(gstRate(R, "ROOM", "2026-10-12", 7500)).toBe(5);
    expect(gstRate(R, "ROOM", "2026-10-12", 7500.01)).toBe(18);
    expect(gstRate(R, "ROOM", "2026-10-12", 3500)).toBe(5);
  });
  it("uses the rule in force on the night's date", () => {
    expect(gstRate(R, "ROOM", "2025-09-21", 3500)).toBe(12);
    expect(gstRate(R, "ROOM", "2025-09-22", 3500)).toBe(5);
    expect(gstRate(R, "ROOM", "2025-09-21", 900)).toBe(0);
  });
  it("taxes a stay per night across the slab change date", () => {
    const t = computeRoomTax(R, { checkIn: "2025-09-21", checkOut: "2025-09-23", nightlyValue: 4000 });
    expect(t.lines.map((l) => l.rate)).toEqual([12, 5]);
    expect(t.tax).toBe(480 + 200);
  });
  it("selects the slab from the value after discount", () => {
    // A ₹8,000 room discounted to ₹7,000/night is in the 5% slab.
    const t = computeRoomTax(R, { checkIn: "2026-10-12", checkOut: "2026-10-14", nightlyValue: 7000 });
    expect(t.lines.every((l) => l.rate === 5)).toBe(true);
    expect(t).toMatchObject({ taxable: 14000, cgst: 350, sgst: 350, tax: 700, total: 14700 });
  });
  it("YES-BKG-3010 at ₹9,500/night for 2 nights is 18%", () => {
    const t = computeRoomTax(R, { checkIn: "2026-10-12T06:09:43Z", checkOut: "2026-10-14T06:09:43Z", nightlyValue: 9500 });
    expect(t).toMatchObject({ taxable: 19000, cgst: 1710, sgst: 1710, tax: 3420, total: 22420 });
  });
  it("multiplies by rooms but chooses the slab per room", () => {
    const t = computeRoomTax(R, { checkIn: "2026-10-12", checkOut: "2026-10-13", nightlyValue: 5000, rooms: 3 });
    expect(t).toMatchObject({ taxable: 15000, tax: 750 });
  });
  it("splits CGST and SGST equally", () => {
    const t = computeRoomNightTax(R, "2026-10-12", 1050);
    expect(t.cgst).toBe(26.25);
    expect(t.sgst).toBe(26.25);
    expect(t.total).toBe(1102.5);
  });
});

describe("other supplies", () => {
  it("restaurant food and guest services are 5% (CGST 2.5% + SGST 2.5%)", () => {
    expect(computeSupplyTax(R, "FOOD", "2026-10-12", 1000).tax).toBe(50);
    const service = computeSupplyTax(R, "SERVICE", "2026-10-12", 1000);
    expect(service.tax).toBe(50);
    expect([service.cgst, service.sgst]).toEqual([25, 25]);
  });
});

describe("splitTax", () => {
  it("halves add back up exactly", () => {
    const { cgst, sgst } = splitTax(0.05);
    expect(Math.round((cgst + sgst) * 100) / 100).toBe(0.05);
  });
});

describe("validateGstRules", () => {
  it("accepts the defaults", () => {
    expect(() => validateGstRules(R)).not.toThrow();
  });
  it("rejects overlapping periods", () => {
    expect(() =>
      validateGstRules([
        { category: "ROOM", effectiveFrom: "2025-01-01", bands: [{ upTo: null, rate: 12 }] },
        { category: "ROOM", effectiveFrom: "2025-09-22", bands: [{ upTo: null, rate: 5 }] },
      ]),
    ).toThrow(/overlap/);
  });
  it("rejects a non-terminal open band and out-of-range rates", () => {
    expect(() => validateGstRules([{ category: "FOOD", effectiveFrom: "2025-01-01", bands: [{ upTo: null, rate: 5 }, { upTo: 10, rate: 5 }] }])).toThrow();
    expect(() => validateGstRules([{ category: "FOOD", effectiveFrom: "2025-01-01", bands: [{ upTo: null, rate: 55 }] }])).toThrow();
  });
  it("fails loudly when no rule is in force", () => {
    expect(() => gstRate(R, "ROOM", "2010-01-01", 1000)).toThrow(/No ROOM GST rule/);
  });
});

describe("prices that include GST", () => {
  it("works the GST out of the rate: ₹1,510 = ₹1,438.10 + CGST ₹35.95 + SGST ₹35.95", () => {
    const r = computeRoomTax(DEFAULT_GST_RULES, { checkIn: "2026-10-17", checkOut: "2026-10-18", nightlyValue: 1510, inclusive: true });
    expect(r).toMatchObject({ taxable: 1438.1, cgst: 35.95, sgst: 35.95, tax: 71.9, total: 1510 });
  });
  it("the total always equals rate × nights × rooms", () => {
    for (const rate of [999, 1510, 2833.33, 6500, 7875, 7876, 9000]) {
      const r = computeRoomTax(DEFAULT_GST_RULES, { checkIn: "2026-10-17", checkOut: "2026-10-20", nightlyValue: rate, rooms: 2, inclusive: true });
      expect(r.total).toBeCloseTo(rate * 3 * 2, 2);
      expect(r.cgst + r.sgst).toBeCloseTo(r.tax, 2);
    }
  });
  it("picks the slab by the value excluding GST (₹7,875 incl. = ₹7,500 → 5%; above → 18%)", () => {
    expect(computeRoomTax(DEFAULT_GST_RULES, { checkIn: "2026-10-17", checkOut: "2026-10-18", nightlyValue: 7875, inclusive: true }).lines[0].rate).toBe(5);
    expect(computeRoomTax(DEFAULT_GST_RULES, { checkIn: "2026-10-17", checkOut: "2026-10-18", nightlyValue: 9000, inclusive: true }).lines[0].rate).toBe(18);
  });
  it("one night (night audit) and single charges work the same way", () => {
    expect(computeRoomNightTax(DEFAULT_GST_RULES, "2026-10-17", 1510, true)).toMatchObject({ taxable: 1438.1, tax: 71.9, total: 1510 });
    expect(computeChargeTax(DEFAULT_GST_RULES, "EXTRA_BED", 1050, "2026-10-17", { inclusive: true })).toMatchObject({ taxable: 1000, tax: 50, total: 1050 });
  });
  it("shares the included GST across charge lines exactly", () => {
    const nets = netOfIncludedTax([3020, 800, 400], 200.95);
    expect(nets.reduce((t, n) => t + n, 0)).toBeCloseTo(4220 - 200.95, 2);
    expect(nets.every((n, i) => n < [3020, 800, 400][i])).toBe(true);
  });
});
