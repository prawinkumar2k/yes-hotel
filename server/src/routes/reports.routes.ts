import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
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
  getDaySummary,
  getMonthlyMIS,
  getDynamicReport
} from "../controllers/reports.controller";

const router = Router();
const MANAGER_ROLES = ["ADMIN", "MANAGER", "FINANCE"];

// Legacy specific routes have been removed in favor of unified dynamic reporting.
// The /:reportId route below now handles sales, room-stay, gst, advances, etc.

// Phase 24 – Advanced Analytics
router.get("/revenue-trend", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getRevenueTrend);
router.get("/department-pl", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getDepartmentPL);
router.get("/occupancy-heatmap", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getOccupancyHeatmap);
router.get("/executive-summary", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getExecutiveSummary);

// Specific custom reports
router.get("/in-house-list", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getInHouseList);
router.get("/day-summary", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getDaySummary);
router.get("/monthly-mis", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getMonthlyMIS);

// Unified dynamic report builder
router.get("/:reportId", protect, requirePropertyAccess, requirePermission("REPORTS_LAYOUT", "VIEW"), getDynamicReport);

export default router;
