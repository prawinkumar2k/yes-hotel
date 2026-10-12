import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import {
  getCurrentShift,
  getAllShifts,
  getShiftDetails,
  openShift,
  recordPaidOut,
  initiateHandover,
  confirmHandover,
  closeShift,
  getCashierStaffList,
} from "../controllers/cashier-shift.controller";

const router = Router();

// Eligible cashiers and front-desk staff for shift handover and assignment
router.get("/cashiers", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "VIEW"), getCashierStaffList);

// Current active shift flight deck
router.get("/current", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "VIEW"), getCurrentShift);

// Shift audit history list
router.get("/", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "VIEW"), getAllShifts);

// Shift details with itemized drilldown
router.get("/:id/details", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "VIEW"), getShiftDetails);

// Open shift
router.post("/open", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "OPEN_SHIFT"), openShift);

// Record paid-out (cash drop / petty expense)
router.post("/:id/paid-out", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "RECONCILE"), recordPaidOut);

// Handover workflows
router.post("/:id/handover/initiate", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CLOSE_SHIFT"), initiateHandover);
router.post("/:id/handover/confirm", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "OPEN_SHIFT"), confirmHandover);

// Reconcile and close shift
router.post("/:id/close", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CLOSE_SHIFT"), closeShift);

export default router;
