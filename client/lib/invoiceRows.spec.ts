import { describe, expect, it } from "vitest";
import { buildInvoiceRows } from "./invoiceRows";

describe("GST invoice rows", () => {
  it("a stay posted at once prints one row per night, each with its own CGST and SGST", () => {
    const posted = "2026-10-17T09:00:00";
    const rows = buildInvoiceRows([
      { lineType: "ROOM_CHARGE", amount: 2876.2, date: posted, coversNights: ["2026-10-17", "2026-10-18"] },
      { lineType: "TAX_CGST", amount: 71.9, date: posted },
      { lineType: "TAX_SGST", amount: 71.9, date: posted },
    ], "101");
    expect(rows.map((r) => r.description)).toEqual(["101 17-Oct", "101 18-Oct"]);
    expect(rows[0]).toMatchObject({ tariff: 1438.1, cgst: 35.95, sgst: 35.95 });
    expect(rows[1]).toMatchObject({ tariff: 1438.1, cgst: 35.95, sgst: 35.95 });
    const total = rows.reduce((t, r) => t + r.tariff + r.cgst + r.sgst, 0);
    expect(total).toBeCloseTo(3020, 2);
  });

  it("a later extension night gets its own row with its GST", () => {
    const rows = buildInvoiceRows([
      { lineType: "ROOM_CHARGE", amount: 1438.1, date: "2026-10-17T09:00:00", coversNights: ["2026-10-17"] },
      { lineType: "TAX_CGST", amount: 35.95, date: "2026-10-17T09:00:00" },
      { lineType: "TAX_SGST", amount: 35.95, date: "2026-10-17T09:00:00" },
      { lineType: "ROOM_CHARGE", amount: 1438.1, date: "2026-10-18T10:00:00", coversNights: ["2026-10-18"] },
      { lineType: "TAX_CGST", amount: 35.95, date: "2026-10-18T10:00:00" },
      { lineType: "TAX_SGST", amount: 35.95, date: "2026-10-18T10:00:00" },
    ], "101");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.cgst === 35.95 && r.sgst === 35.95)).toBe(true);
  });
});
