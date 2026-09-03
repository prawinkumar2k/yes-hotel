import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getAuditLogs } from "../controllers/auditLog.controller";

const router = Router();

router.get("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getAuditLogs);

export default router;
