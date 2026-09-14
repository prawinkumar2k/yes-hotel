import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getNightAuditStatus, runNightAudit } from "../controllers/night-audit.controller";

const router = Router();

const AUDIT_ROLES = ["ADMIN", "MANAGER"];

router.get("/status", protect, authorize(...AUDIT_ROLES), getNightAuditStatus);
router.post("/run", protect, authorize(...AUDIT_ROLES), runNightAudit);

export default router;
