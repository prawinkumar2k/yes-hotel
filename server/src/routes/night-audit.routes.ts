import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import {
  getNightAuditStatus,
  getNightAuditPreview,
  getNightAuditHistory,
  runNightAudit,
} from "../controllers/night-audit.controller";

const router = Router();

router.get("/status", protect, requirePropertyAccess, requirePermission("NIGHT_AUDIT", "VIEW_STATUS"), getNightAuditStatus);
router.get("/preview", protect, requirePropertyAccess, requirePermission("NIGHT_AUDIT", "VIEW"), getNightAuditPreview);
router.get("/history", protect, requirePropertyAccess, requirePermission("NIGHT_AUDIT", "VIEW"), getNightAuditHistory);
router.post("/run", protect, requirePropertyAccess, requirePermission("NIGHT_AUDIT", "EXECUTE"), runNightAudit);

export default router;
