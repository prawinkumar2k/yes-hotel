import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
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
import { getBookingEnquiries, updateBookingEnquiryStatus, deleteBookingEnquiry } from "../controllers/bookingEnquiry.controller";
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

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST];

// Stats
router.get("/stats", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAdminStats);
router.get("/reports/overview", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getReportsOverview);

// Bookings
router.get("/bookings", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAdminBookings);
router.get("/bookings/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAdminBookingById);
router.patch("/bookings/:id/status", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateBookingStatus);
router.get("/calendar", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAdminCalendar);

// Housekeeping — MAINTENANCE staff also need visibility (a room they're
// servicing may be mid-clean), matching the admin sidebar's nav.roles for
// this page, which already includes MAINTENANCE.
router.get("/housekeeping", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getHousekeepingTasks);
router.patch("/housekeeping/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateHousekeepingTask);

// Maintenance — HOUSEKEEPING staff routinely discover and report issues
// while cleaning (a standard hotel workflow), so they can both view and
// create tickets, matching the admin sidebar's nav.roles for this page,
// which already includes HOUSEKEEPING.
router.get("/maintenance", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getMaintenanceTickets);
router.post("/maintenance", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "CREATE"), createMaintenanceTicket);
router.patch("/maintenance/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateMaintenanceTicket);

// Contact Messages
router.get("/contact-messages", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getContactMessages);
router.patch("/contact-messages/:id/status", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateContactStatus);
router.delete("/contact-messages/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "DELETE"), deleteContactMessage);

// Booking Enquiries (chatbot-collected leads)
router.get("/booking-enquiries", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getBookingEnquiries);
router.patch("/booking-enquiries/:id/status", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateBookingEnquiryStatus);
router.delete("/booking-enquiries/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "DELETE"), deleteBookingEnquiry);

// Reviews (moderation)
router.get("/reviews", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAllReviews);
router.patch("/reviews/:id/status", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), moderateReview);

// Room Categories
router.get("/room-categories", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAllCategories);
router.get("/room-categories/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getCategoryById);
router.post("/room-categories", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "CREATE"), createCategory);
router.patch("/room-categories/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateCategory);
router.delete("/room-categories/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "DELETE"), deleteCategory);

// Pricing Rules
router.get("/pricing", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getPricingRules);
router.post("/pricing", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "CREATE"), createPricingRule);
router.patch("/pricing/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updatePricingRule);
router.delete("/pricing/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "DELETE"), deletePricingRule);

export default router;

