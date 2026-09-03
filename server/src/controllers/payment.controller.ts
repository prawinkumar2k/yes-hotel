import { Request, Response } from "express";
import crypto from "crypto";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Payment, PaymentMethod, PaymentTxStatus } from "../models/Payment";
import { redeemCouponForBooking } from "../services/coupon.service";
import { syncGuestOnPaymentConfirmed } from "../services/guest.service";
import { createAuditLog } from "../services/audit.service";
import { sendNotification } from "../services/notification.service";
import { NotificationType } from "../models/NotificationLog";
import {
  finalizePaymentSuccess,
  PaymentAmountMismatchError,
} from "../services/payment-reconciliation.service";
import { IllegalBookingTransitionError, transitionBookingStatus } from "../services/booking-state.service";
import { logger } from "../services/logger.service";

function bookingConfirmationNotification(booking: { bookingReference: string; guestDetails: any; totalAmount: number; checkInDate: Date; checkOutDate: Date; _id: any }) {
  return sendNotification({
    type: NotificationType.BOOKING_CONFIRMATION,
    recipientEmail: booking.guestDetails.email,
    subject: `Booking Confirmed — ${booking.bookingReference}`,
    body: `Hi ${booking.guestDetails.firstName}, your booking ${booking.bookingReference} is confirmed for ${new Date(booking.checkInDate).toDateString()} to ${new Date(booking.checkOutDate).toDateString()}. Total paid: ₹${booking.totalAmount}.`,
    bookingId: booking._id.toString(),
  }).catch(() => undefined);
}

/**
 * PAYMENT ARCHITECTURE — Razorpay Integration
 *
 * Flow:
 *  1. POST /api/payments/create-order  → creates Razorpay order, returns { orderId, amount, currency, keyId }
 *  2. Frontend opens Razorpay checkout widget
 *  3. On payment success, Razorpay calls frontend callback with { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *  4. POST /api/payments/verify        → server verifies HMAC signature, marks booking PAID
 *
 * REQUIRED ENV VARS (add to .env):
 *   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
 *   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxx
 *
 * INSTALL: pnpm add razorpay
 * TYPES:   pnpm add -D @types/razorpay  (or use the bundled types in razorpay package)
 */

// Dynamically require Razorpay so the app doesn't crash if package not installed yet
function getRazorpay() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Razorpay = require("razorpay");
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (e: any) {
    throw new Error(`Razorpay unavailable: ${e.message}`);
  }
}

async function auditPaymentEvent(
  req: Request,
  booking: { _id: any; bookingReference: string; customer?: any },
  action: string,
  metadata: Record<string, any>
) {
  const user = (req as any).user;
  const actorId = user?.id ?? booking.customer?.toString?.();
  const actorRole = user?.role ?? (booking.customer ? "CUSTOMER" : undefined);
  if (!actorId || !actorRole) return;

  await createAuditLog({
    req,
    actorId,
    actorRole,
    action,
    resourceType: "Booking",
    resourceId: booking._id.toString(),
    metadata,
  });
}

// POST /api/payments/create-order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({ success: false, message: "Booking is already paid" });
    }

    const razorpay = getRazorpay();
    const amountInPaise = Math.round(booking.totalAmount * 100); // Razorpay uses smallest currency unit

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: booking.bookingReference,
      notes: { bookingId: booking._id.toString() },
    });

    await auditPaymentEvent(req, booking, "payment.order_created", {
      bookingReference: booking.bookingReference,
      amount: booking.totalAmount,
      currency: "INR",
      provider: "RAZORPAY",
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        bookingReference: booking.bookingReference,
        guestName: `${booking.guestDetails.firstName} ${booking.guestDetails.lastName}`,
        guestEmail: booking.guestDetails.email,
        guestPhone: booking.guestDetails.phone,
      },
    });
  } catch (error: any) {
    logger.error("payment.create_order_failed", { requestId: req.id, message: error.message, bookingId: req.body?.bookingId });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments/verify
//
// This is the browser-driven confirmation path. It is NOT the sole source of
// truth for reconciliation — POST /api/webhooks/razorpay is the
// server-to-server authoritative path and will confirm the same payment even
// if this call never happens (tab closed, network failure after checkout
// succeeds). Both paths converge on finalizePaymentSuccess(), which is
// idempotent regardless of which one runs first or whether both run.
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(500).json({ success: false, message: "Payment gateway not configured" });

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    const result = await finalizePaymentSuccess({
      bookingId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      source: "CLIENT_VERIFY",
      req,
    });

    if (result.bookingNotFound) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed ? "Payment already verified" : "Payment verified and booking confirmed",
      data: { bookingReference: result.booking?.bookingReference },
    });
  } catch (error: any) {
    if (error instanceof PaymentAmountMismatchError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error instanceof IllegalBookingTransitionError) {
      return res.status(409).json({
        success: false,
        message: `Booking cannot be confirmed from its current status (${error.from})`,
      });
    }
    logger.error("payment.verify_failed", { requestId: req.id, message: error.message, bookingId: req.body?.bookingId });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/bookings/:id/confirm-demo — dev-only fallback when Razorpay is not configured.
// Refused outright once real credentials are present, so it can never bypass a live gateway.
export const confirmDemoBooking = async (req: Request, res: Response) => {
  try {
    // Hard production gate, independent of Razorpay configuration state.
    // Previously this endpoint only self-disabled when Razorpay credentials
    // were present — meaning a production deployment that simply forgot to
    // set RAZORPAY_KEY_ID/SECRET (a plausible ops mistake, not a contrived
    // one) would leave an unauthenticated "confirm any booking as paid for
    // free" endpoint live. NODE_ENV=production is compiled as a static
    // constant into the production build (see vite.config.server.ts), so
    // this branch cannot be bypassed by an env var the deployer forgot.
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Demo confirmation is never available in production",
      });
    }
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      return res.status(403).json({
        success: false,
        message: "Demo confirmation is disabled — Razorpay is configured, use real payment verification",
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({ success: false, message: "Booking is already paid" });
    }

    // Defense in depth: guest checkout has no account to authenticate, so an
    // anonymous caller is allowed here (same reachability as anonymous
    // booking creation itself — POST /api/bookings is optionalProtect too).
    // But once a caller IS logged in, they must own the booking (or be an
    // admin/manager) — a logged-in attacker must not be able to fake-confirm
    // someone ELSE's booking just by guessing its id.
    const requester = (req as any).user;
    if (requester) {
      const isPrivileged = ["ADMIN", "MANAGER"].includes(requester.role);
      const isOwner = booking.customer?.toString() === requester.id;
      if (!isPrivileged && !isOwner) {
        return res.status(403).json({ success: false, message: "Not authorized to confirm this booking" });
      }
    }

    await Payment.create({
      booking: booking._id,
      amount: booking.totalAmount,
      currency: "INR",
      method: PaymentMethod.CASH,
      transactionId: `DEMO-${booking.bookingReference}`,
      status: PaymentTxStatus.COMPLETED,
    });

    try {
      await transitionBookingStatus(booking, BookingStatus.CONFIRMED, {
        req,
        action: "payment.completed",
        metadata: {
          amount: booking.totalAmount,
          currency: "INR",
          provider: "DEMO",
          demo: true,
        },
      });
    } catch (error) {
      if (error instanceof IllegalBookingTransitionError) {
        return res.status(409).json({
          success: false,
          message: `Booking cannot be confirmed from its current status (${error.from})`,
        });
      }
      throw error;
    }

    booking.paymentStatus = PaymentStatus.PAID;
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

    return res.status(200).json({
      success: true,
      message: "Demo payment confirmed and booking created",
      data: { bookingReference: booking.bookingReference },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/:bookingId — Admin: get payment record for a booking
export const getPaymentByBooking = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId })
      .populate("booking", "bookingReference totalAmount guestDetails");
    if (!payment) return res.status(404).json({ success: false, message: "No payment record found" });
    return res.status(200).json({ success: true, data: payment });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "15",
      status,
      method,
      search,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
    } = req.query;
    const p = Math.max(1, parseInt(page as string) || 1);
    const l = Math.max(1, parseInt(limit as string) || 15);

    const match: any = {};
    if (status) match.status = status;
    if (method) match.method = method;
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) match.createdAt.$lte = new Date(dateTo as string);
    }
    if (amountMin || amountMax) {
      match.amount = {};
      if (amountMin) match.amount.$gte = parseFloat(amountMin as string);
      if (amountMax) match.amount.$lte = parseFloat(amountMax as string);
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: "bookings",
          localField: "booking",
          foreignField: "_id",
          as: "booking",
        },
      },
      { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
      const s = search as string;
      const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      pipeline.push({
        $match: {
          $or: [
            { "booking.bookingReference": re },
            { "booking.guestDetails.email": re },
            { transactionId: re },
            { razorpayPaymentId: re },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: (p - 1) * l },
            { $limit: l },
            { $project: { razorpaySignature: 0 } },
          ],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    const [result] = await Payment.aggregate(pipeline);
    const sanitizedPayments = result?.data ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;

    const statsData = await Payment.aggregate([
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalCollected: 0,
      pendingAmount: 0,
      refundedAmount: 0,
      successfulCount: 0,
      failedCount: 0
    };

    statsData.forEach(stat => {
      if (stat._id === "COMPLETED") {
        stats.totalCollected = stat.totalAmount;
        stats.successfulCount = stat.count;
      } else if (stat._id === "PENDING") {
        stats.pendingAmount = stat.totalAmount;
      } else if (stat._id === "REFUNDED") {
        stats.refundedAmount = stat.totalAmount;
      } else if (stat._id === "FAILED") {
        stats.failedCount = stat.count;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        payments: sanitizedPayments,
        total,
        totalPages: Math.ceil(total / l),
        page: p,
        stats
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id).populate("booking");
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    const paymentData = payment.toObject();
    delete paymentData.razorpaySignature;

    return res.status(200).json({ success: true, data: paymentData });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
