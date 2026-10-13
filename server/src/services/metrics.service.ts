/**
 * Hotel KPIs: the one implementation of room revenue, occupancy, ADR and RevPAR, and of
 * collections. Every dashboard and report reads these.
 *
 *   Room revenue (night d)  Σ over stays occupying d (CHECKED_IN / CHECKED_OUT, plus
 *                           CONFIRMED for future dates when `includeForecast`) of the stay's
 *                           pre-tax room revenue per night = (totalAmount − taxAmount) / nights
 *   Rooms sold (d)          number of such stays
 *   Available rooms         sellable rooms (SELLABLE_ROOM_FILTER), per night
 *   Occupancy %             rooms sold / available rooms
 *   ADR                     room revenue / rooms sold
 *   RevPAR                  room revenue / available rooms
 *   Collections             money received (COMPLETED payments + advances), by the date received.
 *                           Collections are NOT revenue.
 */
import { Booking, BookingStatus } from "../models/Booking";
import { Room } from "../models/Room";
import { Payment } from "../models/Payment";
import { AdvancePayment } from "../models/AdvancePayment";
import { SELLABLE_ROOM_FILTER } from "./maintenance.service";
import { addDays, businessDayRange, daysBetween, eachBusinessDate, nights as countNights, toBusinessDate } from "../../../shared/dates";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DayMetrics {
  date: string;
  roomsSold: number;
  availableRooms: number;
  roomRevenue: number;
  occupancyPct: number;
  adr: number;
  revpar: number;
}

export interface RangeMetrics extends Omit<DayMetrics, "date"> {
  from: string;
  to: string;
  roomNights: number;
  days: DayMetrics[];
}

/** Pre-tax room revenue per night of a stay. */
export function nightlyRoomRevenue(b: { totalAmount?: number; taxAmount?: number; checkInDate: Date; checkOutDate: Date }): number {
  const n = Math.max(1, countNights(b.checkInDate, b.checkOutDate));
  return r2(Math.max(0, (b.totalAmount || 0) - (b.taxAmount || 0)) / n);
}

function ratios(roomsSold: number, availableRooms: number, roomRevenue: number) {
  return {
    occupancyPct: availableRooms > 0 ? r2((roomsSold / availableRooms) * 100) : 0,
    adr: roomsSold > 0 ? r2(roomRevenue / roomsSold) : 0,
    revpar: availableRooms > 0 ? r2(roomRevenue / availableRooms) : 0,
  };
}

/** Room KPIs for business dates from..to inclusive (YYYY-MM-DD). */
export async function roomMetrics(fromYmd: string, toYmd: string, opts: { propertyId?: unknown; includeForecast?: boolean } = {}): Promise<RangeMetrics> {
  const scope = opts.propertyId ? { propertyId: opts.propertyId } : {};
  const statuses = [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT, ...(opts.includeForecast ? [BookingStatus.CONFIRMED] : [])];
  const [availableRooms, stays] = await Promise.all([
    Room.countDocuments({ ...scope, ...SELLABLE_ROOM_FILTER } as any),
    Booking.find({
      ...scope,
      status: { $in: statuses },
      checkInDate: { $lt: businessDayRange(toYmd).end },
      checkOutDate: { $gt: businessDayRange(fromYmd).start },
    } as any)
      .select("checkInDate checkOutDate actualCheckOutDate checkedOutAt totalAmount taxAmount status")
      .lean(),
  ]);

  const byDay = new Map<string, { sold: number; revenue: number }>();
  for (const d of eachBusinessDate(fromYmd, toYmd)) byDay.set(d, { sold: 0, revenue: 0 }); // inclusive

  for (const b of stays as any[]) {
    const perNight = nightlyRoomRevenue(b);
    const start = toBusinessDate(b.checkInDate);
    // An early checkout ends the stay on the day the guest left.
    const leftAt = b.status === BookingStatus.CHECKED_OUT && b.checkedOutAt ? toBusinessDate(b.checkedOutAt) : undefined;
    const scheduledEnd = toBusinessDate(b.checkOutDate);
    const end = leftAt && leftAt < scheduledEnd ? (leftAt > start ? leftAt : addDays(start, 1)) : scheduledEnd;
    if (end <= start) continue;
    for (const d of eachBusinessDate(start, addDays(end, -1))) { // nights: check-in day … day before check-out
      const slot = byDay.get(d);
      if (slot) {
        slot.sold += 1;
        slot.revenue += perNight;
      }
    }
  }

  const days: DayMetrics[] = [...byDay.entries()].map(([date, v]) => ({
    date,
    roomsSold: v.sold,
    availableRooms,
    roomRevenue: r2(v.revenue),
    ...ratios(v.sold, availableRooms, v.revenue),
  }));
  const roomNights = days.reduce((t, d) => t + d.roomsSold, 0);
  const roomRevenue = r2(days.reduce((t, d) => t + d.roomRevenue, 0));
  const availableNights = availableRooms * days.length;
  return {
    from: fromYmd,
    to: toYmd,
    roomNights,
    roomsSold: roomNights,
    availableRooms: availableNights,
    roomRevenue,
    ...ratios(roomNights, availableNights, roomRevenue),
    days,
  };
}

/** Money received between business dates (inclusive), by method. Not revenue. */
export async function collections(fromYmd: string, toYmd: string, opts: { propertyId?: unknown } = {}) {
  const scope = opts.propertyId ? { propertyId: opts.propertyId } : {};
  const range = { $gte: businessDayRange(fromYmd).start, $lt: businessDayRange(toYmd).end };
  const [payments, advances] = await Promise.all([
    Payment.aggregate([{ $match: { ...scope, status: "COMPLETED", createdAt: range } }, { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    AdvancePayment.aggregate([{ $match: { ...scope, receivedAt: range } }, { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
  ]);
  const byMethod: Record<string, number> = {};
  for (const r of [...payments, ...advances]) byMethod[r._id ?? "OTHER"] = r2((byMethod[r._id ?? "OTHER"] ?? 0) + r.total);
  const paymentsTotal = r2(payments.reduce((t, r) => t + r.total, 0));
  const advancesTotal = r2(advances.reduce((t, r) => t + r.total, 0));
  return {
    from: fromYmd,
    to: toYmd,
    payments: paymentsTotal,
    paymentsCount: payments.reduce((t, r) => t + r.count, 0),
    advances: advancesTotal,
    total: r2(paymentsTotal + advancesTotal),
    byMethod,
  };
}

export const daysInclusive = (fromYmd: string, toYmd: string) => Math.max(1, daysBetween(fromYmd, toYmd) + 1);

/**
 * Revenue earned between business dates (inclusive): charges posted to folios, pre-tax,
 * net of discounts and of reversed charges, by posting date. Room revenue is the ROOM_CHARGE part.
 */
export async function chargeRevenue(fromYmd: string, toYmd: string) {
  const { FolioLine } = await import("../models/FolioLine");
  const { bucketFor } = await import("./folio-ledger");
  const range = { $gte: businessDayRange(fromYmd).start, $lt: businessDayRange(toYmd).end };
  const lines = await FolioLine.find({ postedAt: range }).select("_id lineType amount reversedLineId").lean();
  const targets = new Map(
    (await FolioLine.find({ _id: { $in: lines.filter((l: any) => l.reversedLineId).map((l: any) => l.reversedLineId) } }).select("lineType").lean()).map((l: any) => [String(l._id), l.lineType]),
  );
  let charges = 0;
  let room = 0;
  let discounts = 0;
  for (const l of lines as any[]) {
    const type = l.lineType === "REVERSAL" ? targets.get(String(l.reversedLineId)) : l.lineType;
    if (!type) continue;
    const sign = l.lineType === "REVERSAL" ? -1 : 1;
    const bucket = bucketFor(type);
    if (bucket === "charges") {
      charges += sign * l.amount;
      if (type === "ROOM_CHARGE") room += sign * l.amount;
    } else if (bucket === "discounts") discounts += sign * l.amount;
  }
  return { from: fromYmd, to: toYmd, grossCharges: r2(charges), discounts: r2(discounts), revenue: r2(charges - discounts), roomCharges: r2(room) };
}
