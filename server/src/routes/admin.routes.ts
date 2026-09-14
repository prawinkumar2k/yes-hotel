import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import {
  getAdminStats, getAdminBookings, getAdminBookingById, updateBookingStatus, getAdminCalendar
} from "../controllers/admin.controller";
import { getHousekeepingTasks, updateHousekeepingTask } from "../controllers/housekeeping.controller";
import {
  getMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket
} from "../controllers/maintenance.controller";
import { getContactMessages, updateContactStatus, deleteContactMessage } from "../controllers/contact.controller";
import { getAllReviews, moderateReview } from "../controllers/review.controller";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/roomCategory.controller";
import {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
} from "../controllers/pricing.controller";
import { getReportsOverview } from "../controllers/reports.controller";

const router = Router();

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST];

// Stats
router.get("/stats", protect, authorize(...ADMIN_ROLES), getAdminStats);
router.get("/reports/overview", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getReportsOverview);

// Bookings
router.get("/bookings", protect, authorize(...ADMIN_ROLES), getAdminBookings);
router.get("/bookings/:id", protect, authorize(...ADMIN_ROLES), getAdminBookingById);
router.patch("/bookings/:id/status", protect, authorize(...ADMIN_ROLES), updateBookingStatus);
router.get("/calendar", protect, authorize(...ADMIN_ROLES), getAdminCalendar);

// Housekeeping — MAINTENANCE staff also need visibility (a room they're
// servicing may be mid-clean), matching the admin sidebar's nav.roles for
// this page, which already includes MAINTENANCE.
router.get("/housekeeping", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.HOUSEKEEPING, UserRole.RECEPTIONIST, UserRole.MAINTENANCE), getHousekeepingTasks);
router.patch("/housekeeping/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.HOUSEKEEPING), updateHousekeepingTask);

// Maintenance — HOUSEKEEPING staff routinely discover and report issues
// while cleaning (a standard hotel workflow), so they can both view and
// create tickets, matching the admin sidebar's nav.roles for this page,
// which already includes HOUSEKEEPING.
router.get("/maintenance", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAINTENANCE, UserRole.RECEPTIONIST, UserRole.HOUSEKEEPING), getMaintenanceTickets);
router.post("/maintenance", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.HOUSEKEEPING), createMaintenanceTicket);
router.patch("/maintenance/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.MAINTENANCE), updateMaintenanceTicket);

// Contact Messages
router.get("/contact-messages", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getContactMessages);
router.patch("/contact-messages/:id/status", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), updateContactStatus);
router.delete("/contact-messages/:id", protect, authorize(UserRole.ADMIN), deleteContactMessage);

// Reviews (moderation)
router.get("/reviews", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getAllReviews);
router.patch("/reviews/:id/status", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), moderateReview);

// Room Categories
router.get("/room-categories", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getAllCategories);
router.get("/room-categories/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getCategoryById);
router.post("/room-categories", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), createCategory);
router.patch("/room-categories/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), updateCategory);
router.delete("/room-categories/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), deleteCategory);

// Pricing Rules
router.get("/pricing", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), getPricingRules);
router.post("/pricing", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), createPricingRule);
router.patch("/pricing/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), updatePricingRule);
router.delete("/pricing/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), deletePricingRule);

export default router;

