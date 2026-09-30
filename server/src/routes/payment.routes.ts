import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { createOrder, verifyPayment, getPaymentByBooking, getPayments, getPaymentById } from "../controllers/payment.controller";

const router = Router();

// Create Razorpay order (public — guest can pay without account)
router.post("/create-order", createOrder);

// Verify payment signature (public — called after Razorpay widget success)
router.post("/verify", verifyPayment);

// Admin: view all payments
router.get("/", protect, requirePropertyAccess, requirePermission("PAYMENTS", "VIEW"), getPayments);

// Admin: get payment by ID
router.get("/detail/:id", protect, requirePropertyAccess, requirePermission("PAYMENTS", "VIEW"), getPaymentById);

// Admin: view payment details for a booking (existing)
router.get("/:bookingId", protect, requirePropertyAccess, requirePermission("PAYMENTS", "VIEW"), getPaymentByBooking);

export default router;
