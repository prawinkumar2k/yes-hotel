/**
 * Tariff typed at checkout (express or early check-out): the guest pays `ratePerNight` for the
 * nights actually stayed.
 *
 * 1. Leaving early: the unused nights are credited first (early-departure.service — dates,
 *    inventory and their GST follow), so nothing is credited twice at the handoff.
 * 2. The room tariff on the bill is then moved to rate × nights stayed by posting the difference
 *    (a ROOM_CHARGE when dearer, a REVERSAL of a room line when cheaper), with the GST difference
 *    at the right slab. Extra bed, food, early check-in / late check-out and payments are untouched.
 * A rate below the room type's default rate is queued for Reception verification.
 */
import type { Request } from "express";
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { postCharge } from "./folio.service";
import { computeRoomTax, loadGstRules, pricesIncludeTax } from "./tax.service";
import { createAuditLog } from "./audit.service";
import { nights as countNights, addDays, toBusinessDate } from "../../../shared/dates";

export class CheckoutTariffError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** GST lines that belong to the room tariff (not food, early check-in / late check-out or a cancellation charge). */
const isRoomTax = (l: any) => !/KOT|Restaurant|POS|late check-out|early check-in|cancellation/i.test(String(l.description ?? ""));

export async function applyCheckoutTariff(p: { bookingId: string; ratePerNight: number; reason?: string; actorId: string; req?: Request }) {
  const rate = r2(Number(p.ratePerNight));
  if (!(rate >= 0)) throw new CheckoutTariffError("Enter the tariff per night");
  if (!mongoose.isValidObjectId(p.bookingId)) throw new CheckoutTariffError("Booking not found", 404);
  let booking: any = await Booking.findById(p.bookingId).populate("roomCategory", "basePrice name");
  if (!booking) throw new CheckoutTariffError("Booking not found", 404);
  if (booking.status !== BookingStatus.CHECKED_IN) throw new CheckoutTariffError(`The guest must be checked in (this booking is ${booking.status})`, 409);
  const folio: any = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN });
  if (!folio) throw new CheckoutTariffError("This stay has no open bill", 409);

  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = Math.max(1, countNights(checkIn, checkOut)); // booked nights (early departure trims them after)
  const inclusive = pricesIncludeTax(booking);
  const rules = await loadGstRules();

  // 1. Current room tariff and its GST on the bill (net of reversals).
  const lines: any[] = await FolioLine.find({ folio: folio._id }).lean();
  const byId = new Map(lines.map((l) => [String(l._id), l]));
  const net = (pred: (l: any) => boolean) => {
    let t = 0;
    for (const l of lines) {
      if (l.lineType === FolioLineType.REVERSAL) {
        const o = l.reversedLineId ? byId.get(String(l.reversedLineId)) : undefined;
        if (o && pred(o)) t -= l.amount;
      } else if (pred(l)) t += l.amount;
    }
    return r2(t);
  };
  const roomNow = net((l) => l.lineType === FolioLineType.ROOM_CHARGE);
  const cgstNow = net((l) => l.lineType === FolioLineType.TAX_CGST && isRoomTax(l));
  const sgstNow = net((l) => l.lineType === FolioLineType.TAX_SGST && isRoomTax(l));
  const extrasNow = net((l) => l.lineType === FolioLineType.EXTRA_BED || l.lineType === FolioLineType.EXTRA_PERSON);

  // Target for the booked stay: rate × nights (GST inside when prices include GST), GST over room + extra beds.
  const roomTax = computeRoomTax(rules, { checkIn, checkOut, nightlyValue: rate, inclusive });
  const roomTarget = inclusive ? r2(rate * nights - roomTax.tax) : r2(rate * nights);
  const fullTax = computeRoomTax(rules, { checkIn, checkOut, nightlyValue: (roomTarget + extrasNow) / nights });
  const dRoom = r2(roomTarget - roomNow);
  const dCgst = r2(fullTax.cgst - cgstNow);
  const dSgst = r2(fullTax.sgst - sgstNow);
  const reason = String(p.reason ?? "").trim() || "Tariff set at checkout";

  // A line is reversed at most once; a line already partly credited (an earlier early check-out,
  // a room move) keeps its amount. Only untouched lines are re-rated.
  const reversedIds = new Set(lines.filter((l) => l.lineType === FolioLineType.REVERSAL && l.reversedLineId).map((l) => String(l.reversedLineId)));
  const touchedRoom = r2(lines.filter((l) => l.lineType === FolioLineType.ROOM_CHARGE && reversedIds.has(String(l._id))).reduce((t, l) => t + l.amount, 0) - (r2(lines.filter((l) => l.lineType === FolioLineType.ROOM_CHARGE).reduce((t, l) => t + l.amount, 0)) - roomNow));
  if (dRoom < 0 && touchedRoom > roomTarget + 0.01) {
    throw new CheckoutTariffError("This bill was already adjusted (early check-out or room move); lower the tariff with a discount on the bill instead", 409);
  }

  if (dRoom || dCgst || dSgst) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const base = { folioId: String(folio._id), bookingId: String(booking._id), date: new Date(), postedBy: p.actorId, notes: reason };
        const stayNights = Array.from({ length: nights }, (_, i) => addDays(toBusinessDate(checkIn), i));
        const reset = async (type: FolioLineType, current: number, target: number, label: string, pred: (l: any) => boolean = () => true) => {
          if (r2(target - current) === 0) return;
          let remaining = current;
          for (const l of lines) {
            if (l.lineType !== type || !pred(l) || reversedIds.has(String(l._id)) || !(l.amount > 0)) continue;
            await postCharge({ ...base, lineType: FolioLineType.REVERSAL, description: `Reversal of: ${l.description} (tariff set at checkout)`, amount: l.amount, reversedLineId: String(l._id) } as any, { req: p.req, session });
            remaining = r2(remaining - l.amount);
          }
          const add = r2(target - remaining);
          // Room lines name their nights, so an early check-out credits exactly the unused ones.
          if (add > 0) await postCharge({ ...base, lineType: type, description: label, amount: add, ...(type === FolioLineType.ROOM_CHARGE ? { coversNights: stayNights } : {}) } as any, { req: p.req, session });
        };
        await reset(FolioLineType.ROOM_CHARGE, roomNow, roomTarget, `Room Tariff — ${nights} night${nights > 1 ? "s" : ""} @ ₹${rate.toLocaleString("en-IN")} (set at checkout)`);
        await reset(FolioLineType.TAX_CGST, cgstNow, fullTax.cgst, "CGST on Room Tariff", isRoomTax);
        await reset(FolioLineType.TAX_SGST, sgstNow, fullTax.sgst, "SGST on Room Tariff", isRoomTax);
        const dTax = r2(dCgst + dSgst);
        await Booking.updateOne(
          { _id: booking._id },
          {
            $set: { ratePerNight: rate, ...(booking.paymentStatus === "PAID" && dRoom + dTax > 0 ? { paymentStatus: "PARTIAL" } : {}) },
            $inc: { totalAmount: r2(dRoom + dTax), taxAmount: dTax, cgstAmount: dCgst, sgstAmount: dSgst },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  // 2. Early check-out: credit the unused nights (at the new rate) and their GST.
  const { applyEarlyDeparture } = await import("./early-departure.service");
  const early = await applyEarlyDeparture(String(booking._id), { req: p.req });

  const defaultRate = Number(booking.roomCategory?.basePrice ?? 0);
  if (defaultRate > 0 && rate < defaultRate) {
    const { queueForVerification } = await import("./reception-verification");
    const { VerificationType } = await import("../models/VerificationRequest");
    await queueForVerification({
      type: VerificationType.TARIFF_BELOW_DEFAULT,
      subjectKey: `checkoutTariff:${booking._id}:${Date.now()}`,
      returnQueue: "FRONT_DESK",
      summary: `Checkout tariff ₹${rate}/night (default ₹${defaultRate})`,
      amount: r2((defaultRate - rate) * nights),
      bookingId: booking._id,
      folioId: folio._id,
      details: { rate, defaultRate, nights, reason },
      note: reason,
      req: p.req,
    } as any);
  }

  await createAuditLog({
    req: p.req,
    action: "booking.checkout_tariff",
    resourceType: "Booking",
    resourceId: String(booking._id),
    metadata: { bookingReference: booking.bookingReference, rate, nights, roomBefore: roomNow, roomAfter: roomTarget, dCgst, dSgst, early: early ?? null, reason },
  });
  return { nights: Math.max(1, nights - (early?.nightsCredited?.length ?? 0)), rate, roomBefore: roomNow, roomAfter: roomTarget, taxDifference: r2(dCgst + dSgst), earlyDeparture: early ?? null };
}
