import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { Request, Response } from "express";
import { AdvancePayment, AdvancePaymentMethod } from "../models/AdvancePayment";
import { Guest } from "../models/Guest";
import { receiveAdvance, adjustAdvance, refundAdvance, getAdvanceSummary } from "../services/advance.service";

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
router.post(
  "/",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { bookingId, guestId, guestName, guestPhone, guestEmail, amount, method, referenceNumber, razorpayPaymentId, purpose, notes } = req.body;

      let resolvedGuestId = guestId;
      if (!resolvedGuestId) {
        if (!guestName || !guestPhone || !guestEmail) {
          return res.status(400).json({
            success: false,
            message: "Either guestId, or guestName + guestPhone + guestEmail, are required",
          });
        }
        const email = String(guestEmail).trim().toLowerCase();
        const guest = await Guest.findOneAndUpdate(
          { email },
          { $setOnInsert: { email, fullName: guestName, phone: guestPhone } },
          { upsert: true, new: true }
        );
        resolvedGuestId = guest._id.toString();
      }

      if (!resolvedGuestId || !amount || !method) {
        return res.status(400).json({ success: false, message: "guestId, amount, and method are required" });
      }
      const advance = await receiveAdvance(
        { bookingId, guestId: resolvedGuestId, amount: Number(amount), method: method as AdvancePaymentMethod, referenceNumber, razorpayPaymentId, purpose, receivedBy: (req as any).user?.id, notes },
        { req }
      );
      return res.status(201).json({ success: true, data: advance });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

// GET /api/advances — list advances (filter by booking or guest)
router.get(
  "/",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { bookingId, guestId, status } = req.query;
      const filter: Record<string, any> = {};
      if (bookingId) filter.booking = bookingId as string;
      if (guestId) filter.guest = guestId as string;
      if (status) filter.status = status as string;
      const advances = await AdvancePayment.find(filter)
        .populate("guest", "fullName email phone")
        .populate("booking", "bookingReference checkInDate checkOutDate")
        .sort({ receivedAt: -1 })
        .lean();
      return res.json({ success: true, data: advances });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/advances/summary/:bookingId
router.get(
  "/summary/:bookingId",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const summary = await getAdvanceSummary(req.params.bookingId as string);
      return res.json({ success: true, data: summary });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

// POST /api/advances/:id/adjust — apply advance to folio
router.post(
  "/:id/adjust",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { folioId, bookingId, amount, reason } = req.body;
      if (!folioId || !bookingId || !amount) {
        return res.status(400).json({ success: false, message: "folioId, bookingId, and amount are required" });
      }
      const result = await adjustAdvance(
        { advancePaymentId: req.params.id as string, folioId: folioId as string, bookingId: bookingId as string, amount: Number(amount), performedBy: (req as any).user?.id as string, reason },
        { req }
      );
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

// POST /api/advances/:id/refund — refund remaining balance to guest
router.post(
  "/:id/refund",
  authorize("MANAGER", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { amount, reason } = req.body;
      if (!amount || !reason) {
        return res.status(400).json({ success: false, message: "amount and reason are required" });
      }
      const result = await refundAdvance(
        { advancePaymentId: req.params.id as string, amount: Number(amount), performedBy: (req as any).user?.id as string, reason: reason as string },
        { req }
      );
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

export default router;
