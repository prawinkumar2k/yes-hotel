import { queueForVerification } from "../services/reception-verification";
import { VerificationType } from "../models/VerificationRequest";
import { Request, Response } from "express";
import { Booking, BookingStatus } from "../models/Booking";
import { RoomStatus } from "../models/Room";
import { IllegalBookingTransitionError, transitionBookingStatus } from "../services/booking-state.service";
import { transitionRoomStatus } from "../services/room-state.service";
import { releaseInventoryDays } from "../services/booking-safety.service";
import { releaseCouponForCancelledBooking } from "../services/coupon.service";
import { sendNotification } from "../services/notification.service";
import { NotificationType } from "../models/NotificationLog";
import { Payment, PaymentTxStatus } from "../models/Payment";
import { Refund, RefundStatus } from "../models/Refund";

// POST /api/bookings/:id/cancel
export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Ownership check — customer can only cancel their own booking;
    // staff holding CAP.BOOKING_CANCEL_ANY can cancel any booking.
    const { PermissionService } = await import("../services/PermissionService");
    const isAdmin = await PermissionService.can(req.user, "CAP.BOOKING_CANCEL_ANY");
    const isOwner = booking.customer?.toString() === req.user?.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this booking" });
    }

    const currentStatus = booking.status;

    // A guest already in the room: staff only — the bill is reversed and the room freed.
    if (currentStatus === BookingStatus.CHECKED_IN) {
      if (!isAdmin) return res.status(400).json({ success: false, message: "You are already checked in. Please speak to Reception." });
      const { cancelCheckedInStay, CancelStayError } = await import("../services/cancel-stay.service");
      try {
        const out = await cancelCheckedInStay({ bookingId: String(booking._id), reason, cancellationCharge: req.body?.cancellationCharge, actorId: String(req.user?.id), req });
        if (out.refundDue > 0) {
          await queueForVerification({
            type: VerificationType.CANCEL_WITH_ADVANCE,
            subjectKey: `booking:${booking._id}:cancel`,
            returnQueue: "FRONT_DESK",
            summary: `Checked-in stay cancelled; ₹${out.refundDue.toLocaleString("en-IN")} to refund`,
            amount: out.refundDue,
            bookingId: booking._id,
            details: { previousStatus: currentStatus, reason, cancellationCharge: out.cancellationCharge },
            note: reason,
            req,
          });
        }
        const updated = await Booking.findById(booking._id);
        return res.json({
          success: true,
          message: `Stay cancelled${out.roomNumber ? `; room ${out.roomNumber} sent for cleaning` : ""}` + (out.refundDue > 0 ? `. ₹${out.refundDue.toLocaleString("en-IN")} is due back to the guest — refund it from the bill or Advances.` : "")
            + (out.amountDue > 0 ? `. ₹${out.amountDue.toLocaleString("en-IN")} of the cancellation charge is still to be collected.` : "")
            + (out.refundDue > 0 || out.amountDue > 0 ? "" : "."),
          data: updated,
          cancellation: out,
        });
      } catch (e: any) {
        if (e instanceof CancelStayError) return res.status(e.status).json({ success: false, message: e.message });
        throw e;
      }
    }

    try {
      await transitionBookingStatus(booking, BookingStatus.CANCELLED, {
        req,
        action: "booking.cancelled",
        metadata: { cancelledBy: isAdmin ? "staff" : "customer" },
      });
    } catch (error) {
      if (error instanceof IllegalBookingTransitionError) {
        const message =
          currentStatus === BookingStatus.CANCELLED
            ? "Booking is already cancelled"
            : `Cannot cancel a booking that is ${currentStatus}`;
        return res.status(400).json({ success: false, message });
      }
      throw error;
    }

    if (booking.assignedRoom) {
      await transitionRoomStatus(booking.assignedRoom.toString(), RoomStatus.AVAILABLE, {
        req,
        action: "room.released_on_cancellation",
        metadata: { bookingId: booking._id.toString(), bookingReference: booking.bookingReference },
      }).catch(() => undefined); // room may already be in a state where AVAILABLE isn't a legal target; don't block cancellation on it
    }

    await releaseInventoryDays({
      roomCategoryId: booking.roomCategory.toString(),
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
    });

    if (booking.couponRedeemed) {
      await releaseCouponForCancelledBooking(booking._id.toString());
    }

    booking.cancellationReason = reason;

    // A staff cancellation of a booking that holds money is verified by Reception.
    if (isAdmin) {
      const { AdvancePayment } = await import("../models/AdvancePayment");
      const { Payment } = await import("../models/Payment");
      const [adv, paid] = await Promise.all([
        AdvancePayment.aggregate([{ $match: { booking: booking._id } }, { $group: { _id: null, t: { $sum: "$amount" } } }]),
        Payment.aggregate([{ $match: { booking: booking._id, status: { $in: ["COMPLETED", "PARTIALLY_REFUNDED"] } } }, { $group: { _id: null, t: { $sum: "$amount" } } }]),
      ]);
      const held = (adv[0]?.t ?? 0) + (paid[0]?.t ?? 0);
      if (held > 0) {
        await queueForVerification({
          type: VerificationType.CANCEL_WITH_ADVANCE,
          subjectKey: `booking:${booking._id}:cancel`,
          returnQueue: "FRONT_DESK",
          summary: `Cancelled with ₹${held.toLocaleString("en-IN")} received`,
          amount: held,
          bookingId: booking._id,
          details: { previousStatus: currentStatus, reason },
          note: reason,
          req,
        });
      }
    }

    // Calculate Penalty Percentage
    let penaltyPercentage = 0;
    
    if (reason && (reason.toLowerCase().includes("urgent") || reason.toLowerCase().includes("emergency"))) {
      penaltyPercentage = 0; // Emergency = 0% penalty (Full refund)
    } else {
      const now = new Date();
      const checkIn = new Date(booking.checkInDate);
      
      // Calculate hours until check-in. If booking was for today, hoursUntilCheckIn might be negative.
      const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilCheckIn >= 48) {
        penaltyPercentage = 0; // Free cancellation
      } else if (hoursUntilCheckIn >= 24) {
        penaltyPercentage = 50; // 50% penalty
      } else {
        penaltyPercentage = 100; // 100% penalty
      }
    }

    const penaltyAmount = (booking.totalAmount * penaltyPercentage) / 100;
    booking.cancellationPenalty = penaltyAmount;

    // Automatic Refund logic
    const payments = await Payment.find({ booking: booking._id, status: { $in: [PaymentTxStatus.COMPLETED, PaymentTxStatus.PARTIALLY_REFUNDED] } });
    let totalRefunded = 0;
    
    // We only refund the portion of paidAmount that exceeds the penaltyAmount
    let amountToRefundOverall = Math.max(0, (booking.paidAmount || 0) - penaltyAmount);

    for (const payment of payments) {
      if (amountToRefundOverall <= 0) break;

      const availableToRefundOnThisPayment = payment.amount - payment.refundedAmount;
      if (availableToRefundOnThisPayment > 0) {
        const refundAmount = Math.min(amountToRefundOverall, availableToRefundOnThisPayment);
        
        // Mark payment as claimed
        await Payment.updateOne(
          { _id: payment._id },
          { $inc: { refundedAmount: refundAmount } }
        );
        
        const refund = new Refund({
          booking: booking._id,
          payment: payment._id,
          amount: refundAmount,
          reason: `Auto-refund (Penalty: ${penaltyPercentage}%). Reason: ${reason || 'N/A'}`,
          status: RefundStatus.PROCESSING,
          initiatedBy: req.user?.id || booking.customer,
        });
        await refund.save();
        totalRefunded += refundAmount;
        amountToRefundOverall -= refundAmount;
      }
    }
    
    if (totalRefunded > 0) {
      booking.paidAmount = Math.max(0, (booking.paidAmount || 0) - totalRefunded);
      booking.paymentStatus = booking.paidAmount === 0 ? "REFUNDED" : "PARTIAL" as any;
    }

    await booking.save();

    await sendNotification({
      type: NotificationType.BOOKING_CANCELLATION,
      recipientEmail: booking.guestDetails.email,
      subject: `Booking Cancelled — ${booking.bookingReference}`,
      body: `Hi ${booking.guestDetails.firstName}, your booking ${booking.bookingReference} has been cancelled.`,
      bookingId: booking._id.toString(),
    }).catch(() => undefined);

    const updatedBooking = await Booking.findById(req.params.id);
    return res.status(200).json({ success: true, message: "Booking cancelled successfully", data: updatedBooking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
