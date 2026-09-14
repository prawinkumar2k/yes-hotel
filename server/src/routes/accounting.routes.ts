import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getAccountingSummary, getCorporateCreditAging } from "../controllers/accounting.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/summary", protect, authorize(...ADMIN_ROLES), getAccountingSummary);
router.get("/aging", protect, authorize(...ADMIN_ROLES), getCorporateCreditAging);

export default router;
