import { requireOnlineBookingOpen } from "../middleware/onlineBookingGate";
import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, optionalProtect } from "../middleware/auth.middleware";
import {
  checkAvailability, quoteBooking, createBooking, getMyBookings, getMyBookingById, getMyBookingInvoice, checkIn, checkOut,
  getCheckoutPreview, checkExtensionConflict, extendStay
} from "../controllers/booking.controller";
import { cancelBooking } from "../controllers/cancellation.controller";
import { confirmDemoBooking } from "../controllers/payment.controller";

const router = Router();


// Public availability
router.get("/availability", checkAvailability);
router.post("/availability", checkAvailability);
// Public, read-only price quote (same calculation createBooking charges)
router.post("/quote", quoteBooking);

// Create booking (public or logged-in customer)
router.post("/", optionalProtect, requireOnlineBookingOpen, createBooking);

// Customer's own bookings
router.get("/my", protect, getMyBookings);
router.get("/my/:id", protect, getMyBookingById);
router.get("/my/:id/invoice", protect, getMyBookingInvoice);

// Dev-only demo payment confirmation — hard-disabled in production
// regardless of Razorpay config (see confirmDemoBooking). optionalProtect
// (not protect) because guest checkout has no account to require a login
// for; when a caller IS logged in, the controller still enforces that only
// the booking's own owner or an admin/manager may use it.
router.post("/:id/confirm-demo", optionalProtect, requireOnlineBookingOpen, confirmDemoBooking);

// Cancel booking (customer or admin)
router.post("/:id/cancel", protect, cancelBooking);

// Check-in / Check-out (admin/receptionist)
router.post("/:id/check-in", protect, requirePropertyAccess, requirePermission("BOOKINGS", "CREATE"), checkIn);
router.get("/:id/checkout-preview", protect, requirePropertyAccess, requirePermission("BOOKINGS", "VIEW"), getCheckoutPreview);
router.post("/:id/check-out", protect, requirePropertyAccess, requirePermission("BOOKINGS", "CREATE"), checkOut);

// Stay Extension
router.post("/:id/extension-check", protect, requirePropertyAccess, requirePermission("BOOKINGS", "CREATE"), checkExtensionConflict);
router.post("/:id/extend", protect, requirePropertyAccess, requirePermission("BOOKINGS", "CREATE"), extendStay);

export default router;
