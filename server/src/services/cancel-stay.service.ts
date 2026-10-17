/**
 * Cancels a stay that is already checked in (a check-in made by mistake, a guest who leaves at
 * once, a walk-in that falls through). Staff only, with a reason.
 *
 * In one transaction:
 * - every charge, tax, discount and advance application on the folio is reversed (the lines stay
 *   for the audit trail); reversing an advance application returns the money to the advance;
 * - an optional cancellation charge (with GST at the right slab) is posted in their place;
 * - the booking becomes CANCELLED, its room nights and inventory are released;
 * - the room becomes vacant and dirty, with a cleaning task.
 * Money still held afterwards (folio credit + unused advances) is returned as `refundDue`, and the
 * folio stays open so Reception can refund it; with nothing held the folio is VOIDED.
 */
import mongoose from "mongoose";
import type { Request } from "express";
import { Booking, BookingStatus } from "../models/Booking";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus } from "../models/Room";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType } from "../models/HousekeepingTask";
import { AdvancePayment } from "../models/AdvancePayment";
import { postCharge, recomputeFolioBalance, reverseFolioLine } from "./folio.service";
import { transitionBookingStatus } from "./booking-state.service";
import { releaseInventoryDays } from "./booking-safety.service";
import { computeChargeTax, loadRoomPricing, pricesIncludeTax } from "./tax.service";
import { applyAdvancesToFolio } from "./advance.service";
import { createAuditLog } from "./audit.service";

export class CancelStayError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Money lines are kept: they are what the guest actually paid (refunded separately). */
const KEEP = new Set<string>([FolioLineType.PAYMENT, FolioLineType.REFUND, FolioLineType.REVERSAL]);

export async function cancelCheckedInStay(p: {
  bookingId: string;
  reason: string;
  /** What the hotel keeps for the cancelled stay (e.g. hours used), as charged to the guest. */
  cancellationCharge?: number;
  actorId: string;
  req?: Request;
}) {
  const reason = String(p.reason ?? "").trim();
  if (reason.length < 3) throw new CancelStayError("Enter the reason for cancelling this stay");
  const charge = r2(Number(p.cancellationCharge) || 0);
  if (charge < 0) throw new CancelStayError("The cancellation charge cannot be negative");

  let out!: { bookingReference: string; roomNumber?: string; reversedLines: number; cancellationCharge: number; refundDue: number; amountDue: number; folioStatus?: string };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const booking: any = await Booking.findById(p.bookingId).session(session);
      if (!booking) throw new CancelStayError("Booking not found", 404);
      if (booking.status !== BookingStatus.CHECKED_IN) {
        throw new CancelStayError(`Only a checked-in stay can be cancelled here (this booking is ${booking.status})`, 409);
      }

      // 1. Folio: reverse everything that isn't money received.
      const folio: any = await Folio.findOne({ booking: booking._id }).session(session);
      let reversedLines = 0;
      let refundDue = 0;
      let amountDue = 0;
      if (folio) {
        if (folio.status !== FolioStatus.OPEN) throw new CancelStayError(`The bill is ${folio.status}; it can no longer be cancelled`, 409);
        const lines = await FolioLine.find({ folio: folio._id }).session(session).lean();
        const reversed = new Set(lines.filter((l: any) => l.reversedLineId).map((l: any) => String(l.reversedLineId)));
        for (const l of lines as any[]) {
          if (KEEP.has(l.lineType) || reversed.has(String(l._id))) continue;
          await reverseFolioLine(String(folio._id), String(l._id), `Stay cancelled: ${reason}`, { req: p.req, session, postedBy: p.actorId });
          reversedLines++;
        }

        // 2. Cancellation charge, if any (the amount is what the guest pays; GST inside or on top as the hotel prices).
        if (charge > 0) {
          const pricing = await loadRoomPricing();
          const inclusive = pricesIncludeTax(booking);
          // The room was used, so it is charged (and taxed) as accommodation.
          const tax = computeChargeTax(pricing.rules, FolioLineType.ROOM_CHARGE, charge, new Date(), { nightlyValue: booking.ratePerNight || charge, inclusive })!;
          const pct = (tax.lines[0]?.rate ?? 0) / 2;
          const base = { folioId: String(folio._id), bookingId: String(booking._id), date: new Date(), postedBy: p.actorId };
          await postCharge({ ...base, lineType: FolioLineType.ROOM_CHARGE, description: "Cancellation charge (stay cancelled after check-in)", amount: inclusive ? tax.taxable : charge, notes: reason }, { req: p.req, session });
          if (tax.cgst > 0) await postCharge({ ...base, lineType: FolioLineType.TAX_CGST, description: `CGST (${pct}%) on cancellation charge`, amount: tax.cgst }, { req: p.req, session });
          if (tax.sgst > 0) await postCharge({ ...base, lineType: FolioLineType.TAX_SGST, description: `SGST (${pct}%) on cancellation charge`, amount: tax.sgst }, { req: p.req, session });
        }

        // 3. The guest's advance pays the cancellation charge first; what's left over is owed back
        //    to them (or, if the charge is more than they paid, still due).
        if (charge > 0) {
          await applyAdvancesToFolio(
            { bookingId: String(booking._id), folioId: String(folio._id), maxAmount: Number.MAX_SAFE_INTEGER, performedBy: p.actorId, reason: "Cancellation charge" },
            { req: p.req, session },
          );
        }
        const totals = await recomputeFolioBalance(String(folio._id), { session });
        amountDue = Math.max(0, totals.balance);
        const held = await AdvancePayment.aggregate([{ $match: { booking: booking._id, remainingBalance: { $gt: 0 } } }, { $group: { _id: null, t: { $sum: "$remainingBalance" } } }]).session(session);
        refundDue = r2(Math.max(0, -totals.balance) + (held[0]?.t ?? 0));
        folio.totalCharges = totals.totalCharges;
        folio.totalTax = totals.totalTax;
        folio.totalDiscounts = totals.totalDiscounts;
        folio.totalPaid = totals.totalPaid;
        folio.balance = totals.balance;
        // Nothing owed either way: a cancelled stay with no charge is VOIDED; a paid cancellation charge is SETTLED.
        if (totals.balance === 0 && refundDue === 0) folio.status = charge > 0 ? FolioStatus.SETTLED : FolioStatus.VOIDED;
        await folio.save({ session });
      } else {
        const held = await AdvancePayment.aggregate([{ $match: { booking: booking._id, remainingBalance: { $gt: 0 } } }, { $group: { _id: null, t: { $sum: "$remainingBalance" } } }]).session(session);
        refundDue = r2(held[0]?.t ?? 0);
      }

      // 4. Booking: cancelled; nights and inventory released.
      await transitionBookingStatus(booking, BookingStatus.CANCELLED, {
        req: p.req,
        session,
        action: "booking.checked_in_stay_cancelled",
        inHouseCancellation: true,
        metadata: { reason, reversedLines, cancellationCharge: charge, refundDue },
      });
      booking.cancelledAt = new Date();
      booking.cancelledBy = p.actorId as any;
      booking.cancellationReason = reason;
      booking.cancellationPenalty = charge;
      await booking.save({ session });
      if (booking.roomCategory) {
        await releaseInventoryDays({ roomCategoryId: String(booking.roomCategory), checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, session });
      }

      // 5. Room: vacant, to housekeeping.
      let roomNumber: string | undefined;
      if (booking.assignedRoom) {
        const room: any = await Room.findById(booking.assignedRoom).session(session);
        if (room && (!room.currentBooking || String(room.currentBooking) === String(booking._id))) {
          roomNumber = room.roomNumber;
          room.status = RoomStatus.CLEANING;
          room.occupancyStatus = OccupancyStatus.VACANT;
          room.housekeepingStatus = HousekeepingRoomStatus.DIRTY;
          room.currentBooking = undefined;
          await room.save({ session });
          await HousekeepingTask.create([{
            propertyId: room.propertyId || booking.propertyId,
            room: room._id,
            status: HousekeepingStatus.DIRTY,
            priority: HousekeepingPriority.HIGH,
            taskType: HousekeepingTaskType.CHECKOUT_CLEAN,
            notes: `Stay cancelled after check-in (${booking.bookingReference}): ${reason}`,
          }], { session });
        }
      }

      out = { bookingReference: booking.bookingReference, roomNumber, reversedLines, cancellationCharge: charge, refundDue, amountDue, folioStatus: folio?.status };
    });
  } finally {
    await session.endSession();
  }

  await createAuditLog({
    req: p.req,
    action: "booking.cancel_check_in",
    resourceType: "Booking",
    resourceId: p.bookingId,
    metadata: { ...out, reason },
  });
  return out;
}
