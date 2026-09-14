import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getSalesReport,
  getRoomStayReport,
  getGstReport,
  getAdvanceReport,
  getRevenueTrend,
  getDepartmentPL,
  getOccupancyHeatmap,
  getExecutiveSummary,
  getInHouseList,
} from "../controllers/reports.controller";

const router = Router();
const MANAGER_ROLES = ["ADMIN", "MANAGER"];

router.get("/sales", protect, authorize(...MANAGER_ROLES), getSalesReport);
router.get("/room-stay", protect, authorize(...MANAGER_ROLES), getRoomStayReport);
router.get("/gst", protect, authorize(...MANAGER_ROLES), getGstReport);
router.get("/advances", protect, authorize(...MANAGER_ROLES), getAdvanceReport);
router.get("/in-house-list", protect, authorize(...MANAGER_ROLES, "RECEPTIONIST"), getInHouseList);

// Phase 24 – Advanced Analytics
router.get("/revenue-trend", protect, authorize(...MANAGER_ROLES), getRevenueTrend);
router.get("/department-pl", protect, authorize(...MANAGER_ROLES), getDepartmentPL);
router.get("/occupancy-heatmap", protect, authorize(...MANAGER_ROLES), getOccupancyHeatmap);
router.get("/executive-summary", protect, authorize(...MANAGER_ROLES), getExecutiveSummary);

export default router;
