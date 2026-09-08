import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Payment, PaymentMethod, PaymentTxStatus } from "../models/Payment";
import { redeemCouponForBooking } from "./coupon.service";
import { syncGuestOnPaymentConfirmed } from "./guest.service";
import { sendNotification } from "./notification.service";
import { NotificationType } from "../models/NotificationLog";
import { createAuditLog } from "./audit.service";
import { AuditActorType } from "../models/AuditLog";
import { assertLegalBookingTransition } from "./booking-state.service";
import type { Request } from "express";

export class PaymentAmountMismatchError extends Error {
  constructor(expectedPaise: number, actualPaise: number) {
    super(`Payment amount mismatch: expected ${expectedPaise} paise, gateway reported ${actualPaise} paise`);
    this.name = "PaymentAmountMismatchError";
  }
}

function bookingConfirmationNotification(booking: {
  bookingReference: string;
  guestDetails: any;
  totalAmount: number;
  checkInDate: Date;
  checkOutDate: Date;
  _id: any;
}) {
  return sendNotification({
    type: NotificationType.BOOKING_CONFIRMATION,
    recipientEmail: booking.guestDetails.email,
    subject: `Booking Confirmed — ${booking.bookingReference}`,
    body: `Hi ${booking.guestDetails.firstName}, your booking ${booking.bookingReference} is confirmed for ${new Date(booking.checkInDate).toDateString()} to ${new Date(booking.checkOutDate).toDateString()}. Total paid: ₹${booking.totalAmount}.`,
    bookingId: booking._id.toString(),
  }).catch(() => undefined);
}

export interface FinalizePaymentSuccessParams {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  /** Amount in paise as reported by the gateway, when available, for a server-side cross-check. */
  gatewayAmountPaise?: number;
  source: "CLIENT_VERIFY" | "WEBHOOK";
  /** The inbound HTTP request, when one exists, for audit attribution (ip/user-agent/authenticated user). */
  req?: Request;
}

export interface FinalizePaymentSuccessResult {
  alreadyProcessed: boolean;
  bookingNotFound: boolean;
  booking: InstanceType<typeof Booking> | null;
}

/**
 * The single authoritative path for confirming a Razorpay payment and
 * transitioning the associated booking to PAID/CONFIRMED. Both the
 * browser-driven verify call (POST /api/payments/verify) and the
 * server-to-server webhook (POST /api/webhooks/razorpay) call into this
 * function, so regardless of which one wins the race — or whether only one
 * of them ever fires (browser closes tab before verify; webhook delivery is
 * delayed) — the payment is confirmed exactly once, with exactly one set of
 * side effects (coupon redemption, guest sync, notification).
 *
 * Idempotency is enforced at the database level via Payment's unique+sparse
 * index on razorpayPaymentId — the findOne check below is an optimization to
 * avoid unnecessary work, not the actual guarantee.
 */
export async function finalizePaymentSuccess(
  params: FinalizePaymentSuccessParams
): Promise<FinalizePaymentSuccessResult> {
  const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature, source } = params;

  const existingPayment = await Payment.findOne({ razorpayPaymentId });
  if (existingPayment) {
    const existingBooking = await Booking.findById(existingPayment.booking);
    return { alreadyProcessed: true, bookingNotFound: false, booking: existingBooking };
  }

  const bookingBefore = await Booking.findById(bookingId);
  if (!bookingBefore) return { alreadyProcessed: false, bookingNotFound: true, booking: null };

  // A payment must never resurrect a booking that has already moved past
  // PENDING in a way that isn't "become CONFIRMED" — e.g. a booking the
  // guest already cancelled, or (defensively) one already CHECKED_OUT.
  // Without this, a late-arriving webhook for a payment whose booking was
  // cancelled in the meantime would silently re-confirm it.
  assertLegalBookingTransition(bookingBefore.status, BookingStatus.CONFIRMED);

  if (params.gatewayAmountPaise != null) {
    const expectedPaise = Math.round(bookingBefore.totalAmount * 100);
    if (expectedPaise !== params.gatewayAmountPaise) {
      throw new PaymentAmountMismatchError(expectedPaise, params.gatewayAmountPaise);
    }
  }

  const booking = await Booking.findByIdAndUpdate(
    bookingId,
    { paymentStatus: PaymentStatus.PAID, status: BookingStatus.CONFIRMED },
    { returnDocument: "after" }
  );
  if (!booking) return { alreadyProcessed: false, bookingNotFound: true, booking: null };

  try {
    await Payment.create({
      booking: booking._id,
      amount: booking.totalAmount,
      currency: "INR",
      method: PaymentMethod.RAZORPAY,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: PaymentTxStatus.COMPLETED,
    });
  } catch (error: any) {
    // Unique-index collision: another concurrent call (the other of
    // CLIENT_VERIFY/WEBHOOK, or a duplicate webhook delivery) already
    // recorded this exact payment. Treat as already-processed, not an error.
    if (error?.code === 11000) {
      const existing = await Booking.findById(bookingId);
      return { alreadyProcessed: true, bookingNotFound: false, booking: existing };
    }
    throw error;
  }

  await createAuditLog({
    req: params.req,
    actorType: params.req ? undefined : AuditActorType.SYSTEM,
    action: "payment.completed",
    resourceType: "Booking",
    resourceId: booking._id.toString(),
    metadata: {
      bookingReference: booking.bookingReference,
      amount: booking.totalAmount,
      currency: "INR",
      provider: "RAZORPAY",
      razorpayPaymentId,
      source,
      bookingStatusTransition: `${bookingBefore.status} -> ${BookingStatus.CONFIRMED}`,
    },
  });

  booking.paidAmount = booking.totalAmount;
  await booking.save();

  if (booking.appliedCoupon) {
    await redeemCouponForBooking(booking._id.toString());
  }

  await syncGuestOnPaymentConfirmed({
    email: booking.guestDetails.email,
    amount: booking.totalAmount,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
  });

  await bookingConfirmationNotification(booking);

  return { alreadyProcessed: false, bookingNotFound: false, booking };
}
