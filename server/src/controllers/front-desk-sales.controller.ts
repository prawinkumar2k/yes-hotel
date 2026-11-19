import type { Request, Response } from "express";
import { FolioLine, FolioLineDirection, FolioLineType } from "../models/FolioLine";
import { Payment, PaymentTxStatus } from "../models/Payment";
import { addDays, businessDayRange, PROPERTY_TIMEZONE, startOfBusinessMonth, todayBusinessDate } from "../../../shared/dates";

const ROOM_TYPES = [FolioLineType.ROOM_CHARGE, FolioLineType.EXTRA_PERSON, FolioLineType.EXTRA_BED, FolioLineType.EARLY_CHECK_IN, FolioLineType.LATE_CHECK_OUT];
const TAX_TYPES = [FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST];
const r0 = (n: number) => Math.round(n || 0);

/**
 * GET /api/front-desk/sales-summary
 * Sales for the reception dashboard: today, this month, a 14-day trend and money collected by method.
 * "Sales" are charges for the stay. A refund is money handed back, never a sale.
 */
export const getSalesSummary = async (req: Request, res: Response) => {
  try {
    const propertyId = (req as any).propertyId ?? (req as any).user?.propertyId;
    const today = todayBusinessDate();
    const trendFrom = businessDayRange(addDays(today, -13)).start;
    const monthStart = businessDayRange(startOfBusinessMonth(today)).start;
    const since = monthStart < trendFrom ? monthStart : trendFrom;
    const scope = propertyId ? { propertyId } : {};

    const lines = await FolioLine.aggregate([
      { $match: { ...scope, direction: FolioLineDirection.DEBIT, lineType: { $ne: FolioLineType.REFUND }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: PROPERTY_TIMEZONE } },
            kind: { $switch: { branches: [
              { case: { $in: ["$lineType", ROOM_TYPES] }, then: "room" },
              { case: { $in: ["$lineType", TAX_TYPES] }, then: "tax" },
            ], default: "other" } },
          },
          amount: { $sum: "$amount" },
        },
      },
    ]);
    const byDay = new Map<string, { room: number; tax: number; other: number }>();
    for (const l of lines) {
      const d = byDay.get(l._id.day) ?? { room: 0, tax: 0, other: 0 };
      (d as any)[l._id.kind] += l.amount;
      byDay.set(l._id.day, d);
    }
    const sum = (from: string, to: string) => {
      const t = { room: 0, tax: 0, other: 0 };
      for (const [day, v] of byDay) if (day >= from && day <= to) { t.room += v.room; t.tax += v.tax; t.other += v.other; }
      return { room: r0(t.room), tax: r0(t.tax), other: r0(t.other), total: r0(t.room + t.tax + t.other) };
    };
    const trend = Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, -(13 - i));
      const v = byDay.get(date) ?? { room: 0, tax: 0, other: 0 };
      return { date, room: r0(v.room), other: r0(v.other), tax: r0(v.tax), total: r0(v.room + v.other + v.tax) };
    });

    const todayStart = businessDayRange(today).start;
    const collected = await Payment.aggregate([
      { $match: { ...scope, status: PaymentTxStatus.COMPLETED, createdAt: { $gte: monthStart } } },
      { $group: { _id: { method: "$method", today: { $gte: ["$createdAt", todayStart] } }, amount: { $sum: "$amount" } } },
    ]);
    const methods = new Map<string, { today: number; month: number }>();
    for (const c of collected) {
      const m = methods.get(c._id.method) ?? { today: 0, month: 0 };
      m.month += c.amount;
      if (c._id.today) m.today += c.amount;
      methods.set(c._id.method, m);
    }

    res.json({
      success: true,
      data: {
        businessDate: today,
        today: sum(today, today),
        yesterday: sum(addDays(today, -1), addDays(today, -1)),
        month: sum(startOfBusinessMonth(today), today),
        trend,
        collections: [...methods.entries()].map(([method, v]) => ({ method, today: r0(v.today), month: r0(v.month) })),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
