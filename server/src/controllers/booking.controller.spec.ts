import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createBooking, checkAvailability } from "./booking.controller";
import { cancelBooking } from "./cancellation.controller";
import { RoomCategory } from "../models/RoomCategory";
import { Room, RoomStatus } from "../models/Room";
import { Booking, BookingStatus } from "../models/Booking";
import { BookingInventoryDay } from "../models/BookingInventoryDay";
import { BookingIdempotency } from "../models/BookingIdempotency";
import { AuditLog } from "../models/AuditLog";
import { Guest } from "../models/Guest";
import { Coupon, DiscountType } from "../models/Coupon";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels";

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

async function callController(handler: any, req: any) {
  const res = mockRes();
  await handler(req, res);
  if (res.statusCode >= 500) {
    console.log("controller-error", JSON.stringify(res.body));
  }
  return res;
}

async function createTempInventory() {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  const category = await RoomCategory.create({
    slug: `phase3-module2-${stamp}`,
    name: `Module 2 Test ${stamp}`,
    description: "Temporary test category for booking concurrency",
    basePrice: 5000,
    capacity: { adults: 2, children: 1 },
    bedType: "Queen",
    amenities: ["Wi-Fi"],
    images: [],
    isActive: true,
  });

  await Room.create({
    roomNumber: `T-${stamp}`,
    floor: "9",
    category: category._id,
    status: RoomStatus.AVAILABLE,
  });

  return category;
}

function bookingReq(overrides: Record<string, any> = {}) {
  return {
    body: {
      roomCategoryId: overrides.roomCategoryId,
      checkInDate: overrides.checkInDate,
      checkOutDate: overrides.checkOutDate,
      adults: overrides.adults ?? 1,
      children: overrides.children ?? 0,
      guestDetails: overrides.guestDetails ?? {
        firstName: "Test",
        lastName: "Guest",
        email: "test@example.com",
        phone: "9999999999",
      },
      specialRequests: overrides.specialRequests ?? "",
      couponCode: overrides.couponCode,
    },
    headers: {
      "idempotency-key": overrides.idempotencyKey,
    },
    user: overrides.user,
    query: overrides.query,
    params: overrides.params,
    ip: "127.0.0.1",
  };
}

const customerId = new mongoose.Types.ObjectId().toString();
describe("booking concurrency and idempotency", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("creates one booking and one booking.created audit event for a normal request", async () => {
    const category = await createTempInventory();
    const key = `normal-${randomUUID()}`;
    const req = bookingReq({
      roomCategoryId: category._id.toString(),
      checkInDate: "2026-11-10",
      checkOutDate: "2026-11-12",
      idempotencyKey: key,
      user: { id: customerId, role: "CUSTOMER" },
    });

    const res = await callController(createBooking, req);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.bookingReference).toBeTruthy();

    const bookingCount = await Booking.countDocuments({ bookingReference: res.body.data.bookingReference });
    expect(bookingCount).toBe(1);

    const auditCount = await AuditLog.countDocuments({
      action: "booking.created",
      resourceId: res.body.data._id,
      "metadata.idempotencyKey": key,
    });
    expect(auditCount).toBe(1);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": key });
  });

  it("returns the original booking for the same idempotency key", async () => {
    const category = await createTempInventory();
    const key = `idem-${randomUUID()}`;
    const baseReq = {
      roomCategoryId: category._id.toString(),
      checkInDate: "2026-11-15",
      checkOutDate: "2026-11-17",
      idempotencyKey: key,
      user: { id: customerId, role: "CUSTOMER" },
    };

    const first = await callController(createBooking, bookingReq(baseReq));
    expect(first.statusCode).toBe(201);

    const second = await callController(createBooking, bookingReq(baseReq));
    expect(second.statusCode).toBe(200);
    expect(second.body.data._id.toString()).toBe(first.body.data._id.toString());

    const bookingCount = await Booking.countDocuments({ roomCategory: category._id });
    expect(bookingCount).toBe(1);

    const auditCount = await AuditLog.countDocuments({
      action: "booking.created",
      "metadata.idempotencyKey": key,
    });
    expect(auditCount).toBe(1);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": key });
  });

  it("conflicts when two genuine booking attempts target the same exhausted inventory", async () => {
    const category = await createTempInventory();
    const checkInDate = "2026-11-20";
    const checkOutDate = "2026-11-22";
    const firstKey = `conflict-a-${randomUUID()}`;
    const secondKey = `conflict-b-${randomUUID()}`;

    const first = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate,
        checkOutDate,
        idempotencyKey: firstKey,
        user: { id: customerId, role: "CUSTOMER" },
      })
    );
    expect(first.statusCode).toBe(201);

    const second = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate,
        checkOutDate,
        idempotencyKey: secondKey,
        user: { id: customerId, role: "CUSTOMER" },
      })
    );
    expect(second.statusCode).toBe(409);

    const bookingCount = await Booking.countDocuments({ roomCategory: category._id });
    expect(bookingCount).toBe(1);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key: { $in: [firstKey, secondKey] } });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": { $in: [firstKey, secondKey] } });
  });

  it("rejects stale availability at final booking creation time", async () => {
    const category = await createTempInventory();
    const checkInDate = "2026-11-25";
    const checkOutDate = "2026-11-27";

    const availabilityReq = {
      query: { checkIn: checkInDate, checkOut: checkOutDate, adults: 1, children: 0 },
    };

    const availabilityRes = await callController(checkAvailability, availabilityReq);
    expect(availabilityRes.statusCode).toBe(200);
    expect(availabilityRes.body.data.length).toBeGreaterThan(0);

    const first = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate,
        checkOutDate,
        idempotencyKey: `stale-fill-${randomUUID()}`,
        user: { id: customerId, role: "CUSTOMER" },
      })
    );
    expect(first.statusCode).toBe(201);

    const stale = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate,
        checkOutDate,
        idempotencyKey: `stale-blocked-${randomUUID()}`,
        user: { id: customerId, role: "CUSTOMER" },
      })
    );
    expect(stale.statusCode).toBe(409);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key: /stale-/ });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": /stale-/ });
  });

  it("releases inventory on cancellation", async () => {
    const category = await createTempInventory();
    const key = `cancel-${randomUUID()}`;
    const req = bookingReq({
      roomCategoryId: category._id.toString(),
      checkInDate: "2026-11-30",
      checkOutDate: "2026-12-02",
      idempotencyKey: key,
      user: { id: customerId, role: "CUSTOMER" },
    });

    const created = await callController(createBooking, req);
    expect(created.statusCode).toBe(201);

    const cancelReq = {
      params: { id: created.body.data._id.toString() },
      user: { id: customerId, role: "CUSTOMER" },
    };
    const cancelled = await callController(cancelBooking, cancelReq);
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.body.data.status).toBe(BookingStatus.CANCELLED);

    const inventory = await BookingInventoryDay.find({ roomCategory: category._id });
    expect(inventory.every((doc) => doc.reservedCount === 0)).toBe(true);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": key });
  });

  it("rejects malformed booking input without creating partial records", async () => {
    const category = await createTempInventory();
    const key = `invalid-${randomUUID()}`;
    const res = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate: "2026-12-05",
        checkOutDate: "2026-12-04",
        idempotencyKey: key,
        user: { id: customerId, role: "CUSTOMER" },
      })
    );

    expect(res.statusCode).toBe(400);
    expect(await Booking.countDocuments({ roomCategory: category._id })).toBe(0);
    expect(await BookingInventoryDay.countDocuments({ roomCategory: category._id })).toBe(0);
    expect(await BookingIdempotency.countDocuments({ key })).toBe(0);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
  });

  it("handles concurrent booking attempts safely", async () => {
    const category = await createTempInventory();
    const checkInDate = "2026-12-10";
    const checkOutDate = "2026-12-12";
    const requests = Array.from({ length: 10 }, () => {
      const key = `concurrent-${randomUUID()}`;
      return {
        key,
        req: bookingReq({
          roomCategoryId: category._id.toString(),
          checkInDate,
          checkOutDate,
          idempotencyKey: key,
          user: { id: customerId, role: "CUSTOMER" },
        }),
      };
    });

    const results = await Promise.all(requests.map(({ req }) => callController(createBooking, req)));
    const successes = results.filter((res) => res.statusCode === 201);
    const conflicts = results.filter((res) => res.statusCode === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBeGreaterThanOrEqual(9);
    expect(await Booking.countDocuments({ roomCategory: category._id })).toBe(1);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key: { $regex: "^concurrent-" } });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": { $regex: "^concurrent-" } });
  });

  it("leaves no leaked inventory or orphaned booking when booking creation fails after the inventory claim", async () => {
    const category = await createTempInventory();
    const key = `forced-failure-${randomUUID()}`;
    const req = bookingReq({
      roomCategoryId: category._id.toString(),
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      idempotencyKey: key,
      user: { id: customerId, role: "CUSTOMER" },
    });

    // Force a real database-write failure at the exact point after inventory
    // has been claimed inside the transaction, without bypassing the actual
    // booking-safety service or the transaction itself.
    const createSpy = vi.spyOn(Booking, "create").mockImplementationOnce(async () => {
      throw new Error("forced-failure: simulated write failure after inventory claim");
    });

    const res = await callController(createBooking, req);
    createSpy.mockRestore();

    // The controller's outer handler catches the rethrown error and returns
    // a formatted 500 — it doesn't propagate to Express as an unhandled
    // rejection.
    expect(res.statusCode).toBe(500);

    expect(await Booking.countDocuments({ roomCategory: category._id })).toBe(0);

    const inventory = await BookingInventoryDay.find({ roomCategory: category._id });
    expect(inventory.every((doc) => doc.reservedCount === 0)).toBe(true);

    const idempotency = await BookingIdempotency.findOne({ key });
    expect(idempotency?.status).toBe("FAILED");

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": key });
  });

  it("rolls back an earlier night's claim atomically when a later night in the same multi-night booking conflicts", async () => {
    // This is the direct evidence for multi-night crash/failure safety: the
    // reservation loop claims one night at a time inside a single MongoDB
    // transaction. If night 2 of a 2-night stay conflicts, night 1's claim
    // (already written earlier in the same loop) must not survive — proving
    // the whole multi-night claim is atomic, not a sequence of independent
    // commits a crash could interrupt partway through.
    const category = await createTempInventory();
    const night1 = new Date(Date.UTC(2027, 1, 20)); // Feb 20, 2027
    const night2 = new Date(Date.UTC(2027, 1, 21)); // Feb 21, 2027

    // Pre-exhaust capacity for night 2 only, leaving night 1 free.
    await BookingInventoryDay.create({
      roomCategory: category._id,
      stayDate: night2,
      capacity: 1,
      reservedCount: 1,
    });

    const key = `multinight-atomic-${randomUUID()}`;
    const req = bookingReq({
      roomCategoryId: category._id.toString(),
      checkInDate: "2027-02-20",
      checkOutDate: "2027-02-22", // spans night1 (free) and night2 (full)
      idempotencyKey: key,
      user: { id: customerId, role: "CUSTOMER" },
    });

    const res = await callController(createBooking, req);
    expect(res.statusCode).toBe(409);

    const night1Doc = await BookingInventoryDay.findOne({ roomCategory: category._id, stayDate: night1 });
    // Night 1's claim from earlier in the same loop must have been rolled
    // back along with night 2's failed claim — either the document was
    // never durably created, or it exists with reservedCount still 0.
    expect(!night1Doc || night1Doc.reservedCount === 0).toBe(true);

    expect(await Booking.countDocuments({ roomCategory: category._id })).toBe(0);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": key });
  });

  it("audits guest checkout bookings as actorType GUEST, not silently", async () => {
    const category = await createTempInventory();
    const key = `guest-${randomUUID()}`;
    const req = bookingReq({
      roomCategoryId: category._id.toString(),
      checkInDate: "2027-01-15",
      checkOutDate: "2027-01-16",
      idempotencyKey: key,
      // No `user` — this is an anonymous guest checkout, the realistic
      // majority real-world booking path.
    });

    const res = await callController(createBooking, req);
    expect(res.statusCode).toBe(201);

    const auditEntry = await AuditLog.findOne({
      action: "booking.created",
      "metadata.idempotencyKey": key,
    });
    expect(auditEntry).toBeTruthy();
    expect(auditEntry?.actorType).toBe("GUEST");
    expect(auditEntry?.actorId).toBeFalsy();

    const auditCount = await AuditLog.countDocuments({
      action: "booking.created",
      "metadata.idempotencyKey": key,
    });
    expect(auditCount).toBe(1);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": key });
  });

  it("rejects a booking attempt from a blocked guest and creates one guest record per email on success", async () => {
    const category = await createTempInventory();
    const blockedEmail = `blocked-${randomUUID()}@example.com`;
    await Guest.create({ fullName: "Blocked Guest", email: blockedEmail, phone: "0000000000", isBlocked: true });

    const blockedKey = `blocked-${randomUUID()}`;
    const blockedRes = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate: "2027-03-01",
        checkOutDate: "2027-03-02",
        idempotencyKey: blockedKey,
        guestDetails: { firstName: "Blocked", lastName: "Guest", email: blockedEmail, phone: "0000000000" },
      })
    );
    expect(blockedRes.statusCode).toBe(403);
    expect(await Booking.countDocuments({ roomCategory: category._id })).toBe(0);

    // A non-blocked guest booking should succeed and sync a real Guest record.
    const okEmail = `guest-sync-${randomUUID()}@example.com`;
    const okKey = `guestsync-${randomUUID()}`;
    const okRes = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate: "2027-03-05",
        checkOutDate: "2027-03-06",
        idempotencyKey: okKey,
        guestDetails: { firstName: "Synced", lastName: "Guest", email: okEmail, phone: "1111111111" },
      })
    );
    expect(okRes.statusCode).toBe(201);
    const syncedGuest = await Guest.findOne({ email: okEmail });
    expect(syncedGuest?.totalBookings).toBe(1);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Booking.deleteMany({ roomCategory: category._id });
    await BookingInventoryDay.deleteMany({ roomCategory: category._id });
    await BookingIdempotency.deleteMany({ key: { $in: [blockedKey, okKey] } });
    await AuditLog.deleteMany({ "metadata.idempotencyKey": { $in: [blockedKey, okKey] } });
    await Guest.deleteMany({ email: { $in: [blockedEmail, okEmail] } });
  });

  it("does not leave a stuck idempotency record when coupon validation rejects the booking", async () => {
    // Coupon validation happens after the idempotency claim but outside the
    // transaction's own catch block — a real bug this test would have
    // caught: the record was left at IN_PROGRESS forever, permanently
    // blocking a legitimate retry with the same key.
    const category = await createTempInventory();
    const couponCode = `NOPE-${randomUUID().slice(0, 8)}`.toUpperCase();
    await Coupon.create({
      code: couponCode,
      description: "Test coupon with a high minimum",
      discountType: DiscountType.FIXED,
      discountValue: 100,
      minBookingAmount: 999999,
      startDate: new Date(Date.now() - 86400000),
      expiryDate: new Date(Date.now() + 86400000),
      perUserLimit: 1,
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const key = `coupon-reject-${randomUUID()}`;
    const res = await callController(
      createBooking,
      bookingReq({
        roomCategoryId: category._id.toString(),
        checkInDate: "2027-04-01",
        checkOutDate: "2027-04-02",
        idempotencyKey: key,
        couponCode,
        user: { id: customerId, role: "CUSTOMER" },
      })
    );
    expect(res.statusCode).toBe(400);

    const idempotency = await BookingIdempotency.findOne({ key });
    expect(idempotency?.status).toBe("FAILED");
    expect(await Booking.countDocuments({ roomCategory: category._id })).toBe(0);

    await Room.deleteMany({ category: category._id });
    await RoomCategory.deleteMany({ _id: category._id });
    await Coupon.deleteOne({ code: couponCode });
    await BookingIdempotency.deleteMany({ key });
  });
});
