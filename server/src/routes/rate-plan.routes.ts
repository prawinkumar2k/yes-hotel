import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize, optionalProtect } from "../middleware/auth.middleware";
import { getRatePlans, createRatePlan, updateRatePlan, evaluateRatePreview } from "../controllers/rate-plan.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/", optionalProtect, getRatePlans);
router.post("/", protect, requirePropertyAccess, requirePermission("RATE_PLANS", "CREATE"), createRatePlan);
router.patch("/:id", protect, requirePropertyAccess, requirePermission("RATE_PLANS", "EDIT"), updateRatePlan);
router.post("/evaluate-rate", optionalProtect, evaluateRatePreview);

export default router;

