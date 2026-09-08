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
async function ensureInventoryDayDocuments(roomCategoryId: string, dates: Date[], capacity: number) {
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

export async function reserveInventoryDays(params: {
  roomCategoryId: string;
  checkInDate: Date;
  checkOutDate: Date;
  session: mongoose.ClientSession;
}) {
  const { roomCategoryId, checkInDate, checkOutDate, session } = params;
  const dates = buildStayDates(checkInDate, checkOutDate);

  // Capacity must be read WITHOUT the transaction's session, and before any
  // session-scoped operation runs. A MongoDB transaction's read snapshot is
  // established at its first session-scoped operation — if that happened
  // here, ensureInventoryDayDocuments's non-transactional writes (below)
  // would already be "in the past" relative to the snapshot, making the
  // documents it just created invisible to the later transactional claim.
  const capacity = await Room.countDocuments({
    category: roomCategoryId,
    status: { $nin: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] },
  });

  if (capacity <= 0) {
    throw new BookingConflictError("No rooms available for the selected category");
  }

  await ensureInventoryDayDocuments(roomCategoryId, dates, capacity);

  // This is the first session-scoped operation — the transaction's snapshot
  // is established here, after the ensure-step above has already committed.
  for (const stayDate of dates) {
    const reservation = await BookingInventoryDay.findOneAndUpdate(
      {
        roomCategory: roomCategoryId,
        stayDate,
        reservedCount: { $lt: capacity },
      },
      {
        $set: { capacity },
        $inc: { reservedCount: 1 },
      },
      { returnDocument: "after", session }
    );

    if (!reservation) {
      throw new BookingConflictError("Requested inventory is no longer available");
    }
  }
}

export async function releaseInventoryDays(params: {
  roomCategoryId: string;
  checkInDate: Date;
  checkOutDate: Date;
  session?: mongoose.ClientSession;
}) {
  const { roomCategoryId, checkInDate, checkOutDate, session } = params;
  const dates = buildStayDates(checkInDate, checkOutDate);

  for (const stayDate of dates) {
    await BookingInventoryDay.findOneAndUpdate(
      {
        roomCategory: roomCategoryId,
        stayDate,
        reservedCount: { $gt: 0 },
      },
      {
        $inc: { reservedCount: -1 },
      },
      session ? { session } : {}
    );
  }
}
