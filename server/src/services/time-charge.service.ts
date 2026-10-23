/**
 * Early check-in and late check-out, by the hour.
 *
 * The amount defaults to the room type's hourly price × hours (or, when the room type has no
 * hourly price, the flat fee in Admin → Settings) and staff can change it. It is what the guest
 * pays: with "room prices include GST" the GST is inside it, otherwise GST is added on top. It is
 * posted to the bill as an EARLY_CHECK_IN / LATE_CHECK_OUT line (accommodation, so GST at the
 * room's slab) with its CGST and SGST; the booking's arrival / departure time and totals follow,
 * and the charge is recorded on the booking (`timeCharges`) for the GRC and invoice.
 */
import { earlyLateFlatFee } from "./tariff.service";
import mongoose from "mongoose";
import type { Request } from "express";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLineType } from "../models/FolioLine";
import { postCharge } from "./folio.service";
import { computeChargeTax, loadRoomPricing, pricesIncludeTax } from "./tax.service";
import { createAuditLog } from "./audit.service";
import { toBusinessDate } from "../../../shared/dates";

export type TimeChargeKind = "EARLY_CHECK_IN" | "LATE_CHECK_OUT";

export class TimeChargeError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "11:00" / "11:00 AM" / "2:30 pm" → minutes after midnight (null if unreadable). */
export function parseClock(v: unknown): number | null {
  const m = String(v ?? "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
export const formatClock = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

async function load(bookingId: string) {
  if (!mongoose.isValidObjectId(bookingId)) throw new TimeChargeError("Booking not found", 404);
  const booking: any = await Booking.findById(bookingId).populate("roomCategory", "name hourlyPrice");
  if (!booking) throw new TimeChargeError("Booking not found", 404);
  const { HotelSettings } = await import("../models/HotelSettings");
  const settings: any = (await HotelSettings.findOne().sort({ updatedAt: -1 }).select("checkInTime checkOutTime earlyCheckInFee lateCheckOutFee earlyLateFeeSingle earlyLateFeeDouble earlyLateMaxHours").lean()) ?? {};
  return { booking, settings };
}

/** Price, GST and new time for `hours` of early check-in / late check-out (no changes made). */
export async function quoteTimeCharge(p: { bookingId: string; kind: TimeChargeKind; hours: number; amount?: number }) {
  if (p.kind !== "EARLY_CHECK_IN" && p.kind !== "LATE_CHECK_OUT") throw new TimeChargeError("Choose early check-in or late check-out");
  const hours = Number(p.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 23) throw new TimeChargeError("Enter the hours (1 to 23); for longer, extend by nights");
  const { booking, settings } = await load(p.bookingId);

  const late = p.kind === "LATE_CHECK_OUT";
  const from = late
    ? parseClock(booking.departureTime) ?? parseClock(settings.checkOutTime) ?? 11 * 60
    : parseClock(settings.checkInTime) ?? 12 * 60;
  const to = late ? from + hours * 60 : from - hours * 60;
  if (to >= 24 * 60) throw new TimeChargeError(`${hours} hour${hours > 1 ? "s" : ""} after ${formatClock(from)} runs past midnight — extend by a night instead`);
  if (to < 0) throw new TimeChargeError(`${hours} hour${hours > 1 ? "s" : ""} before ${formatClock(from)} is before midnight — charge the previous night instead`);

  const hourlyPrice = Number(booking.roomCategory?.hourlyPrice) || 0;
  const flatFee = Number(late ? settings.lateCheckOutFee : settings.earlyCheckInFee) || 0;
  // The hotel's flat early / late fee by occupancy (up to its hour limit), else the room type's hourly price, else the flat fee.
  const occupancyFee = earlyLateFlatFee(settings, booking.adults, hours);
  const suggested = occupancyFee ?? (hourlyPrice > 0 ? r2(hourlyPrice * hours) : flatFee);
  const given = p.amount === undefined || p.amount === null || (p.amount as any) === "" ? undefined : Number(p.amount);
  if (given !== undefined && !(given >= 0)) throw new TimeChargeError("Enter a valid amount");
  const amount = r2(given ?? suggested);

  const pricing = await loadRoomPricing();
  const inclusive = pricesIncludeTax(booking);
  const tax = amount > 0
    ? computeChargeTax(pricing.rules, p.kind, amount, new Date(), { nightlyValue: Number(booking.ratePerNight) || amount, inclusive })!
    : { taxable: 0, cgst: 0, sgst: 0, tax: 0, total: 0, lines: [] as any[] };
  return {
    kind: p.kind,
    hours,
    fromTime: formatClock(from),
    toTime: formatClock(to),
    hourlyPrice,
    flatFee,
    suggestedAmount: suggested,
    amount,
    pricesIncludeTax: inclusive,
    taxable: tax.taxable,
    cgst: tax.cgst,
    sgst: tax.sgst,
    gstRate: tax.lines[0]?.rate ?? 0,
    total: inclusive ? amount : r2(amount + tax.tax),
    booking,
  };
}

export async function postTimeCharge(p: { bookingId: string; kind: TimeChargeKind; hours: number; amount?: number; reason?: string; force?: boolean; actorId: string; req?: Request }) {
  const q = await quoteTimeCharge(p);
  const booking = q.booking;
  if (booking.status !== BookingStatus.CHECKED_IN) throw new TimeChargeError(`The guest must be checked in (this booking is ${booking.status})`, 409);
  // Late check-out: the room must not be needed by the next guest that day.
  if (p.kind === "LATE_CHECK_OUT" && booking.assignedRoom && !p.force) {
    const outDay = toBusinessDate(booking.checkOutDate);
    const next = await Booking.findOne({
      _id: { $ne: booking._id },
      assignedRoom: booking.assignedRoom,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      checkInDate: { $gte: new Date(`${outDay}T00:00:00+05:30`), $lt: new Date(new Date(`${outDay}T00:00:00+05:30`).getTime() + 86400000) },
    }).select("bookingReference arrivalTime").lean();
    if (next) {
      throw new TimeChargeError(`Booking ${(next as any).bookingReference} arrives in this room on ${outDay}${(next as any).arrivalTime ? ` at ${(next as any).arrivalTime}` : ""}. Move one of them, or tick "add anyway".`, 409);
    }
  }

  const already = (booking.timeCharges ?? []).some((t: any) => t.kind === p.kind);
  if (already && !p.force) throw new TimeChargeError(`${p.kind === "LATE_CHECK_OUT" ? "Late check-out" : "Early check-in"} is already charged on this stay. Tick "add anyway" to charge more hours.`, 409);

  const folio: any = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN });
  if (!folio) throw new TimeChargeError("This stay has no open bill", 409);

  const label = p.kind === "LATE_CHECK_OUT" ? `Late check-out — ${q.hours} hour${q.hours > 1 ? "s" : ""} (until ${q.toTime})` : `Early check-in — ${q.hours} hour${q.hours > 1 ? "s" : ""} (from ${q.toTime})`;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const base = { folioId: String(folio._id), bookingId: String(booking._id), date: new Date(), postedBy: p.actorId };
      if (q.amount > 0) {
        const pct = q.gstRate / 2;
        await postCharge({ ...base, lineType: p.kind === "LATE_CHECK_OUT" ? FolioLineType.LATE_CHECK_OUT : FolioLineType.EARLY_CHECK_IN, description: label, amount: q.taxable, notes: p.reason }, { req: p.req, session });
        if (q.cgst > 0) await postCharge({ ...base, lineType: FolioLineType.TAX_CGST, description: `CGST (${pct}%) on ${p.kind === "LATE_CHECK_OUT" ? "late check-out" : "early check-in"}`, amount: q.cgst }, { req: p.req, session });
        if (q.sgst > 0) await postCharge({ ...base, lineType: FolioLineType.TAX_SGST, description: `SGST (${pct}%) on ${p.kind === "LATE_CHECK_OUT" ? "late check-out" : "early check-in"}`, amount: q.sgst }, { req: p.req, session });
      }
      const tax = r2(q.cgst + q.sgst);
      const set: Record<string, unknown> = p.kind === "LATE_CHECK_OUT" ? { departureTime: q.toTime } : { arrivalTime: q.toTime };
      if (q.total > 0 && booking.paymentStatus === "PAID") set.paymentStatus = "PARTIAL";
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: set,
          $inc: { totalAmount: q.total, taxAmount: tax, cgstAmount: q.cgst, sgstAmount: q.sgst },
          $push: { timeCharges: { kind: p.kind, hours: q.hours, fromTime: q.fromTime, toTime: q.toTime, amount: q.total, reason: p.reason, at: new Date(), ...(mongoose.isValidObjectId(p.actorId) ? { by: p.actorId } : {}) } },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  await createAuditLog({
    req: p.req,
    action: p.kind === "LATE_CHECK_OUT" ? "booking.late_check_out" : "booking.early_check_in",
    resourceType: "Booking",
    resourceId: String(booking._id),
    metadata: { bookingReference: booking.bookingReference, hours: q.hours, fromTime: q.fromTime, toTime: q.toTime, amount: q.total, reason: p.reason },
  });
  const { booking: _b, ...rest } = q;
  return rest;
}
