import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { getNightAuditStatus, runNightAudit } from "../controllers/night-audit.controller";

const router = Router();

const AUDIT_ROLES = ["ADMIN", "MANAGER"];

router.get("/status", protect, requirePropertyAccess, requirePermission("NIGHT_AUDIT", "VIEW"), getNightAuditStatus);
router.post("/run", protect, requirePropertyAccess, requirePermission("NIGHT_AUDIT", "CREATE"), runNightAudit);

export default router;
