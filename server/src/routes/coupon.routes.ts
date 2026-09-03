import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon } from "../controllers/coupon.controller";

const router = Router();

// Public validation endpoint (for checkout)
router.post("/validate", validateCoupon);

// Admin endpoints
router.get("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getCoupons);
router.post("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), createCoupon);
router.patch("/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), updateCoupon);
router.delete("/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), deleteCoupon);

export default router;
