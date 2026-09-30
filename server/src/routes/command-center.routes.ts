import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import express from "express";
import { getCommandCenterData } from "../controllers/commandCenter.controller";
import { protect, authorize } from "../middleware/auth.middleware";

const router = express.Router();

router.use(protect);
router.use(authorize("ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "RESTAURANT", "FINANCE", "EVENTS", "INVENTORY", "PROCUREMENT", "HOUSEKEEPING", "MAINTENANCE"));

router.get("/", getCommandCenterData);

export default router;
