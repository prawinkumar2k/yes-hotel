import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissionAuth";
import {
  getPublicLandingPages,
  getLandingPageBySlug,
  trackBookingStart,
  getAllPagesAdmin,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  runAutomatedAudit,
  getSeoAnalytics,
} from "../controllers/seo.controller";

const router = Router();

// Public routes
router.get("/pages", getPublicLandingPages);
router.get("/pages/:slug", getLandingPageBySlug);
router.post("/track-start", trackBookingStart);

// Admin / Manager routes
router.get("/admin/pages", protect, requirePermission("SETTINGS", "VIEW"), getAllPagesAdmin);
router.get("/admin/audit", protect, requirePermission("SETTINGS", "VIEW"), runAutomatedAudit);
router.get("/admin/analytics", protect, requirePermission("SETTINGS", "VIEW"), getSeoAnalytics);
router.post("/admin/pages", protect, requirePermission("SETTINGS", "EDIT"), createLandingPage);
router.put("/admin/pages/:id", protect, requirePermission("SETTINGS", "EDIT"), updateLandingPage);
router.delete("/admin/pages/:id", protect, requirePermission("SETTINGS", "EDIT"), deleteLandingPage);

export default router;
