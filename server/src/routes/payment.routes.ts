import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { createOrder, verifyPayment, getPaymentByBooking, getPayments, getPaymentById } from "../controllers/payment.controller";

const router = Router();

// Create Razorpay order (public — guest can pay without account)
router.post("/create-order", createOrder);

// Verify payment signature (public — called after Razorpay widget success)
router.post("/verify", verifyPayment);

// Admin: view all payments
router.get("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getPayments);

// Admin: get payment by ID
router.get("/detail/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getPaymentById);

// Admin: view payment details for a booking (existing)
router.get("/:bookingId", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getPaymentByBooking);

export default router;
