import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getRefunds, initiateRefund } from "../controllers/refund.controller";

const router = Router();

router.get("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getRefunds);
router.post("/initiate", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), initiateRefund);

export default router;
