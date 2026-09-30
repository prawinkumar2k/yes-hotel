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
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Ownership check — customer can only cancel their own booking
    // Admin/Manager can cancel any booking
    const isAdmin = ["ADMIN", "MANAGER", "RECEPTIONIST"].includes(req.user?.role || "");
    const isOwner = booking.customer?.toString() === req.user?.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this booking" });
    }

    const currentStatus = booking.status;
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
