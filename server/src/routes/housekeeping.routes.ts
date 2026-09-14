import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getHousekeepingDashboard, updateRoomHousekeepingStatus } from "../controllers/housekeeping.controller";

const router = Router();

// Room-centric mobile housekeeping view — see housekeeping.controller.ts for
// how this relates to the task-centric /api/admin/housekeeping endpoints.
router.get(
  "/dashboard",
  protect,
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.HOUSEKEEPING),
  getHousekeepingDashboard
);
router.patch(
  "/rooms/:id/status",
  protect,
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.HOUSEKEEPING),
  updateRoomHousekeepingStatus
);

export default router;
