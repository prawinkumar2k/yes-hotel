import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { createOrder, verifyPayment, getPaymentByBooking, getPayments, getPaymentById } from "../controllers/payment.controller";

const router = Router();

// Public: is online payment switched on? (no Razorpay keys = guests pay at the hotel)
router.get("/config", (_req, res) => {
  res.json({ success: true, data: { online: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) } });
});

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
