import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getAccountingSummary, getCorporateCreditAging } from "../controllers/accounting.controller";

const router = Router();

router.get("/summary", protect, requirePropertyAccess, requirePermission("ACCOUNTING", "VIEW"), getAccountingSummary);
router.get("/aging", protect, requirePropertyAccess, requirePermission("ACCOUNTING", "VIEW"), getCorporateCreditAging);

export default router;
