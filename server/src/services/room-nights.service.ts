/**
 * Room-night inventory (models/RoomNight.ts). Every path that gives a booking a physical
 * room, or changes its dates, claims the nights here; cancellation / no-show / early
 * checkout release them. Run inside the caller's transaction so the claim and the booking
 * change commit together.
 */
import mongoose from "mongoose";
import { RoomNight } from "../models/RoomNight";
import { stayNights, todayBusinessDate } from "../../../shared/dates";

export class RoomUnavailableError extends Error {
  constructor(public readonly roomId: string, public readonly dates: string[], public readonly heldBy?: string) {
    super(`Room is already booked for ${dates.join(", ")}${heldBy ? ` (booking ${heldBy})` : ""}`);
    this.name = "RoomUnavailableError";
  }
}

type Id = mongoose.Types.ObjectId | string;
const oid = (x: Id) => (typeof x === "string" ? new mongoose.Types.ObjectId(x) : x);

/**
 * Holds the nights [checkIn, checkOut) of `roomId` for `bookingId`. Nights this booking
 * already holds on this room are kept; nights it held on another room are released.
 * Throws RoomUnavailableError if any night is held by a different booking.
 */
export async function claimRoomNights(params: {
  bookingId: Id;
  roomId: Id;
  checkIn: Date | string;
  checkOut: Date | string;
  propertyId?: Id;
  session?: mongoose.ClientSession;
}): Promise<string[]> {
  const { session } = params;
  const bookingId = oid(params.bookingId);
  const roomId = oid(params.roomId);
  const dates = stayNights(params.checkIn, params.checkOut);

  // Release nights this booking holds on any other room or outside the new dates.
  await RoomNight.deleteMany({
    booking: bookingId,
    status: "HELD",
    $or: [{ room: { $ne: roomId } }, { date: { $nin: dates } }],
  }).session(session ?? null);

  const held = new Set(
    (await RoomNight.find({ booking: bookingId, room: roomId }).select("date").session(session ?? null).lean()).map((n) => n.date),
  );
  const toInsert = dates.filter((d) => !held.has(d));
  if (!toInsert.length) return dates;

  // Pre-check for a clear error message; the unique index is what actually guarantees it.
  const taken = await RoomNight.find({ room: roomId, date: { $in: toInsert }, booking: { $ne: bookingId } })
    .select("date booking")
    .session(session ?? null)
    .lean();
  if (taken.length) throw new RoomUnavailableError(String(roomId), taken.map((t) => t.date).sort(), String(taken[0].booking));

  try {
    await RoomNight.insertMany(
      toInsert.map((date) => ({ room: roomId, date, booking: bookingId, propertyId: params.propertyId, status: "HELD" })),
      { session, ordered: true },
    );
  } catch (e: any) {
    if (e?.code === 11000 || e?.writeErrors?.some?.((w: any) => w.code === 11000)) {
      throw new RoomUnavailableError(String(roomId), toInsert);
    }
    throw e;
  }
  return dates;
}

/** Releases every night the booking still holds (cancel, no-show). */
export async function releaseRoomNights(bookingId: Id, session?: mongoose.ClientSession): Promise<number> {
  const r = await RoomNight.deleteMany({ booking: oid(bookingId), status: "HELD" }).session(session ?? null);
  return r.deletedCount ?? 0;
}

/**
 * On checkout: nights up to and including the last night stayed become CONSUMED; nights
 * after the departure date (early checkout) are released for resale.
 */
export async function settleRoomNightsOnCheckout(
  bookingId: Id,
  departureDate: string = todayBusinessDate(),
  session?: mongoose.ClientSession,
): Promise<void> {
  const id = oid(bookingId);
  await RoomNight.deleteMany({ booking: id, status: "HELD", date: { $gte: departureDate } }).session(session ?? null);
  await RoomNight.updateMany({ booking: id, date: { $lt: departureDate } }, { $set: { status: "CONSUMED" } }).session(session ?? null);
}

/** Room ids that have any held night in [checkIn, checkOut), excluding one booking. */
export async function roomsTakenBetween(
  checkIn: Date | string,
  checkOut: Date | string,
  opts: { excludeBookingId?: Id; session?: mongoose.ClientSession } = {},
): Promise<Set<string>> {
  const dates = stayNights(checkIn, checkOut);
  if (!dates.length) return new Set();
  const q: any = { date: { $in: dates } };
  if (opts.excludeBookingId) q.booking = { $ne: oid(opts.excludeBookingId) };
  const rows = await RoomNight.find(q).select("room").session(opts.session ?? null).lean();
  return new Set(rows.map((r) => String(r.room)));
}
