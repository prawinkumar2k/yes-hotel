import { SELLABLE_ROOM_FILTER } from "./maintenance.service";
import crypto from "crypto";
import mongoose from "mongoose";
import { BookingInventoryDay } from "../models/BookingInventoryDay";
import { Room, RoomStatus } from "../models/Room";

export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingConflictError";
  }
}

export function normalizeBookingDate(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid booking date");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function buildStayDates(checkInDate: Date | string, checkOutDate: Date | string) {
  const start = normalizeBookingDate(checkInDate);
  const end = normalizeBookingDate(checkOutDate);
  const dates: Date[] = [];

  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(new Date(cursor));
  }

  return dates;
}

export function buildBookingRequestHash(payload: {
  roomCategoryId: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  adults: number;
  children?: number;
  guestDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  specialRequests?: string;
  couponCode?: string;
}) {
  const normalized = {
    roomCategoryId: payload.roomCategoryId,
    checkInDate: normalizeBookingDate(payload.checkInDate).toISOString(),
    checkOutDate: normalizeBookingDate(payload.checkOutDate).toISOString(),
    adults: Number(payload.adults),
    children: Number(payload.children ?? 0),
    guestDetails: {
      firstName: payload.guestDetails.firstName.trim(),
      lastName: payload.guestDetails.lastName.trim(),
      email: payload.guestDetails.email.trim().toLowerCase(),
      phone: payload.guestDetails.phone.trim(),
    },
    specialRequests: (payload.specialRequests || "").trim(),
    couponCode: (payload.couponCode || "").trim().toUpperCase(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Claims one inventory unit per stay-night, atomically, inside the caller's
 * MongoDB session/transaction. Every write in this function is scoped to
 * `session` — if any later step in the same transaction fails (including a
 * process crash before commit), MongoDB discards ALL of these writes as a
 * unit. There is no manual compensating rollback here anymore: the
 * transaction boundary IS the rollback mechanism, which is strictly stronger
 * than application-level compensation (it also survives a crash mid-loop,
 * which compensating code cannot).
 *
 * A `BookingConflictError` here is a genuine, durable capacity conflict
 * (reservedCount already at capacity for an existing day).
 *
 * IMPORTANT: once any operation inside a MongoDB transaction fails (e.g. a
 * duplicate-key error from an upsert), the server marks that transaction
 * aborted — no further operation can run on the same session/attempt, even
 * a "harmless" retry query. That rules out upsert-then-catch-and-retry
 * inside the transaction itself. So this function is split into two phases:
 *
 *   1. ensureInventoryDayDocuments — runs OUTSIDE the transaction, with
 *      plain per-date upserts that only ever set the document into
 *      existence (reservedCount stays untouched on an existing doc). A
 *      concurrent duplicate-insert race here is expected and harmless: one
 *      upsert wins, the other's insert attempt fails with E11000, which is
 *      caught and ignored — the document exists either way, which is all
 *      this phase needs to guarantee.
 *   2. The atomic claim below runs INSIDE the transaction and never
 *      upserts — every document it touches is guaranteed to already exist
 *      by phase 1, so a non-match can only mean "capacity exhausted",
 *      never "needs to be created". That removes the upsert/E11000
 *      ambiguity entirely from the transactional path.
 */
export async function ensureInventoryDayDocuments(roomCategoryId: string, dates: Date[], capacity: number) {
  for (const stayDate of dates) {
    try {
      await BookingInventoryDay.updateOne(
        { roomCategory: roomCategoryId, stayDate },
        { $setOnInsert: { roomCategory: roomCategoryId, stayDate, capacity, reservedCount: 0 } },
        { upsert: true }
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      // Another request created this day's document first — that's fine,
      // the document exists now, which is all this phase needs.
    }
  }
}

/**
 * Step 1 (OUTSIDE any transaction): makes sure the inventory-day documents exist and returns
 * the category capacity. A transaction snapshot taken earlier would not see documents created
 * here, so call this before the transaction starts (or before its first operation).
 */
export async function prepareInventoryDays(roomCategoryId: string, checkInDate: Date, checkOutDate: Date): Promise<number> {
  const capacity = await Room.countDocuments({ category: roomCategoryId, ...SELLABLE_ROOM_FILTER });
  if (capacity <= 0) throw new BookingConflictError("No rooms available for the selected category");
  await ensureInventoryDayDocuments(roomCategoryId, buildStayDates(checkInDate, checkOutDate), capacity);
  return capacity;
}

/** Step 2 (INSIDE the transaction): claims `count` rooms per night, or throws when sold out. */
export async function claimInventoryDays(params: { roomCategoryId: string; checkInDate: Date; checkOutDate: Date; capacity: number; count?: number; session: mongoose.ClientSession }) {
  const { roomCategoryId, checkInDate, checkOutDate, capacity, session } = params;
  const count = Math.max(1, params.count ?? 1);
  for (const stayDate of buildStayDates(checkInDate, checkOutDate)) {
    const reservation = await BookingInventoryDay.findOneAndUpdate(
      { roomCategory: roomCategoryId, stayDate, reservedCount: { $lte: capacity - count } },
      { $set: { capacity }, $inc: { reservedCount: count } },
      { returnDocument: "after", session }
    );
    if (!reservation) throw new BookingConflictError("Requested inventory is no longer available");
  }
}

/**
 * prepare + claim in one call. Only safe as the FIRST operation of a transaction (the prepare
 * step writes outside the session); otherwise call prepareInventoryDays before the transaction
 * and claimInventoryDays inside it.
 */
export async function reserveInventoryDays(params: {
  roomCategoryId: string;
  checkInDate: Date;
  checkOutDate: Date;
  session: mongoose.ClientSession;
  /** Rooms to claim per night (default 1). */
  count?: number;
}) {
  const capacity = await prepareInventoryDays(params.roomCategoryId, params.checkInDate, params.checkOutDate);
  await claimInventoryDays({ ...params, capacity });
}

export async function releaseInventoryDays(params: {
  roomCategoryId: string;
  checkInDate: Date;
  checkOutDate: Date;
  session?: mongoose.ClientSession;
  /** Rooms to release per night (default 1). */
  count?: number;
}) {
  const { roomCategoryId, checkInDate, checkOutDate, session } = params;
  const count = Math.max(1, params.count ?? 1);
  const dates = buildStayDates(checkInDate, checkOutDate);

  for (const stayDate of dates) {
    await BookingInventoryDay.findOneAndUpdate(
      {
        roomCategory: roomCategoryId,
        stayDate,
        reservedCount: { $gte: count },
      },
      {
        $inc: { reservedCount: -count },
      },
      session ? { session } : {}
    );
  }
}
