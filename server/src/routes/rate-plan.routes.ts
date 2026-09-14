import { Router } from "express";
import { protect, authorize, optionalProtect } from "../middleware/auth.middleware";
import { getRatePlans, createRatePlan, updateRatePlan, evaluateRatePreview } from "../controllers/rate-plan.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/", optionalProtect, getRatePlans);
router.post("/", protect, authorize(...ADMIN_ROLES), createRatePlan);
router.patch("/:id", protect, authorize(...ADMIN_ROLES), updateRatePlan);
router.post("/evaluate-rate", optionalProtect, evaluateRatePreview);

export default router;

