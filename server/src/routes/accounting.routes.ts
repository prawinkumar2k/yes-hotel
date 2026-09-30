import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { getAccountingSummary, getCorporateCreditAging } from "../controllers/accounting.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/summary", protect, requirePropertyAccess, requirePermission("ACCOUNTING", "VIEW"), getAccountingSummary);
router.get("/aging", protect, requirePropertyAccess, requirePermission("ACCOUNTING", "VIEW"), getCorporateCreditAging);

export default router;
