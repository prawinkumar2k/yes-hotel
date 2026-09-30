import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getCurrentShift,
  getAllShifts,
  openShift,
  closeShift,
} from "../controllers/cashier-shift.controller";

const router = Router();
const CASHIER_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "FINANCE"];

router.get("/current", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "VIEW"), getCurrentShift);
router.get("/", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "VIEW"), getAllShifts);
router.post("/open", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CREATE"), openShift);
router.post("/:id/close", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CREATE"), closeShift);

export default router;
