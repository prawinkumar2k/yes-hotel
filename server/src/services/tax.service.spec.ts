import { describe, expect, it } from "vitest";
import {
  DEFAULT_GST_RULES as R,
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
