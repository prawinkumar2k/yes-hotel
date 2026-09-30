import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon } from "../controllers/coupon.controller";

const router = Router();

// Public validation endpoint (for checkout)
router.post("/validate", validateCoupon);

// Admin endpoints
router.get("/", protect, requirePropertyAccess, requirePermission("COUPONS", "VIEW"), getCoupons);
router.post("/", protect, requirePropertyAccess, requirePermission("COUPONS", "CREATE"), createCoupon);
router.patch("/:id", protect, requirePropertyAccess, requirePermission("COUPONS", "EDIT"), updateCoupon);
router.delete("/:id", protect, requirePropertyAccess, requirePermission("COUPONS", "DELETE"), deleteCoupon);

export default router;
