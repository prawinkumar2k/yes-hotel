import { Router } from "express";
import { protect, authorize, optionalProtect } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import {
  checkAvailability, createBooking, getMyBookings, getMyBookingById, getMyBookingInvoice, checkIn, checkOut
} from "../controllers/booking.controller";
import { cancelBooking } from "../controllers/cancellation.controller";
import { confirmDemoBooking } from "../controllers/payment.controller";

const router = Router();

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST];

// Public availability
router.get("/availability", checkAvailability);

// Create booking (public or logged-in customer)
router.post("/", optionalProtect, createBooking);

// Customer's own bookings
router.get("/my", protect, getMyBookings);
router.get("/my/:id", protect, getMyBookingById);
router.get("/my/:id/invoice", protect, getMyBookingInvoice);

// Dev-only demo payment confirmation — hard-disabled in production
// regardless of Razorpay config (see confirmDemoBooking). optionalProtect
// (not protect) because guest checkout has no account to require a login
// for; when a caller IS logged in, the controller still enforces that only
// the booking's own owner or an admin/manager may use it.
router.post("/:id/confirm-demo", optionalProtect, confirmDemoBooking);

// Cancel booking (customer or admin)
router.post("/:id/cancel", protect, cancelBooking);

// Check-in / Check-out (admin/receptionist)
router.post("/:id/check-in", protect, authorize(...ADMIN_ROLES), checkIn);
router.post("/:id/check-out", protect, authorize(...ADMIN_ROLES), checkOut);

export default router;
