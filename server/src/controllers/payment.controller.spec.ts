import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDemoBooking } from "./payment.controller";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Payment } from "../models/Payment";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

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

async function createTestBooking(overrides: Partial<any> = {}) {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  return Booking.create({
    bookingReference: `DEMO-${stamp}`,
    guestDetails: { firstName: "Demo", lastName: "Guest", email: `demo-${stamp}@test.local`, phone: "9999999999" },
    roomCategory: new mongoose.Types.ObjectId(),
    checkInDate: new Date(Date.now() + 86400000),
    checkOutDate: new Date(Date.now() + 2 * 86400000),
    adults: 1,
    children: 0,
    totalAmount: 1000,
    taxAmount: 0,
    status: BookingStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    ...overrides,
  });
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  process.env.NODE_ENV = "test";
  await Promise.all([
    Booking.deleteMany({ bookingReference: /^DEMO-/ }),
    Payment.deleteMany({ transactionId: /^DEMO-DEMO-/ }),
  ]);
});

describe("confirmDemoBooking authorization", () => {
  it("is hard-disabled in production regardless of Razorpay configuration", async () => {
    process.env.NODE_ENV = "production";
    const booking = await createTestBooking();
    const res = await confirmDemoBooking({ params: { id: booking._id.toString() }, user: undefined } as any, mockRes());
    expect(res.statusCode).toBe(403);
    const untouched = await Booking.findById(booking._id);
    expect(untouched?.paymentStatus).toBe(PaymentStatus.UNPAID);
    process.env.NODE_ENV = "test";
  });

  it("refuses once Razorpay credentials are configured", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "secret_x";
    const booking = await createTestBooking();
    const res = await confirmDemoBooking({ params: { id: booking._id.toString() }, user: undefined } as any, mockRes());
    expect(res.statusCode).toBe(403);
  });

  it("allows an anonymous (guest checkout) caller when Razorpay is not configured, outside production", async () => {
    const booking = await createTestBooking();
    const res = await confirmDemoBooking({ params: { id: booking._id.toString() }, user: undefined } as any, mockRes());
    expect(res.statusCode).toBe(200);
    const confirmed = await Booking.findById(booking._id);
    expect(confirmed?.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it("blocks a logged-in customer from confirming a booking they do not own", async () => {
    const owner = new mongoose.Types.ObjectId();
    const attacker = new mongoose.Types.ObjectId().toString();
    const booking = await createTestBooking({ customer: owner });
    const res = await confirmDemoBooking(
      { params: { id: booking._id.toString() }, user: { id: attacker, role: "CUSTOMER" } } as any,
      mockRes()
    );
    expect(res.statusCode).toBe(403);
    const untouched = await Booking.findById(booking._id);
    expect(untouched?.paymentStatus).toBe(PaymentStatus.UNPAID);
  });

  it("allows the booking's own logged-in customer", async () => {
    const owner = new mongoose.Types.ObjectId();
    const booking = await createTestBooking({ customer: owner });
    const res = await confirmDemoBooking(
      { params: { id: booking._id.toString() }, user: { id: owner.toString(), role: "CUSTOMER" } } as any,
      mockRes()
    );
    expect(res.statusCode).toBe(200);
  });

  it("allows an admin to confirm any booking", async () => {
    const owner = new mongoose.Types.ObjectId();
    const booking = await createTestBooking({ customer: owner });
    const res = await confirmDemoBooking(
      { params: { id: booking._id.toString() }, user: { id: new mongoose.Types.ObjectId().toString(), role: "ADMIN" } } as any,
      mockRes()
    );
    expect(res.statusCode).toBe(200);
  });
});
