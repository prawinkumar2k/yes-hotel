import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getAuditLogs, exportAuditLogs } from "../controllers/auditLog.controller";

const router = Router();

router.get("/", protect, requirePermission("AUDIT_LOGS", "VIEW"), getAuditLogs);
router.get("/export", protect, requirePermission("AUDIT_LOGS", "EXPORT"), exportAuditLogs);

export default router;
