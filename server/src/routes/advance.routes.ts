import { queueForVerification } from "../services/reception-verification";
import { VerificationType } from "../models/VerificationRequest";
import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { Request, Response } from "express";
import { AdvancePayment, AdvancePaymentMethod } from "../models/AdvancePayment";
import { Guest } from "../models/Guest";
import mongoose from "mongoose";
import { receiveAdvance, adjustAdvance, refundAdvance, getAdvanceSummary, reconcileAdvances } from "../services/advance.service";

const router = Router();
router.use(protect);

// POST /api/advances — receive a new advance payment.
//
// Accepts EITHER an existing guestId, OR guestName/guestPhone/guestEmail for
// a walk-in deposit taken before any Guest record exists (e.g. a guest
// paying an advance ahead of a booking). In the latter case a Guest is
// resolved-or-created by email — deliberately NOT via
// guest.service.ts's syncGuestOnBookingCreated, since that increments
// totalBookings, which would be wrong for a deposit that isn't a booking.
router.post("/", requirePropertyAccess, requirePermission("ADVANCES", "CREATE"), async (req: Request, res: Response) => {
    try {
      const { bookingId, guestId, guestName, guestPhone, guestEmail, amount, method, paymentChannelId, referenceNumber, razorpayPaymentId, purpose, notes } = req.body;

      // The deposit goes on the SAME guest: matched by email, then by mobile number (a walk-in with
      // no email, or an email typed in another case, must never become a second guest record).
      let resolvedGuestId = guestId;
      let guestNote: string | undefined;
      if (!resolvedGuestId) {
        if (!guestName || !guestPhone) {
          return res.status(400).json({ success: false, message: "Enter the guest's name and mobile number (email is optional)" });
        }
        const { resolveGuest } = await import("../services/guest-match.service");
        const found = await resolveGuest({ name: String(guestName), phone: String(guestPhone), email: guestEmail ? String(guestEmail) : undefined });
        resolvedGuestId = found.guest._id.toString();
        guestNote = found.created ? "new guest" : `existing guest (matched by ${found.matchedBy})`;
      }

      // The form sends the payment channel chosen at the desk (e.g. "Cash Counter"); the method
      // follows from the channel when it is not sent explicitly.
      if (!resolvedGuestId) return res.status(400).json({ success: false, message: "Choose the guest" });
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ success: false, message: "Enter an amount greater than zero" });
      const { resolveAdvanceMethod } = await import("../services/advance.service");
      let method_: string;
      try {
        method_ = await resolveAdvanceMethod(method, paymentChannelId);
      } catch (e: any) {
        return res.status(400).json({ success: false, message: e.message });
      }
      const { resolvePaymentChannel } = await import("../utils/payment-channel.resolver");
      const resolvedChannelId = await resolvePaymentChannel(method_, paymentChannelId);

      const advance = await receiveAdvance(
        { bookingId, guestId: resolvedGuestId, amount: value, method: method_ as AdvancePaymentMethod, paymentChannelId: resolvedChannelId?.toString(), referenceNumber, razorpayPaymentId, purpose, receivedBy: (req as any).user?.id, notes },
        { req }
      );
      return res.status(201).json({ success: true, data: advance, guest: guestNote });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

// ── Advance booking: reserve rooms for a later stay against an advance ─────────────────────────
// POST /api/advances/bookings/quote           live price, GST and free rooms (changes nothing)
// POST /api/advances/bookings                 reserve the rooms + take the advance (one transaction)
// GET  /api/advances/bookings/:id/confirmation   data for the printed Booking Confirmation
const reservationFail = async (res: Response, error: any) => {
  const { ReservationError } = await import("../services/advance-reservation.service");
  if (error instanceof ReservationError) return res.status(error.status).json({ success: false, message: error.message });
  return res.status(500).json({ success: false, message: "We couldn't save the reservation. Nothing was booked — please try again.", requestId: (res.req as any)?.id });
};

router.post("/bookings/quote", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
  try {
    const { quoteReservation } = await import("../services/advance-reservation.service");
    return res.json({ success: true, data: await quoteReservation(req.body ?? {}) });
  } catch (error: any) {
    return reservationFail(res, error);
  }
});

router.post("/bookings", requirePropertyAccess, requirePermission("ADVANCES", "CREATE"), async (req: Request, res: Response) => {
  try {
    const { createAdvanceReservation } = await import("../services/advance-reservation.service");
    const data = await createAdvanceReservation(req.body ?? {}, { req, actorId: String((req as any).user?.id) });
    return res.status(data.duplicate ? 200 : 201).json({
      success: true,
      message: data.duplicate ? "This reservation was already saved" : `Booking ${data.bookingNumber} confirmed — ${data.rooms} room${data.rooms === 1 ? "" : "s"} reserved`,
      data,
    });
  } catch (error: any) {
    return reservationFail(res, error);
  }
});

router.get("/bookings/:id/confirmation", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
  try {
    const { getReservationConfirmation } = await import("../services/advance-reservation.service");
    return res.json({ success: true, data: await getReservationConfirmation(String(req.params.id)) });
  } catch (error: any) {
    return reservationFail(res, error);
  }
});

// GET /api/advances — list advances (filter by booking or guest)
router.get("/", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
    try {
      const { bookingId, guestId, status } = req.query;
      const filter: Record<string, any> = {};
      const propId = (req as any).propertyId || (req as any).user?.propertyId;
      if (propId) filter.propertyId = propId;
      if (bookingId) filter.booking = bookingId as string;
      if (guestId) filter.guest = guestId as string;
      if (status) filter.status = status as string;
      const advances = await AdvancePayment.find(filter)
        .populate("guest", "fullName email phone")
        .populate("booking", "bookingReference checkInDate checkOutDate")
        .populate("receivedBy", "firstName lastName")
        .sort({ receivedAt: -1 })
        .lean();
      return res.json({ success: true, data: advances });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/advances/reconciliation — read-only: amount = applied + refunded + remaining, and applied = folio lines
router.get("/reconciliation", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
    try {
      const propertyId = (req as any).propertyId;
      const data = await reconcileAdvances(propertyId ? { propertyId } : {});
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/advances/:id/receipt — everything the printed advance receipt shows: the advance,
// its reservation (room, category, stay dates) and, for a multi-room booking, the other rooms.
router.get("/:id/receipt", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
    try {
      const advance: any = await AdvancePayment.findById(req.params.id)
        .populate("guest", "fullName email phone address")
        .populate("receivedBy", "firstName lastName")
        .lean();
      if (!advance) return res.status(404).json({ success: false, message: "Advance not found" });

      const { Booking } = await import("../models/Booking");
      const booking: any = advance.booking
        ? await Booking.findById(advance.booking)
            .select("bookingReference billNumber checkInDate checkOutDate assignedRoom roomCategory groupId adults children stayType status")
            .populate("assignedRoom", "roomNumber")
            .populate("roomCategory", "name")
            .lean()
        : null;
      const groupRooms = booking?.groupId
        ? (await Booking.find({ groupId: booking.groupId }).select("bookingReference assignedRoom").populate("assignedRoom", "roomNumber").lean()).map((b: any) => ({
            bookingReference: b.bookingReference,
            roomNumber: b.assignedRoom?.roomNumber,
          }))
        : [];

      // The whole reservation (rooms, meal plan, times, total, advances so far, balance) when there is one.
      let reservation: any = null;
      if (booking) {
        const { getReservationConfirmation } = await import("../services/advance-reservation.service");
        reservation = await getReservationConfirmation(String(booking._id)).catch(() => null);
      }
      return res.json({ success: true, data: { advance, booking, groupRooms, reservation } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/advances/summary/:bookingId
router.get("/summary/:bookingId", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
    try {
      const summary = await getAdvanceSummary(req.params.bookingId as string);
      return res.json({ success: true, data: summary });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// POST /api/advances/:id/adjust — apply advance to folio
router.post("/:id/adjust", requirePropertyAccess, requirePermission("ADVANCES", "ADJUST"), async (req: Request, res: Response) => {
    try {
      const { folioId, bookingId, amount, reason } = req.body;
      if (!folioId || !bookingId || !amount) {
        return res.status(400).json({ success: false, message: "folioId, bookingId, and amount are required" });
      }
      // Advance decrement, adjustment record and folio credit commit together.
      const session = await mongoose.startSession();
      let result: any;
      try {
        await session.withTransaction(async () => {
          result = await adjustAdvance(
            { advancePaymentId: req.params.id as string, folioId: folioId as string, bookingId: bookingId as string, amount: Number(amount), performedBy: (req as any).user?.id as string, reason },
            { req, session }
          );
        });
      } finally {
        await session.endSession();
      }
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

// POST /api/advances/:id/refund — refund remaining balance to guest
router.post("/:id/refund", requirePropertyAccess, requirePermission("ADVANCES", "REFUND"), async (req: Request, res: Response) => {
    try {
      const { amount, reason } = req.body;
      if (!amount || !reason) {
        return res.status(400).json({ success: false, message: "amount and reason are required" });
      }
      const result = await refundAdvance(
        { advancePaymentId: req.params.id as string, amount: Number(amount), performedBy: (req as any).user?.id as string, reason: reason as string },
        { req }
      );
      const adv: any = await AdvancePayment.findById(req.params.id).select("advanceNumber booking method").lean();
      await queueForVerification({
        type: VerificationType.REFUND,
        subjectKey: `advanceRefund:${result.adjustment._id}`,
        returnQueue: "CASHIER",
        summary: `Advance ${adv?.advanceNumber ?? ""} refund ₹${Number(amount).toLocaleString("en-IN")} (${adv?.method ?? ""})`,
        amount: Number(amount),
        bookingId: adv?.booking,
        details: { advanceNumber: adv?.advanceNumber, method: adv?.method, reason },
        note: String(reason),
        req,
      });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

export default router;
