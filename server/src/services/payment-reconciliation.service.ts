import mongoose from "mongoose";
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

  const { resolvePaymentChannel } = await import("../utils/payment-channel.resolver");
  const razorpayChannelId = await resolvePaymentChannel("RAZORPAY");
  let propertyId: any = bookingBefore.propertyId || (bookingBefore as any).property;
  if (!propertyId) {
    const { Property } = await import("../models/Property");
    propertyId = (await Property.findOne({ isActive: { $ne: false } }).select("_id").lean())?._id;
  }

  // Confirming the booking and recording the payment happen together or not at all: a booking is
  // never left PAID without its payment record. The booking update is guarded by its previous
  // status, so a client confirmation racing the gateway webhook processes the payment once.
  let booking: any = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      booking = await Booking.findOneAndUpdate(
        { _id: bookingId, status: bookingBefore.status },
        { $set: { paymentStatus: PaymentStatus.PAID, status: BookingStatus.CONFIRMED, paidAmount: bookingBefore.totalAmount } },
        { returnDocument: "after", session },
      );
      if (!booking) throw Object.assign(new Error("booking changed concurrently"), { concurrentChange: true });
      await Payment.create(
        [{
          propertyId,
          booking: booking._id,
          amount: booking.totalAmount,
          currency: "INR",
          method: PaymentMethod.RAZORPAY,
          paymentChannel: razorpayChannelId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          status: PaymentTxStatus.COMPLETED,
        }],
        { session },
      );
    });
  } catch (error: any) {
    // Only "this exact gateway payment is already recorded" means already processed (the other
    // of CLIENT_VERIFY / WEBHOOK, or a repeated delivery). Any other failure is a real error.
    const samePayment = error?.code === 11000 && (error?.keyPattern?.razorpayPaymentId || /razorpayPaymentId/.test(String(error?.message)));
    if (samePayment || error?.concurrentChange) {
      const recorded = await Payment.findOne({ razorpayPaymentId }).select("_id").lean();
      if (recorded) return { alreadyProcessed: true, bookingNotFound: false, booking: await Booking.findById(bookingId) };
    }
    throw error;
  } finally {
    await session.endSession();
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

  if (booking.appliedCoupon) {
    await redeemCouponForBooking(booking._id.toString());
  }

  await syncGuestOnPaymentConfirmed({
    email: booking.guestDetails.email,
    name: `${booking.guestDetails.firstName ?? ""} ${booking.guestDetails.lastName ?? ""}`.trim(),
    phone: booking.guestDetails.phone,
    amount: booking.totalAmount,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
  });

  await bookingConfirmationNotification(booking);

  return { alreadyProcessed: false, bookingNotFound: false, booking };
}
