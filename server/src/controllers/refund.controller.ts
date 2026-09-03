import { Request, Response } from "express";
import { Refund, RefundStatus } from "../models/Refund";
import { Payment, PaymentTxStatus } from "../models/Payment";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { RoomStatus } from "../models/Room";
import { z } from "zod";
import { createAuditLog } from "../services/audit.service";
import { logger } from "../services/logger.service";
import { isLegalBookingTransition, transitionBookingStatus } from "../services/booking-state.service";
import { transitionRoomStatus } from "../services/room-state.service";
import { releaseInventoryDays } from "../services/booking-safety.service";
import { releaseCouponForCancelledBooking } from "../services/coupon.service";
import { sendNotification } from "../services/notification.service";
import { NotificationType } from "../models/NotificationLog";

/**
 * A booking that has been refunded in full can no longer be an active
 * reservation — the hotel is no longer holding the guest's money for that
 * room. Without this, a full refund could leave a booking as
 * CONFIRMED/CHECKED_IN with paymentStatus REFUNDED: an impossible state
 * where the room stays reserved for a stay nobody paid for.
 */
async function closeBookingAfterFullRefund(req: Request, booking: InstanceType<typeof Booking>) {
  // Only PENDING/CONFIRMED can legally move to CANCELLED (see
  // booking-state.service.ts). Notably this now EXCLUDES CHECKED_IN: this
  // function used to unconditionally force a CHECKED_IN booking straight to
  // CANCELLED on a full refund, which directly contradicted
  // cancellation.controller.ts's own explicit rule ("Cannot cancel a
  // booking that is CHECKED_IN") — a guest physically in the room would be
  // shown as CANCELLED. The refund itself still completes either way; a
  // CHECKED_IN booking simply keeps its status (the room/inventory/coupon
  // release below only makes sense for a booking that never occupied, or is
  // no longer occupying, the room).
  if (!isLegalBookingTransition(booking.status, BookingStatus.CANCELLED)) return;

  if (booking.assignedRoom) {
    await transitionRoomStatus(booking.assignedRoom.toString(), RoomStatus.AVAILABLE, {
      req,
      action: "room.released_on_full_refund",
      metadata: { bookingId: booking._id.toString(), bookingReference: booking.bookingReference },
    }).catch(() => undefined);
  }
  await releaseInventoryDays({
    roomCategoryId: booking.roomCategory.toString(),
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
  }).catch(() => undefined);
  if (booking.couponRedeemed) {
    await releaseCouponForCancelledBooking(booking._id.toString());
  }

  await transitionBookingStatus(booking, BookingStatus.CANCELLED, {
    req,
    action: "booking.cancelled",
    metadata: { reason: "fully refunded" },
  });
}

function getRazorpay() {
  try {
    const Razorpay = require("razorpay");
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (e: any) {
    throw new Error(`Razorpay unavailable: ${e.message}`);
  }
}

function refundNotification(booking: { bookingReference: string; guestDetails: any; _id: any }, amount: number) {
  return sendNotification({
    type: NotificationType.REFUND_UPDATE,
    recipientEmail: booking.guestDetails.email,
    subject: `Refund Processed — ${booking.bookingReference}`,
    body: `Hi ${booking.guestDetails.firstName}, a refund of ₹${amount} has been processed for your booking ${booking.bookingReference}.`,
    bookingId: booking._id.toString(),
  }).catch(() => undefined);
}

const initiateRefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(5),
});

export const getRefunds = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "15", status } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    const query: any = {};
    if (status) query.status = status;

    const [refunds, total] = await Promise.all([
      Refund.find(query)
        .populate("booking", "bookingReference guestDetails")
        .populate("initiatedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l),
      Refund.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        refunds,
        total,
        totalPages: Math.ceil(total / l),
        page: p
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const initiateRefund = async (req: Request, res: Response) => {
  try {
    const data = initiateRefundSchema.parse(req.body);

    const payment = await Payment.findById(data.paymentId);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    // Atomic claim: this is the actual database-level invariant that
    // prevents a double-click, a network retry, or two concurrent admin
    // requests from refunding more than the payment's original amount.
    // The condition re-checks refundedAmount at write time, not from the
    // stale `payment` read above — a read-then-write sum check alone would
    // still allow two concurrent requests to both pass validation before
    // either commits.
    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: [PaymentTxStatus.COMPLETED, PaymentTxStatus.PARTIALLY_REFUNDED] },
        refundedAmount: { $lte: payment.amount - data.amount },
      },
      { $inc: { refundedAmount: data.amount } },
      { new: true }
    );

    if (!claimedPayment) {
      return res.status(400).json({
        success: false,
        message: "Refund amount exceeds the remaining refundable balance, or this payment is not refundable",
      });
    }

    const booking = await Booking.findById(claimedPayment.booking);
    if (!booking) {
      // Roll back the claim — there is nothing to refund against.
      await Payment.updateOne({ _id: claimedPayment._id }, { $inc: { refundedAmount: -data.amount } });
      return res.status(404).json({ success: false, message: "Associated booking not found" });
    }

    const isFullyRefunded = claimedPayment.refundedAmount >= claimedPayment.amount;

    // Create refund record
    const refund = new Refund({
      booking: booking._id,
      payment: claimedPayment._id,
      amount: data.amount,
      reason: data.reason,
      status: RefundStatus.PROCESSING,
      initiatedBy: (req as any).user.id
    });

    await refund.save();

    // Process with Razorpay if applicable
    if (claimedPayment.razorpayPaymentId) {
      try {
        const razorpay = getRazorpay();
        const rzpRefund = await razorpay.payments.refund(claimedPayment.razorpayPaymentId, {
          amount: Math.round(data.amount * 100),
          notes: { refundId: refund._id.toString() }
        });

        refund.razorpayRefundId = rzpRefund.id;
        refund.status = RefundStatus.COMPLETED;
        await refund.save();

        claimedPayment.status = isFullyRefunded ? PaymentTxStatus.REFUNDED : PaymentTxStatus.PARTIALLY_REFUNDED;
        await claimedPayment.save();

        booking.paymentStatus = isFullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIAL;
        booking.paidAmount = Math.max(0, booking.paidAmount - data.amount);
        if (isFullyRefunded) {
          await closeBookingAfterFullRefund(req, booking);
        }
        await booking.save();

        await createAuditLog({
          req,
          action: "refund.completed",
          resourceType: "Refund",
          resourceId: refund._id.toString(),
          metadata: { bookingId: booking._id.toString(), amount: data.amount, gateway: "razorpay" },
        });

        await refundNotification(booking, data.amount);

        return res.status(200).json({ success: true, data: refund, message: "Refund processed successfully" });
      } catch (rzpError: any) {
        refund.status = RefundStatus.FAILED;
        await refund.save();

        // The gateway refund did not actually happen — release the claimed
        // balance so it doesn't stay permanently locked out of future
        // refund attempts.
        await Payment.updateOne({ _id: claimedPayment._id }, { $inc: { refundedAmount: -data.amount } });

        await createAuditLog({
          req,
          action: "refund.failed",
          resourceType: "Refund",
          resourceId: refund._id.toString(),
          metadata: { bookingId: booking._id.toString(), amount: data.amount, error: rzpError.message },
        });

        return res.status(400).json({ success: false, message: `Refund failed at gateway: ${rzpError.message}` });
      }
    } else {
      // Manual refund for CASH or OFFLINE
      refund.status = RefundStatus.COMPLETED;
      await refund.save();

      claimedPayment.status = isFullyRefunded ? PaymentTxStatus.REFUNDED : PaymentTxStatus.PARTIALLY_REFUNDED;
      await claimedPayment.save();

      booking.paymentStatus = isFullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIAL;
      booking.paidAmount = Math.max(0, booking.paidAmount - data.amount);
      if (isFullyRefunded) {
        await closeBookingAfterFullRefund(req, booking);
      }
      await booking.save();

      await createAuditLog({
        req,
        action: "refund.completed",
        resourceType: "Refund",
        resourceId: refund._id.toString(),
        metadata: { bookingId: booking._id.toString(), amount: data.amount, gateway: "offline" },
      });

      await refundNotification(booking, data.amount);

      return res.status(200).json({ success: true, data: refund, message: "Offline refund recorded successfully" });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    logger.error("refund.initiate_failed", { requestId: req.id, message: error.message, paymentId: req.body?.paymentId });
    return res.status(500).json({ success: false, message: error.message });
  }
};
