import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getCurrentShift,
  getAllShifts,
  openShift,
  closeShift,
} from "../controllers/cashier-shift.controller";

const router = Router();
const CASHIER_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/current", protect, authorize(...CASHIER_ROLES), getCurrentShift);
router.get("/", protect, authorize(...CASHIER_ROLES), getAllShifts);
router.post("/open", protect, authorize(...CASHIER_ROLES), openShift);
router.post("/:id/close", protect, authorize(...CASHIER_ROLES), closeShift);

export default router;
