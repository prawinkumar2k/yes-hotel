import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getHousekeepingDashboard, updateRoomHousekeepingStatus } from "../controllers/housekeeping.controller";

const router = Router();

// Room-centric mobile housekeeping view — see housekeeping.controller.ts for
// how this relates to the task-centric /api/admin/housekeeping endpoints.
router.get("/dashboard", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "VIEW"), getHousekeepingDashboard
);
router.patch("/rooms/:id/status", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "EDIT"), updateRoomHousekeepingStatus
);

export default router;
