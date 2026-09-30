import { Router } from "express";
import {
  Booking,
  BookingStatus,
  PaymentStatus,
  BookingSource,
  BookingType,
  RegistrationStatus,
  SignatureStatus,
} from "../models/Booking";
import { Room } from "../models/Room";

const router = Router();

/**
 * MOCK OTA Webhook Endpoint
 * In production, you would integrate this with Channex.io, SiteMinder, or STAAH.
 * The channel manager would send POST requests here when a booking is created or cancelled on MMT, Agoda, etc.
 */
router.post("/channex-webhook", async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (event === "BOOKING_CREATE") {
      // Mock parsing external booking payload
      const { otaId, guestName, checkInDate, checkOutDate, source } = payload;
      
      // Auto-assign an available room
      const room = await Room.findOne({ isClean: true, isMaintenance: false });
      
      if (room) {
        await Booking.create({
          guestDetails: {
            firstName: guestName,
            lastName: "",
            email: "ota@example.com",
            phone: "0000000000"
          },
          checkInDate: new Date(checkInDate),
          checkOutDate: new Date(checkOutDate),
          status: BookingStatus.CONFIRMED,
          stayType: "NIGHTLY" as const,
          source: (source as BookingSource) || BookingSource.OTA,
          roomCategory: room.category,
          assignedRoom: room._id,
          adults: 1,
          children: 0,
          totalAmount: 0,
          taxAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          paidAmount: 0,
          paymentStatus: PaymentStatus.UNPAID,
          discountAmount: 0,
          couponRedeemed: false,
          isVipGuest: false,
          bookingType: BookingType.INDIVIDUAL,
          registrationStatus: RegistrationStatus.DRAFT,
          signatureStatus: SignatureStatus.NOT_COLLECTED,
        });
      }
    } else if (event === "BOOKING_CANCEL") {
      const { otaId } = payload;
      // Find and cancel internal booking by external OTA ID reference
      // (Assuming we added an externalBookingId field to Booking)
      // await Booking.findOneAndUpdate({ externalBookingId: otaId }, { status: BookingStatus.CANCELLED });
    }

    // Acknowledge receipt to the channel manager
    res.status(200).json({ success: true, message: "Sync processed" });
  } catch (error) {
    console.error("OTA Sync Error:", error);
    res.status(500).json({ success: false, message: "Sync failed" });
  }
});

export default router;
