/**
 * Moves a booking to another room.
 *
 * In-house (CHECKED_IN): the remaining nights (today → check-out) move to the new room; the old
 * room becomes VACANT + DIRTY with a cleaning task; the new room becomes OCCUPIED.
 * Before arrival (PENDING / CONFIRMED): only the assignment and held nights move.
 *
 * Rate: "KEEP" keeps the agreed nightly rate. "NEW" changes it (given rate, else the new room
 * type's base rate). For remaining nights that were already charged, the difference is posted
 * (a ROOM_CHARGE when dearer, a REVERSAL when cheaper — both name the nights), with GST at the
 * right slab; nights not yet charged are charged by the night audit at the new rate.
 */
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType } from "../models/HousekeepingTask";
import { RoomNight } from "../models/RoomNight";
import { addDays, toBusinessDate, todayBusinessDate } from "../../../shared/dates";
import { computeRoomTax, loadGstRules, pricesIncludeTax } from "./tax.service";
import { postCharge } from "./folio.service";
import { createAuditLog } from "./audit.service";

export class RoomMoveError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const nightsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
};

/** Nights already charged on the folio (by a line that names them, or a stay-total line). */
function chargedNights(lines: any[], booking: any): Set<string> {
  const stayIn = toBusinessDate(booking.checkInDate);
  const rate = Number(booking.ratePerNight) || 0;
  const out = new Set<string>();
  for (const l of lines) {
    if (l.lineType !== FolioLineType.ROOM_CHARGE) continue;
    if (l.coversNights?.length) l.coversNights.forEach((d: string) => out.add(d));
    else if (rate > 0) nightsBetween(stayIn, addDays(stayIn, Math.max(1, Math.round(l.amount / rate)))).forEach((d) => out.add(d));
  }
  return out;
}

export async function moveBookingToRoom(p: {
  bookingId: string;
  roomId: string;
  rateMode?: "KEEP" | "NEW";
  newRatePerNight?: number;
  reason?: string;
  req?: any;
}) {
  const booking: any = await Booking.findById(p.bookingId);
  if (!booking) throw new RoomMoveError("Booking not found", 404);
  if (![BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(booking.status)) {
    throw new RoomMoveError(`A ${booking.status} booking can't be moved`, 409);
  }
  const room: any = await Room.findById(p.roomId).populate("category", "name basePrice");
  if (!room) throw new RoomMoveError("Room not found", 404);
  if (String(booking.assignedRoom) === String(room._id)) throw new RoomMoveError("The guest is already in this room");
  if (room.sellStatus !== SellStatus.SELLABLE) throw new RoomMoveError(`Room ${room.roomNumber} is not available (${room.sellStatus})`, 409);
  const inHouse = booking.status === BookingStatus.CHECKED_IN;
  if (inHouse && (room.occupancyStatus === OccupancyStatus.OCCUPIED || room.housekeepingStatus !== HousekeepingRoomStatus.CLEAN)) {
    throw new RoomMoveError(`Room ${room.roomNumber} must be vacant and clean to move a guest in`, 409);
  }

  const oldRate = Number(booking.ratePerNight) || 0;
  const newRate = p.rateMode === "NEW" ? r2(Number(p.newRatePerNight) || Number(room.category?.basePrice) || oldRate) : oldRate;
  if (!(newRate > 0) && p.rateMode === "NEW") throw new RoomMoveError("Enter the new nightly rate");

  const today = todayBusinessDate();
  const stayIn = toBusinessDate(booking.checkInDate);
  const stayOut = toBusinessDate(booking.checkOutDate);
  const from = inHouse ? (today > stayIn ? today : stayIn) : stayIn;
  const remaining = nightsBetween(from, stayOut);
  const oldRoomId = booking.assignedRoom ? String(booking.assignedRoom) : null;
  const actor = p.req?.user?.id ? String(p.req.user.id) : "FRONT_DESK";
  let diffCharge = 0;
  let diffTax = { cgst: 0, sgst: 0 };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Remaining room-nights move to the new room (unique room + night rejects a clash).
      await RoomNight.deleteMany({ booking: booking._id, date: { $in: remaining } }).session(session);
      if (remaining.length) {
        try {
          await RoomNight.insertMany(remaining.map((date) => ({ room: room._id, date, booking: booking._id, propertyId: booking.propertyId, status: "HELD" })), { session });
        } catch (e: any) {
          if (e?.code === 11000) throw new RoomMoveError(`Room ${room.roomNumber} is already booked for some of these nights`, 409);
          throw e;
        }
      }

      // 2. Rate difference for nights already charged.
      const folio: any = inHouse ? await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN }).session(session) : null;
      if (folio && newRate !== oldRate && remaining.length) {
        const lines: any[] = await FolioLine.find({ folio: folio._id }).session(session).lean();
        const charged = chargedNights(lines, booking);
        const nights = remaining.filter((d) => charged.has(d));
        if (nights.length) {
          const rules = await loadGstRules();
          // When the booking's prices include GST, the rates include it: compare values excluding GST.
          const inclusive = pricesIncludeTax(booking);
          const oldTax = computeRoomTax(rules, { checkIn: nights[0], checkOut: addDays(nights[nights.length - 1], 1), nightlyValue: oldRate, inclusive });
          const newTax = computeRoomTax(rules, { checkIn: nights[0], checkOut: addDays(nights[nights.length - 1], 1), nightlyValue: newRate, inclusive });
          diffCharge = inclusive ? r2(newTax.taxable - oldTax.taxable) : r2((newRate - oldRate) * nights.length);
          diffTax = { cgst: r2(newTax.cgst - oldTax.cgst), sgst: r2(newTax.sgst - oldTax.sgst) };
          const label = `Room move to ${room.roomNumber}: ₹${oldRate.toLocaleString("en-IN")} → ₹${newRate.toLocaleString("en-IN")} × ${nights.length} night${nights.length > 1 ? "s" : ""}`;
          const roomLine = lines.find((l) => l.lineType === FolioLineType.ROOM_CHARGE);
          const cgstLine = lines.find((l) => l.lineType === FolioLineType.TAX_CGST);
          const sgstLine = lines.find((l) => l.lineType === FolioLineType.TAX_SGST);
          const post = (lineType: FolioLineType, amount: number, description: string, reversedLineId?: string) =>
            postCharge({ folioId: String(folio._id), bookingId: String(booking._id), lineType, description, amount: r2(Math.abs(amount)), date: new Date(), postedBy: actor, coversNights: nights, ...(reversedLineId ? { reversedLineId } : {}) } as any, { req: p.req, session });
          if (diffCharge > 0) await post(FolioLineType.ROOM_CHARGE, diffCharge, label);
          else if (diffCharge < 0 && roomLine) await post(FolioLineType.REVERSAL, diffCharge, label, String(roomLine._id));
          for (const [amount, type, line, name] of [[diffTax.cgst, FolioLineType.TAX_CGST, cgstLine, "CGST"], [diffTax.sgst, FolioLineType.TAX_SGST, sgstLine, "SGST"]] as const) {
            if (amount > 0) await post(type, amount, `${name} on room move difference`);
            else if (amount < 0 && line) await post(FolioLineType.REVERSAL, amount, `${name} on room move difference`, String(line._id));
          }
        }
      }

      // 3. Booking.
      const totalTaxDiff = r2(diffTax.cgst + diffTax.sgst);
      booking.assignedRoom = room._id;
      if (room.category?._id) booking.roomCategory = room.category._id;
      booking.ratePerNight = newRate;
      if (diffCharge || totalTaxDiff) {
        booking.totalAmount = r2((booking.totalAmount || 0) + diffCharge + totalTaxDiff);
        booking.taxAmount = r2((booking.taxAmount || 0) + totalTaxDiff);
        booking.cgstAmount = r2((booking.cgstAmount || 0) + diffTax.cgst);
        booking.sgstAmount = r2((booking.sgstAmount || 0) + diffTax.sgst);
      }
      await booking.save({ session });

      // 4. Rooms (in-house): old room to housekeeping, new room occupied.
      if (inHouse) {
        if (oldRoomId) {
          const old: any = await Room.findById(oldRoomId).session(session);
          if (old) {
            old.status = RoomStatus.CLEANING;
            old.occupancyStatus = OccupancyStatus.VACANT;
            old.housekeepingStatus = HousekeepingRoomStatus.DIRTY;
            old.currentBooking = undefined;
            await old.save({ session });
            await HousekeepingTask.create([{
              propertyId: old.propertyId || booking.propertyId,
              room: old._id,
              status: HousekeepingStatus.DIRTY,
              priority: HousekeepingPriority.HIGH,
              taskType: HousekeepingTaskType.CHECKOUT_CLEAN,
              notes: `Room move: ${booking.guestDetails?.firstName ?? "Guest"} moved to ${room.roomNumber} (${booking.bookingReference})`,
            }], { session });
          }
        }
        room.status = RoomStatus.OCCUPIED;
        room.occupancyStatus = OccupancyStatus.OCCUPIED;
        room.currentBooking = booking._id;
        await room.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }

  await createAuditLog({
    req: p.req,
    action: "booking.room_moved",
    resourceType: "Booking",
    resourceId: String(booking._id),
    metadata: { bookingReference: booking.bookingReference, fromRoom: oldRoomId, toRoom: room.roomNumber, oldRate, newRate, nightsMoved: remaining.length, rateDifference: diffCharge, taxDifference: diffTax, reason: p.reason },
  });
  return { roomNumber: room.roomNumber, oldRate, newRate, nightsMoved: remaining.length, rateDifference: diffCharge, taxDifference: diffTax };
}
