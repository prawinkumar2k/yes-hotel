import mongoose from "mongoose";
import crypto from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRazorpayWebhook } from "./webhook.controller";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Payment, PaymentMethod, PaymentTxStatus } from "../models/Payment";
import { Refund, RefundStatus } from "../models/Refund";
import { WebhookEvent } from "../models/WebhookEvent";
import { AuditLog } from "../models/AuditLog";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";
const WEBHOOK_SECRET = "test_webhook_secret_value";

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

function signedReq(payload: object) {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  return {
    body: raw,
    headers: { "x-razorpay-signature": signature },
  } as any;
}

async function createTestBooking(overrides: Partial<any> = {}) {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  return Booking.create({
    bookingReference: `WH-${stamp}`,
    guestDetails: { firstName: "Web", lastName: "Hook", email: `webhook-${stamp}@test.local`, phone: "9999999999" },
    roomCategory: new mongoose.Types.ObjectId(),
    checkInDate: new Date(Date.now() + 86400000),
    checkOutDate: new Date(Date.now() + 2 * 86400000),
    adults: 1,
    children: 0,
    totalAmount: 1500,
    taxAmount: 0,
    status: BookingStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    ...overrides,
  });
}

beforeAll(async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({ bookingReference: /^WH-/ }),
    Payment.deleteMany({ razorpayOrderId: /^order_test_/ }),
    Refund.deleteMany({ razorpayRefundId: /^rfnd_test_/ }),
    WebhookEvent.deleteMany({ provider: "RAZORPAY", eventId: /^payment\.|^refund\./ }),
    AuditLog.deleteMany({ action: { $in: ["payment.completed", "payment.failed", "payment.amount_mismatch", "refund.confirmed_by_webhook", "refund.failed_confirmed_by_webhook"] } }),
  ]);
});

describe("handleRazorpayWebhook", () => {
  it("rejects a request with an invalid signature", async () => {
    const req = signedReq({ event: "payment.captured", payload: { payment: { entity: { id: "pay_bad" } } } });
    req.headers["x-razorpay-signature"] = "0".repeat(64);
    const res = await handleRazorpayWebhook(req, mockRes());
    expect(res.statusCode).toBe(400);
  });

  it("fails closed (503) when RAZORPAY_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const req = signedReq({ event: "payment.captured", payload: { payment: { entity: { id: "pay_x" } } } });
    const res = await handleRazorpayWebhook(req, mockRes());
    expect(res.statusCode).toBe(503);
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("confirms a booking on payment.captured and is idempotent across repeated delivery", async () => {
    const booking = await createTestBooking();
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_test_${booking._id}`,
            order_id: `order_test_${booking._id}`,
            amount: Math.round(booking.totalAmount * 100),
            notes: { bookingId: booking._id.toString() },
          },
        },
      },
    };

    const res1 = await handleRazorpayWebhook(signedReq(payload), mockRes());
    expect(res1.statusCode).toBe(200);

    const confirmed = await Booking.findById(booking._id);
    expect(confirmed?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(confirmed?.status).toBe(BookingStatus.CONFIRMED);

    const payments = await Payment.find({ razorpayPaymentId: payload.payload.payment.entity.id });
    expect(payments).toHaveLength(1);

    // The audit entry for this req-less (webhook-originated) event must
    // actually be persisted — regression coverage for a bug where
    // createAuditLog silently failed to write anything when called without
    // a `req` (see audit.service.spec.ts).
    const auditEntry = await AuditLog.findOne({ action: "payment.completed", resourceId: booking._id.toString() });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.actorType).toBe("SYSTEM");

    // Redeliver the identical event 5 more times — must remain exactly one payment record.
    for (let i = 0; i < 5; i++) {
      const res = await handleRazorpayWebhook(signedReq(payload), mockRes());
      expect(res.statusCode).toBe(200);
    }
    const paymentsAfterRedelivery = await Payment.find({ razorpayPaymentId: payload.payload.payment.entity.id });
    expect(paymentsAfterRedelivery).toHaveLength(1);
  });

  it("does not duplicate a payment already confirmed via the client verify path", async () => {
    const booking = await createTestBooking();
    const razorpayPaymentId = `pay_test_client_${booking._id}`;

    // Simulate the client-verify path having already recorded this payment.
    await Payment.create({
      booking: booking._id,
      amount: booking.totalAmount,
      currency: "INR",
      method: PaymentMethod.RAZORPAY,
      razorpayOrderId: `order_test_${booking._id}`,
      razorpayPaymentId,
      status: PaymentTxStatus.COMPLETED,
    });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: `order_test_${booking._id}`,
            amount: Math.round(booking.totalAmount * 100),
            notes: { bookingId: booking._id.toString() },
          },
        },
      },
    };

    const res = await handleRazorpayWebhook(signedReq(payload), mockRes());
    expect(res.statusCode).toBe(200);

    const payments = await Payment.find({ razorpayPaymentId });
    expect(payments).toHaveLength(1);
  });

  it("quarantines (does not confirm) a payment.captured whose amount does not match the booking total", async () => {
    const booking = await createTestBooking({ totalAmount: 2000 });
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_test_mismatch_${booking._id}`,
            order_id: `order_test_${booking._id}`,
            amount: 100000, // far more than the booking's 2000 * 100 paise
            notes: { bookingId: booking._id.toString() },
          },
        },
      },
    };

    const res = await handleRazorpayWebhook(signedReq(payload), mockRes());
    expect(res.statusCode).toBe(200); // acknowledged to stop gateway retries

    const untouched = await Booking.findById(booking._id);
    expect(untouched?.paymentStatus).toBe(PaymentStatus.UNPAID);
    const payments = await Payment.find({ razorpayPaymentId: payload.payload.payment.entity.id });
    expect(payments).toHaveLength(0);
  });

  it("rejects a second, distinct payment.captured for a booking that is already CONFIRMED — prevents double-charging a booking via two separate Razorpay orders", async () => {
    const booking = await createTestBooking();
    const firstPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_test_first_${booking._id}`,
            order_id: `order_test_a_${booking._id}`,
            amount: Math.round(booking.totalAmount * 100),
            notes: { bookingId: booking._id.toString() },
          },
        },
      },
    };
    const res1 = await handleRazorpayWebhook(signedReq(firstPayload), mockRes());
    expect(res1.statusCode).toBe(200);
    expect((await Booking.findById(booking._id))?.status).toBe(BookingStatus.CONFIRMED);

    // A second, genuinely different Razorpay payment (e.g. the guest opened
    // checkout twice and both succeeded) targeting the SAME booking.
    const secondPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_test_second_${booking._id}`,
            order_id: `order_test_b_${booking._id}`,
            amount: Math.round(booking.totalAmount * 100),
            notes: { bookingId: booking._id.toString() },
          },
        },
      },
    };
    const res2 = await handleRazorpayWebhook(signedReq(secondPayload), mockRes());
    expect(res2.statusCode).toBe(200); // acknowledged, not retried — this is a permanent condition

    // Exactly one Payment record must exist for this booking — the second
    // "successful" gateway payment must not have created a duplicate charge
    // record against an already-confirmed booking.
    const payments = await Payment.find({ booking: booking._id });
    expect(payments).toHaveLength(1);
    expect(payments[0].razorpayPaymentId).toBe(firstPayload.payload.payment.entity.id);
  });

  it("marks a refund COMPLETED on refund.processed", async () => {
    const booking = await createTestBooking();
    const payment = await Payment.create({
      booking: booking._id,
      amount: booking.totalAmount,
      currency: "INR",
      method: PaymentMethod.RAZORPAY,
      razorpayOrderId: `order_test_${booking._id}`,
      razorpayPaymentId: `pay_test_rf_${booking._id}`,
      status: PaymentTxStatus.PARTIALLY_REFUNDED,
      refundedAmount: 500,
    });
    const refund = await Refund.create({
      booking: booking._id,
      payment: payment._id,
      amount: 500,
      reason: "test refund",
      status: RefundStatus.PROCESSING,
      razorpayRefundId: `rfnd_test_${booking._id}`,
      initiatedBy: new mongoose.Types.ObjectId(),
    });

    const payload = {
      event: "refund.processed",
      payload: { refund: { entity: { id: refund.razorpayRefundId } } },
    };
    const res = await handleRazorpayWebhook(signedReq(payload), mockRes());
    expect(res.statusCode).toBe(200);

    const updated = await Refund.findById(refund._id);
    expect(updated?.status).toBe(RefundStatus.COMPLETED);
  });

  it("releases the claimed refund balance on refund.failed", async () => {
    const booking = await createTestBooking();
    const payment = await Payment.create({
      booking: booking._id,
      amount: booking.totalAmount,
      currency: "INR",
      method: PaymentMethod.RAZORPAY,
      razorpayOrderId: `order_test_${booking._id}`,
      razorpayPaymentId: `pay_test_rff_${booking._id}`,
      status: PaymentTxStatus.PARTIALLY_REFUNDED,
      refundedAmount: 500,
    });
    const refund = await Refund.create({
      booking: booking._id,
      payment: payment._id,
      amount: 500,
      reason: "test refund",
      status: RefundStatus.PROCESSING,
      razorpayRefundId: `rfnd_test_fail_${booking._id}`,
      initiatedBy: new mongoose.Types.ObjectId(),
    });

    const payload = {
      event: "refund.failed",
      payload: { refund: { entity: { id: refund.razorpayRefundId } } },
    };
    const res = await handleRazorpayWebhook(signedReq(payload), mockRes());
    expect(res.statusCode).toBe(200);

    const updatedRefund = await Refund.findById(refund._id);
    expect(updatedRefund?.status).toBe(RefundStatus.FAILED);
    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment?.refundedAmount).toBe(0);
    expect(updatedPayment?.status).toBe(PaymentTxStatus.COMPLETED);
  });
});
