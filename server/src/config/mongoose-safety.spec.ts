import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { installUnscopedWriteGuard } from "./mongoose-safety";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
  // Already installed by vitest.setup.ts in the real suite; calling again
  // here is harmless (idempotent) and makes this test self-contained if run
  // in isolation.
  installUnscopedWriteGuard();
});

afterAll(async () => {
  await mongoose.connection.close();
});

async function createGuardTestBooking() {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  return Booking.create({
    bookingReference: `GUARD-${stamp}`,
    guestDetails: { firstName: "Guard", lastName: "Test", email: `guard-${stamp}@test.local`, phone: "9999999999" },
    roomCategory: new mongoose.Types.ObjectId(),
    checkInDate: new Date(Date.now() + 86400000),
    checkOutDate: new Date(Date.now() + 2 * 86400000),
    adults: 1,
    children: 0,
    totalAmount: 1000,
    taxAmount: 0,
    status: BookingStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
  });
}

beforeEach(async () => {
  await mongoose.connection
    .collection("bookings")
    .deleteMany({ bookingReference: { $regex: /^GUARD-/ } });
});

describe("installUnscopedWriteGuard — the real safeguard behind the prior unscoped-deleteMany incident", () => {
  it("refuses an unscoped deleteMany({}) on a real model, and leaves existing documents untouched", async () => {
    const booking = await createGuardTestBooking();

    await expect(Booking.deleteMany({})).rejects.toThrow(/Refused unscoped deleteMany/);

    const stillExists = await Booking.findById(booking._id);
    expect(stillExists).not.toBeNull();
  });

  it("refuses an unscoped updateMany({}, ...) on a real model", async () => {
    await expect(Booking.updateMany({}, { $set: { specialRequests: "guard-test" } })).rejects.toThrow(
      /Refused unscoped updateMany/
    );
  });

  it("still allows a properly scoped deleteMany", async () => {
    await createGuardTestBooking();
    await createGuardTestBooking();

    const result = await Booking.deleteMany({ bookingReference: { $regex: /^GUARD-/ } });
    expect(result.deletedCount).toBeGreaterThanOrEqual(2);
  });

  it("still allows a properly scoped updateMany", async () => {
    const booking = await createGuardTestBooking();
    const result = await Booking.updateMany(
      { bookingReference: booking.bookingReference },
      { $set: { specialRequests: "guard-scoped-update" } }
    );
    expect(result.modifiedCount).toBe(1);
    const updated = await Booking.findById(booking._id);
    expect(updated?.specialRequests).toBe("guard-scoped-update");
  });
});
