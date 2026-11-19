import type { Request, Response } from "express";
import { computeMis, MisDay } from "../services/mis.service";
import { addDays, todayBusinessDate } from "../../../shared/dates";

const r0 = (n: number) => Math.round(n || 0);

/**
 * GET /api/front-desk/sales-summary
 * Sales for the reception dashboard. Built from the same calculation as the MIS Daily Sheet, so the cards,
 * the chart and the MIS sheet always show the same numbers. Sales are before GST (as on the MIS sheet);
 * refunds are never a sale.
 */
export const getSalesSummary = async (req: Request, res: Response) => {
  try {
    const propertyId = (req as any).propertyId ?? (req as any).user?.propertyId;
    const scope = propertyId ? { propertyId } : {};
    const today = todayBusinessDate();
    const trendFrom = addDays(today, -13);

    const months = [...new Set([trendFrom.slice(0, 7), today.slice(0, 7)])];
    const byDate = new Map<string, MisDay>();
    for (const m of months) for (const d of await computeMis(m, scope)) byDate.set(d.date, d);

    const day = (date: string) => byDate.get(date);
    const sales = (d?: MisDay) => ({ room: r0(d?.roomSales ?? 0), other: r0((d?.fbSales ?? 0) + (d?.misc ?? 0)), total: r0(d?.salesTotal ?? 0) });

    const monthDays = [...byDate.values()].filter((d) => d.date.startsWith(today.slice(0, 7)) && d.date <= today);
    const month = monthDays.reduce((t, d) => ({ room: t.room + d.roomSales, other: t.other + d.fbSales + d.misc, total: t.total + d.salesTotal, received: t.received + d.modeTotal }), { room: 0, other: 0, total: 0, received: 0 });

    const t = day(today);
    const collections = [
      { method: "CASH", today: r0(t?.cash ?? 0), month: r0(monthDays.reduce((s, d) => s + d.cash, 0)) },
      { method: "UPI", today: r0(t?.upi ?? 0), month: r0(monthDays.reduce((s, d) => s + d.upi, 0)) },
      { method: "CARD", today: r0(t?.card ?? 0), month: r0(monthDays.reduce((s, d) => s + d.card, 0)) },
      { method: "OTHER", today: r0((t?.other ?? 0) + (t?.kkm ?? 0) + (t?.otaPayment ?? 0)), month: r0(monthDays.reduce((s, d) => s + d.other + d.kkm + d.otaPayment, 0)) },
    ].filter((c) => c.today > 0 || c.month > 0);

    res.json({
      success: true,
      data: {
        businessDate: today,
        today: sales(t),
        yesterday: sales(day(addDays(today, -1))),
        month: { room: r0(month.room), other: r0(month.other), total: r0(month.total) },
        receivedToday: r0(t?.netCollection ?? 0),
        receivedMonth: r0(month.received),
        trend: Array.from({ length: 14 }, (_, i) => { const date = addDays(today, -(13 - i)); return { date, ...sales(day(date)) }; }),
        collections,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
