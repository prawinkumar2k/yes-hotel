import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calculateBookingTotals } from "./pricing.service";
import { calculateDiscount, redeemCouponForBooking } from "./coupon.service";
import { Coupon, DiscountType } from "../models/Coupon";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Payment, PaymentMethod, PaymentTxStatus } from "../models/Payment";
import { Refund, RefundStatus } from "../models/Refund";
import { initiateRefund } from "../controllers/refund.controller";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    res.body = body;
    return res;
  };
  return res;
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("calculateBookingTotals — pricing invariants", () => {
  it("total never goes negative even when discount exceeds room charges", () => {
    const { taxableAmount, taxAmount, totalAmount } = calculateBookingTotals(1000, 5000);
    expect(taxableAmount).toBe(0);
    expect(taxAmount).toBe(0);
    expect(totalAmount).toBe(0);
  });

  it("tax is always computed on the post-discount (taxable) amount, not the pre-discount amount", () => {
    const { taxableAmount, taxAmount, totalAmount } = calculateBookingTotals(10000, 2000);
    expect(taxableAmount).toBe(8000);
    expect(taxAmount).toBe(Math.round(8000 * 0.18));
    expect(totalAmount).toBe(taxableAmount + taxAmount);
  });

  it("zero discount taxes the full room charge", () => {
    const { taxableAmount, taxAmount, totalAmount } = calculateBookingTotals(5000, 0);
    expect(taxableAmount).toBe(5000);
    expect(taxAmount).toBe(900);
    expect(totalAmount).toBe(5900);
  });

  it("total = taxable + tax holds for a large sweep of amounts and discounts (no float drift, no negative)", () => {
    for (let roomCharges = 0; roomCharges <= 200000; roomCharges += 3737) {
      for (let discount = 0; discount <= roomCharges + 1000; discount += 9973) {
        const { taxableAmount, taxAmount, totalAmount } = calculateBookingTotals(roomCharges, discount);
        expect(taxableAmount).toBeGreaterThanOrEqual(0);
        expect(taxAmount).toBeGreaterThanOrEqual(0);
        expect(totalAmount).toBe(taxableAmount + taxAmount);
        expect(Number.isInteger(totalAmount)).toBe(true);
      }
    }
  });

  it("rejects a negative discount rather than letting it inflate the taxable amount", () => {
    const { taxableAmount, totalAmount } = calculateBookingTotals(5000, -1000);
    // A negative discount must not increase the taxable base above roomCharges.
    expect(taxableAmount).toBe(5000);
    expect(totalAmount).toBeLessThanOrEqual(5000 * 1.18 + 1);
  });
});

describe("calculateDiscount — coupon invariant: discount never exceeds bookingAmount", () => {
  it("caps a FIXED discount larger than the booking amount", () => {
    const discount = calculateDiscount({ discountType: DiscountType.FIXED, discountValue: 999999 }, 1500);
    expect(discount).toBeLessThanOrEqual(1500);
    expect(discount).toBe(1500);
  });

  it("never produces a negative discount for a zero booking amount", () => {
    const discount = calculateDiscount({ discountType: DiscountType.PERCENTAGE, discountValue: 50 }, 0);
    expect(discount).toBe(0);
  });
});

describe("Refund invariant: cumulative refunds never exceed the captured payment amount, under real concurrency", () => {
  async function createPaidBooking(totalAmount: number) {
    const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
    const booking = await Booking.create({
      bookingReference: `MON-${stamp}`,
      guestDetails: { firstName: "Money", lastName: "Test", email: `mon-${stamp}@test.local`, phone: "9999999999" },
      roomCategory: new mongoose.Types.ObjectId(),
      checkInDate: new Date(Date.now() + 86400000),
      checkOutDate: new Date(Date.now() + 2 * 86400000),
      adults: 1,
      children: 0,
      totalAmount,
      taxAmount: 0,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paidAmount: totalAmount,
    });
    const payment = await Payment.create({
      booking: booking._id,
      amount: totalAmount,
      currency: "INR",
      method: PaymentMethod.CASH,
      transactionId: `MON-TX-${stamp}`,
      status: PaymentTxStatus.COMPLETED,
    });
    return { booking, payment };
  }

  it("two concurrent refund requests that would together overdraw the payment: only the affordable amount is ever refunded", async () => {
    const { booking, payment } = await createPaidBooking(1000);
    const adminId = new mongoose.Types.ObjectId().toString();

    // Both requests ask for 700 against a 1000 payment — sequentially fine,
    // concurrently they must NOT both succeed (700 + 700 = 1400 > 1000).
    const reqA = {
      body: { paymentId: payment._id.toString(), amount: 700, reason: "concurrent refund test A" },
      user: { id: adminId, role: "ADMIN" },
    } as any;
    const reqB = {
      body: { paymentId: payment._id.toString(), amount: 700, reason: "concurrent refund test B" },
      user: { id: adminId, role: "ADMIN" },
    } as any;

    const [resA, resB] = await Promise.all([
      initiateRefund(reqA, mockRes()),
      initiateRefund(reqB, mockRes()),
    ]);

    const succeeded = [resA, resB].filter((r) => r.statusCode === 200);
    const failed = [resA, resB].filter((r) => r.statusCode !== 200);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const finalPayment = await Payment.findById(payment._id);
    expect(finalPayment!.refundedAmount).toBe(700);
    expect(finalPayment!.refundedAmount).toBeLessThanOrEqual(finalPayment!.amount);
  });

  it("many concurrent partial-refund requests never let cumulative refunds exceed the payment amount", async () => {
    const { payment } = await createPaidBooking(1000);
    const adminId = new mongoose.Types.ObjectId().toString();

    // 10 concurrent requests for 150 each = 1500 total demand against a
    // 1000 payment. At most 6 (900) can succeed with a 7th partial rejected
    // (only 100 left, request is for 150) — the invariant under test is
    // simply that the final refundedAmount never exceeds 1000, not the
    // exact count that succeeds.
    const requests = Array.from({ length: 10 }, (_, i) => ({
      body: { paymentId: payment._id.toString(), amount: 150, reason: `concurrent refund ${i}` },
      user: { id: adminId, role: "ADMIN" },
    })) as any[];

    await Promise.all(requests.map((r) => initiateRefund(r, mockRes())));

    const finalPayment = await Payment.findById(payment._id);
    expect(finalPayment!.refundedAmount).toBeLessThanOrEqual(finalPayment!.amount);
    expect(finalPayment!.refundedAmount % 150).toBe(0);

    const refunds = await Refund.find({ payment: payment._id, status: RefundStatus.COMPLETED });
    const sumOfCompletedRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    expect(sumOfCompletedRefunds).toBe(finalPayment!.refundedAmount);
  });
});

describe("Coupon invariant: concurrent redemptions never exceed usageLimit", () => {
  it("10 concurrent redemption attempts against usageLimit=3 result in exactly 3 successes", async () => {
    const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
    const coupon = await Coupon.create({
      code: `CONC${stamp}`,
      description: "Concurrency test coupon",
      discountType: DiscountType.FIXED,
      discountValue: 100,
      startDate: new Date(Date.now() - 86400000),
      expiryDate: new Date(Date.now() + 30 * 86400000),
      usageLimit: 3,
      perUserLimit: 100,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const bookings = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        Booking.create({
          bookingReference: `MONC-${stamp}-${i}`,
          guestDetails: { firstName: "C", lastName: "T", email: `conc-${stamp}-${i}@test.local`, phone: "9999999999" },
          roomCategory: new mongoose.Types.ObjectId(),
          checkInDate: new Date(Date.now() + 86400000),
          checkOutDate: new Date(Date.now() + 2 * 86400000),
          adults: 1,
          children: 0,
          totalAmount: 1000,
          taxAmount: 0,
          appliedCoupon: coupon.code,
          couponRedeemed: false,
          status: BookingStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
        })
      )
    );

    const results = await Promise.all(bookings.map((b) => redeemCouponForBooking(b._id.toString())));
    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(3);

    const finalCoupon = await Coupon.findById(coupon._id);
    expect(finalCoupon!.timesUsed).toBe(3);
    expect(finalCoupon!.timesUsed).toBeLessThanOrEqual(finalCoupon!.usageLimit!);
  });
});
