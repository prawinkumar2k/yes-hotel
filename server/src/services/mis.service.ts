/**
 * Monthly MIS: one row per business day with every number the hotel tracks — rooms, who booked,
 * money received by mode, sales, refunds and expenses. Both MIS pages (the live grid and the daily
 * sheet in the old Excel layout) are built from this one calculation so they always agree.
 *
 * Sources: bookings (check-in / check-out / nights / source), payments and advances (money received),
 * cashier counter sales and paid-outs, folio lines (room and other sales), refunds, credit given.
 */
import { Booking, BookingStatus } from "../models/Booking";
import { Payment } from "../models/Payment";
import { AdvancePayment } from "../models/AdvancePayment";
import { AdvanceAdjustment } from "../models/AdvanceAdjustment";
import { CashierShift } from "../models/CashierShift";
import { Refund } from "../models/Refund";
import { FolioLine, FolioLineDirection, FolioLineType } from "../models/FolioLine";
import { addDays, businessMonthRange, endOfBusinessMonth, PROPERTY_TIMEZONE, toBusinessDate } from "../../../shared/dates";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type MisDay = {
  date: string; day: string;
  // rooms
  checkIns: number; checkOuts: number; occupancyRooms: number; occupancyPax: number; cancelled: number; noShow: number;
  // receipts (money in, by kind)
  recAdvance: number; recPartial: number; recFinal: number; recTotal: number;
  // who booked (check-ins of the day)
  walkin: number; reserved: number; ota: number; travel: number;
  otaMmt: number; otaAgoda: number; otaBooking: number; otaGoibibo: number;
  // sales
  roomSales: number; fbSales: number; misc: number; salesTotal: number;
  // money received by mode
  cash: number; card: number; upi: number; other: number; kkm: number; otaPayment: number; modeTotal: number;
  // adjustments
  refunds: number; expenses: number; credit: number; creditCollected: number; advancesAdj: number; netCollection: number;
  // counter sales by item
  rsEarlyCheckIn: number; rsWater: number; rsDental: number; rsTeaCoffee: number; rsKovaiMess: number; rsOther: number; rsTotal: number;
};

const RS_FIELD: Record<string, keyof MisDay> = {
  EARLY_CHECK_IN: "rsEarlyCheckIn", WATER_BOTTLE: "rsWater", DENTAL_KIT: "rsDental", TEA_COFFEE_SHOP: "rsTeaCoffee", KOVAI_KONGU_MESS: "rsKovaiMess", OTHER: "rsOther",
};
const TAX_TYPES: string[] = [FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST];
const CHECKED_STAYS = [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT];

const blank = (date: string): MisDay => ({
  date,
  day: new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-US", { weekday: "short", timeZone: PROPERTY_TIMEZONE }),
  checkIns: 0, checkOuts: 0, occupancyRooms: 0, occupancyPax: 0, cancelled: 0, noShow: 0,
  recAdvance: 0, recPartial: 0, recFinal: 0, recTotal: 0,
  walkin: 0, reserved: 0, ota: 0, travel: 0, otaMmt: 0, otaAgoda: 0, otaBooking: 0, otaGoibibo: 0,
  roomSales: 0, fbSales: 0, misc: 0, salesTotal: 0,
  cash: 0, card: 0, upi: 0, other: 0, kkm: 0, otaPayment: 0, modeTotal: 0,
  refunds: 0, expenses: 0, credit: 0, creditCollected: 0, advancesAdj: 0, netCollection: 0,
  rsEarlyCheckIn: 0, rsWater: 0, rsDental: 0, rsTeaCoffee: 0, rsKovaiMess: 0, rsOther: 0, rsTotal: 0,
});

export async function computeMis(month: string, scope: Record<string, unknown> = {}): Promise<MisDay[]> {
  const { start, end } = businessMonthRange(month);
  const inRange = { $gte: start, $lt: end };
  const last = endOfBusinessMonth(`${month}-01`);
  const rows = new Map<string, MisDay>();
  for (let d = `${month}-01`; d <= last; d = addDays(d, 1)) rows.set(d, blank(d));
  const row = (when: Date | string | undefined | null) => (when ? rows.get(toBusinessDate(when)) : undefined);

  // Refunds and advance adjustments have no property of their own: they belong to the property of their booking.
  const byBooking: Record<string, unknown> = Object.keys(scope).length ? { booking: { $in: await Booking.find(scope as any).distinct("_id") } } : {};
  const [checkedIn, checkedOut, stays, cancelled, noShows, payments, advances, adjustments, shifts, refunds] = await Promise.all([
    Booking.find({ ...scope, checkedInAt: inRange } as any).select("source otaName otaPaymentModel otaReceivable checkedInAt").lean(),
    Booking.find({ ...scope, status: BookingStatus.CHECKED_OUT, checkedOutAt: inRange } as any).select("checkedOutAt").lean(),
    Booking.find({ ...scope, status: { $in: CHECKED_STAYS }, checkInDate: { $lt: end }, checkOutDate: { $gt: start } } as any).select("checkInDate checkOutDate adults children stayType").lean(),
    Booking.find({ ...scope, status: BookingStatus.CANCELLED, updatedAt: inRange } as any).select("updatedAt").lean(),
    Booking.find({ ...scope, status: BookingStatus.NO_SHOW, updatedAt: inRange } as any).select("updatedAt").lean(),
    Payment.find({ ...scope, status: "COMPLETED", createdAt: inRange } as any).select("amount method purpose createdAt").lean(),
    AdvancePayment.find({ ...scope, receivedAt: inRange } as any).select("amount method receivedAt").lean(),
    AdvanceAdjustment.find({ ...byBooking, type: "ADJUSTMENT", status: "COMPLETED", performedAt: inRange } as any).select("amount performedAt").lean(),
    CashierShift.find({ ...scope, $or: [{ counterSales: { $elemMatch: { createdAt: inRange } } }, { paidOuts: { $elemMatch: { createdAt: inRange } } }] } as any).select("counterSales paidOuts").lean(),
    Refund.find({ ...byBooking, status: "COMPLETED", updatedAt: inRange } as any).select("amount updatedAt").lean(),
  ]);

  // Rooms
  for (const b of checkedIn as any[]) {
    const r = row(b.checkedInAt); if (!r) continue;
    r.checkIns += 1;
    if (b.source === "OTA") {
      r.ota += 1;
      const n = String(b.otaName ?? "");
      if (/make\s*my\s*trip|mmt/i.test(n)) r.otaMmt += 1; else if (/agoda/i.test(n)) r.otaAgoda += 1; else if (/booking/i.test(n)) r.otaBooking += 1; else if (/goibibo|ibibo/i.test(n)) r.otaGoibibo += 1;
      if (b.otaPaymentModel === "OTA_PREPAID") r.otaPayment += Number(b.otaReceivable || 0);
    } else if (b.source === "WALK_IN") r.walkin += 1;
    else if (["CORPORATE", "TRAVEL_AGENT", "GROUP", "GOVERNMENT"].includes(b.source)) r.travel += 1;
    else r.reserved += 1;
  }
  for (const b of checkedOut as any[]) { const r = row(b.checkedOutAt); if (r) r.checkOuts += 1; }
  for (const b of cancelled as any[]) { const r = row(b.updatedAt); if (r) r.cancelled += 1; }
  for (const b of noShows as any[]) { const r = row(b.updatedAt); if (r) r.noShow += 1; }
  for (const b of stays as any[]) {
    const ci = toBusinessDate(b.checkInDate);
    const co = toBusinessDate(b.checkOutDate);
    const pax = (b.adults || 1) + (b.children || 0);
    const nightsCovered = b.stayType === "HOURLY" || co <= ci ? [ci] : [];
    for (let d = ci; nightsCovered.length === 0 && d < co; d = addDays(d, 1)) nightsCovered.push(d);
    for (const d of nightsCovered) { const r = rows.get(d); if (r) { r.occupancyRooms += 1; r.occupancyPax += pax; } }
  }

  // Money received, by mode and by kind
  const mode = (r: MisDay, method: string | undefined, amount: number) => {
    const m = String(method ?? "").toUpperCase();
    if (m === "CASH") r.cash += amount; else if (m === "CARD") r.card += amount; else if (m === "UPI") r.upi += amount; else r.other += amount;
  };
  for (const p of payments as any[]) {
    const r = row(p.createdAt); if (!r) continue;
    const amount = Number(p.amount) || 0;
    mode(r, p.method, amount);
    if (p.purpose === "ADVANCE") r.recAdvance += amount; else if (p.purpose === "SETTLEMENT") r.recFinal += amount; else r.recPartial += amount;
  }
  for (const a of advances as any[]) {
    const r = row(a.receivedAt); if (!r) continue;
    const amount = Number(a.amount) || 0;
    mode(r, a.method, amount);
    r.recAdvance += amount;
  }
  for (const a of adjustments as any[]) { const r = row(a.performedAt); if (r) r.advancesAdj += Number(a.amount) || 0; }
  for (const rf of refunds as any[]) { const r = row(rf.updatedAt); if (r) r.refunds += Number(rf.amount) || 0; }

  // Counter sales (water bottle, dental kit, mess …) and petty-cash expenses from cashier shifts
  for (const sh of shifts as any[]) {
    for (const c of sh.counterSales || []) {
      const r = row(c.createdAt); if (!r) continue;
      const amount = Number(c.amount) || 0;
      const field = RS_FIELD[c.category] ?? "rsOther";
      (r[field] as number) += amount;
      r.rsTotal += amount;
      if (c.category === "KOVAI_KONGU_MESS") r.kkm += amount; else mode(r, c.mode, amount);
    }
    for (const p of sh.paidOuts || []) {
      const r = row(p.createdAt);
      if (r && p.category === "PETTY_CASH") r.expenses += Number(p.amount) || 0;
    }
  }

  // Sales from the bills: room charges spread over the nights they cover; other charges on their date.
  const lines: any[] = await FolioLine.find({ date: inRange, direction: FolioLineDirection.DEBIT, lineType: { $nin: TAX_TYPES } } as any).select("lineType amount date coversNights postedBy").lean();
  const reversed = new Set(
    (await FolioLine.find({ lineType: FolioLineType.REVERSAL, reversedLineId: { $in: lines.map((l) => l._id) } } as any).select("reversedLineId").lean()).map((x: any) => String(x.reversedLineId)),
  );
  for (const l of lines) {
    if (reversed.has(String(l._id))) continue;
    const amount = Number(l.amount) || 0;
    if (l.lineType === FolioLineType.ROOM_CHARGE) {
      const nightsList: string[] = (l.coversNights ?? []).filter((n: string) => rows.has(n));
      if (nightsList.length) {
        const share = amount / (l.coversNights.length || 1);
        for (const n of nightsList) rows.get(n)!.roomSales += share;
      } else { const r = row(l.date); if (r) r.roomSales += amount; }
    } else if (l.lineType === FolioLineType.RESTAURANT) { const r = row(l.date); if (r) r.fbSales += amount; }
    else if (l.postedBy !== "COUNTER_SALE") { const r = row(l.date); if (r) r.misc += amount; } // counter sales are counted from the shifts
  }

  // Totals per day
  for (const r of rows.values()) {
    r.misc += r.rsTotal;
    r.recTotal = r.recAdvance + r.recPartial + r.recFinal;
    r.modeTotal = r.cash + r.card + r.upi + r.other + r.kkm + r.otaPayment;
    r.salesTotal = r.roomSales + r.fbSales + r.misc;
    r.netCollection = r.modeTotal - r.refunds - r.expenses;
    for (const k of Object.keys(r) as (keyof MisDay)[]) if (typeof r[k] === "number") (r[k] as number) = r2(r[k] as number);
  }
  return [...rows.values()];
}

export const MIS_SUM_KEYS = (Object.keys(blank("2000-01-01")) as (keyof MisDay)[]).filter((k) => typeof blank("2000-01-01")[k] === "number");

/** The month's total row (every numeric column summed). */
export function misTotals(days: MisDay[]) {
  const t: Record<string, number> = {};
  for (const k of MIS_SUM_KEYS) t[k as string] = r2(days.reduce((s, d) => s + (d[k] as number), 0));
  return t;
}
