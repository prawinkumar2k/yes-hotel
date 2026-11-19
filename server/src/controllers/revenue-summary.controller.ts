import type { Request, Response } from "express";
import { Booking, BookingStatus } from "../models/Booking";
import { CashierShift } from "../models/CashierShift";
import { FolioLine, FolioLineDirection, FolioLineType } from "../models/FolioLine";
import { addDays, businessDayRange, isBusinessDate, todayBusinessDate } from "../../../shared/dates";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const MAX_DAYS = 366;

type Row = { key: string; label: string; amount: number; discount: number; taxVal: number; cgst: number; sgst: number; vat: number; roff: number; total: number };
type Dept = { name: string; rows: Row[] };

const blank = (key: string, label: string): Row => ({ key, label, amount: 0, discount: 0, taxVal: 0, cgst: 0, sgst: 0, vat: 0, roff: 0, total: 0 });

/** Which revenue row a charge belongs to. */
function rowKey(lineType: string, description: string): string | null {
  switch (lineType) {
    case FolioLineType.ROOM_CHARGE:
    case FolioLineType.EXTRA_PERSON:
    case FolioLineType.EARLY_CHECK_IN:
    case FolioLineType.LATE_CHECK_OUT:
      return "roomSales";
    case FolioLineType.EXTRA_BED:
      return "extraBed";
    case FolioLineType.LAUNDRY:
      return "laundry";
    // The hotel has no restaurant, minibar, spa or transport. Should an old bill still carry such a charge, it is
    // kept under Other Charges so the totals stay right.
    case FolioLineType.RESTAURANT:
    case FolioLineType.MINIBAR:
    case FolioLineType.SPA:
    case FolioLineType.TRANSPORT:
      return "otherCharges";
    case FolioLineType.ADDON:
      return /^meal plan/i.test(description) ? "planCharges" : "otherCharges";
    default:
      return null; // payments, refunds, discounts, advances: not revenue
  }
}

/**
 * GET /api/reports/revenue-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Revenue by department for a period, in the hotel's classic "Revenue Summary" layout:
 * Amount, Discount, Tax value, CGST, SGST, VAT, round-off, Total.
 *
 * Rules (the same as the MIS sheet, so the two agree):
 *  - Charges only. A refund is money handed back, never revenue; payments and advances are not revenue.
 *  - Room charges are counted for the nights they cover inside the period; other charges on their date.
 *  - Corrections (reversals) reduce the department of the charge they correct.
 *  - GST is shown against Room Sales (the stay GST); Discount is the discount given on the stays that checked in
 *    in the period (the bill amounts are already net of it, so Amount = net + discount).
 *  - OTA commission is shown as a deduction, on the stays that checked in in the period.
 */
export const getRevenueSummary = async (req: Request, res: Response) => {
  try {
    const today = todayBusinessDate();
    const from = isBusinessDate(req.query.from) ? String(req.query.from) : `${today.slice(0, 7)}-01`;
    const to = isBusinessDate(req.query.to) ? String(req.query.to) : today;
    if (to < from) return res.status(400).json({ success: false, message: "The end date is before the start date" });

    const nights: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      nights.push(d);
      if (nights.length > MAX_DAYS) return res.status(400).json({ success: false, message: `Choose a period of at most ${MAX_DAYS} days` });
    }
    const start = businessDayRange(from).start;
    const end = businessDayRange(to).end;
    const inRange = { $gte: start, $lt: end };
    const inPeriod = new Set(nights);

    const dept: Dept[] = [
      { name: "Reception", rows: [blank("roomSales", "Room Sales"), blank("extraBed", "Extra-Bed"), blank("planCharges", "Plan Charges"), blank("otaCommission", "OTA Commission")] },
      { name: "House Keeping", rows: [blank("laundry", "Laundry")] },
      { name: "Others", rows: [blank("counterSales", "Counter Sales (water, tea / coffee, etc.)"), blank("otherCharges", "Other Charges")] },
    ];
    const byKey = new Map<string, Row>(dept.flatMap((d) => d.rows).map((r) => [r.key, r]));

    // Charges, tax and corrections that touch the period.
    const types = [
      FolioLineType.ROOM_CHARGE, FolioLineType.EXTRA_PERSON, FolioLineType.EXTRA_BED, FolioLineType.EARLY_CHECK_IN, FolioLineType.LATE_CHECK_OUT,
      FolioLineType.LAUNDRY, FolioLineType.MINIBAR, FolioLineType.RESTAURANT, FolioLineType.SPA, FolioLineType.TRANSPORT, FolioLineType.ADDON,
      FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST, FolioLineType.REVERSAL,
    ];
    const lines: any[] = await FolioLine.find({ lineType: { $in: types }, $or: [{ date: inRange }, { coversNights: { $in: nights } }] } as any)
      .select("lineType amount date coversNights description reversedLineId postedBy notes").lean();
    const originals = new Map<string, any>(
      (await FolioLine.find({ _id: { $in: lines.filter((l) => l.lineType === FolioLineType.REVERSAL && l.reversedLineId).map((l) => l.reversedLineId) } } as any).select("lineType description").lean()).map((o: any) => [String(o._id), o]),
    );

    let cgst = 0, sgst = 0, igst = 0;
    for (const l of lines) {
      const isReversal = l.lineType === FolioLineType.REVERSAL;
      const sign = isReversal ? -1 : 1;
      const origin = isReversal ? originals.get(String(l.reversedLineId)) : l;
      if (!origin) continue;
      // The part of this line that falls inside the period.
      let portion = 0;
      const covers: string[] = l.coversNights ?? [];
      if (covers.length) portion = (Number(l.amount) / covers.length) * covers.filter((n) => inPeriod.has(n)).length;
      else if (l.date >= start && l.date < end) portion = Number(l.amount) || 0;
      if (!portion) continue;
      const amount = sign * portion;

      if (origin.lineType === FolioLineType.TAX_CGST) cgst += amount;
      else if (origin.lineType === FolioLineType.TAX_SGST) sgst += amount;
      else if (origin.lineType === FolioLineType.TAX_IGST) igst += amount;
      else {
        const k = rowKey(origin.lineType, String(origin.description ?? ""));
        const row = k ? byKey.get(k) : undefined;
        if (row) row.amount += amount;
      }
    }

    // Counter sales rung up at the cashier desk.
    const shifts: any[] = await CashierShift.find({ counterSales: { $elemMatch: { createdAt: inRange } } } as any).select("counterSales").lean();
    for (const sh of shifts) for (const c of sh.counterSales ?? []) if (c.createdAt >= start && c.createdAt < end) byKey.get("counterSales")!.amount += Number(c.amount) || 0;

    // Discount and OTA commission, on the stays that checked in during the period.
    const stays: any[] = await Booking.find({ checkInDate: inRange, status: { $nin: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] } } as any)
      .select("discountAmount source otaCommissionAmount otaCommissionGst").lean();
    const discount = stays.reduce((t, b) => t + (Number(b.discountAmount) || 0), 0);
    const otaCommission = stays.filter((b) => b.source === "OTA").reduce((t, b) => t + (Number(b.otaCommissionAmount) || 0) + (Number(b.otaCommissionGst) || 0), 0);

    const room = byKey.get("roomSales")!;
    room.discount = discount;
    room.amount += discount; // bill amounts are already net of the discount: Amount is before it
    room.cgst = cgst;
    room.sgst = sgst;
    room.vat = igst; // inter-state GST, shown in the VAT column only if any exists

    const ota = byKey.get("otaCommission")!;
    ota.discount = otaCommission;
    ota.taxVal = -otaCommission;

    for (const r of byKey.values()) {
      if (r.key !== "otaCommission") r.taxVal = r.amount - r.discount;
      r.total = r.taxVal + r.cgst + r.sgst + r.vat + r.roff;
    }

    const sum = (rows: Row[]): Row => rows.reduce((t, r) => ({ ...t, amount: t.amount + r.amount, discount: t.discount + r.discount, taxVal: t.taxVal + r.taxVal, cgst: t.cgst + r.cgst, sgst: t.sgst + r.sgst, vat: t.vat + r.vat, roff: t.roff + r.roff, total: t.total + r.total }), blank("sub", ""));
    const round = (r: Row): Row => ({ ...r, amount: r2(r.amount), discount: r2(r.discount), taxVal: r2(r.taxVal), cgst: r2(r.cgst), sgst: r2(r.sgst), vat: r2(r.vat), roff: r2(r.roff), total: r2(r.total) });

    const departments = dept.map((d) => ({ name: d.name, rows: d.rows.map(round), subtotal: round(sum(d.rows)) }));
    const grand = round(sum(dept.flatMap((d) => d.rows)));
    const days = nights.length;
    const monthDays = new Date(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0).getDate(); // days in the month of the end date

    res.json({
      success: true,
      data: {
        from, to, days,
        departments,
        grand,
        totalCollection: grand.total,
        taxCollection: r2(grand.cgst + grand.sgst + grand.vat),
        averagePerDay: r2(grand.total / days),
        monthAverage: r2(grand.total / monthDays),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
