import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import {
  getAdminStats, getAdminBookings, getAdminBookingById, updateBookingStatus, getAdminCalendar
} from "../controllers/admin.controller";
import { getHousekeepingTasks, updateHousekeepingTask } from "../controllers/housekeeping.controller";
import {
  getMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket
} from "../controllers/maintenance.controller";
import { getContactMessages, updateContactStatus, deleteContactMessage } from "../controllers/contact.controller";
import { getBookingEnquiries, updateBookingEnquiryStatus, deleteBookingEnquiry, getBookingEnquiryById, createAdminEnquiry, updateBookingEnquiry, addFollowUp, convertEnquiryToBooking } from "../controllers/bookingEnquiry.controller";
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


// Stats
router.get("/stats", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getAdminStats);
router.get("/reports/overview", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getReportsOverview);

// Bookings
router.get("/bookings", protect, requirePropertyAccess, requirePermission("BOOKINGS", "VIEW"), getAdminBookings);
router.get("/bookings/:id", protect, requirePropertyAccess, requirePermission("BOOKINGS", "VIEW"), getAdminBookingById);
router.patch("/bookings/:id/status", protect, requirePropertyAccess, requirePermission("BOOKINGS", "EDIT"), updateBookingStatus);
router.get("/calendar", protect, requirePropertyAccess, requirePermission("CALENDAR", "VIEW"), getAdminCalendar);

// Housekeeping — MAINTENANCE staff also need visibility (a room they're
// servicing may be mid-clean), matching the admin sidebar's nav.roles for
// this page, which already includes MAINTENANCE.
router.get("/housekeeping", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "VIEW"), getHousekeepingTasks);
router.patch("/housekeeping/:id", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "ASSIGN"), updateHousekeepingTask);

// Maintenance — HOUSEKEEPING staff routinely discover and report issues
// while cleaning (a standard hotel workflow), so they can both view and
// create tickets, matching the admin sidebar's nav.roles for this page,
// which already includes HOUSEKEEPING.
router.get("/maintenance", protect, requirePropertyAccess, requirePermission("MAINTENANCE", "VIEW"), getMaintenanceTickets);
router.post("/maintenance", protect, requirePropertyAccess, requirePermission("MAINTENANCE", "CREATE"), createMaintenanceTicket);
router.patch("/maintenance/:id", protect, requirePropertyAccess, requirePermission("MAINTENANCE", "UPDATE"), updateMaintenanceTicket);

// Contact Messages
router.get("/contact-messages", protect, requirePropertyAccess, requirePermission("COMPLAINTS", "VIEW"), getContactMessages);
router.patch("/contact-messages/:id/status", protect, requirePropertyAccess, requirePermission("COMPLAINTS", "UPDATE"), updateContactStatus);
router.delete("/contact-messages/:id", protect, requirePropertyAccess, requirePermission("COMPLAINTS", "DELETE"), deleteContactMessage);

// Booking Enquiries (leads and workflow)
router.get("/booking-enquiries", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "VIEW"), getBookingEnquiries);
router.post("/booking-enquiries", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "CREATE"), createAdminEnquiry);
router.get("/booking-enquiries/:id", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "VIEW"), getBookingEnquiryById);
router.patch("/booking-enquiries/:id", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "EDIT"), updateBookingEnquiry);
router.patch("/booking-enquiries/:id/status", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "EDIT"), updateBookingEnquiryStatus);
router.post("/booking-enquiries/:id/follow-up", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "EDIT"), addFollowUp);
router.post("/booking-enquiries/:id/convert", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "EDIT"), convertEnquiryToBooking);
router.delete("/booking-enquiries/:id", protect, requirePropertyAccess, requirePermission("ENQUIRIES", "DELETE"), deleteBookingEnquiry);

// Reviews (moderation)
router.get("/reviews", protect, requirePropertyAccess, requirePermission("COMPLAINTS", "VIEW"), getAllReviews);
router.patch("/reviews/:id/status", protect, requirePropertyAccess, requirePermission("COMPLAINTS", "UPDATE"), moderateReview);

// Room Categories
router.get("/room-categories", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "VIEW"), getAllCategories);
router.get("/room-categories/:id", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "VIEW"), getCategoryById);
router.post("/room-categories", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "CREATE"), createCategory);
router.patch("/room-categories/:id", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "EDIT"), updateCategory);
router.delete("/room-categories/:id", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "DELETE"), deleteCategory);

// Pricing Rules
router.get("/pricing", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "VIEW"), getPricingRules);
router.post("/pricing", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "CREATE"), createPricingRule);
router.patch("/pricing/:id", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "EDIT"), updatePricingRule);
router.delete("/pricing/:id", protect, requirePropertyAccess, requirePermission("ROOM_CATEGORIES", "DELETE"), deletePricingRule);

// Master Data (Floors, Amenities, Bed Types, Room Views)
import {
  getFloors, createFloor, updateFloor, deleteFloor,
  getAmenities, createAmenity, updateAmenity, deleteAmenity,
  getBedTypes, createBedType, updateBedType, deleteBedType,
  getRoomViews, createRoomView, updateRoomView, deleteRoomView
} from "../controllers/master-data.controller";

// Master Data - Floors
router.get("/master-data/floors", protect, requirePropertyAccess, requirePermission("SETTINGS", "VIEW"), getFloors);
router.post("/master-data/floors", protect, requirePropertyAccess, requirePermission("SETTINGS", "CREATE"), createFloor);
router.patch("/master-data/floors/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "EDIT"), updateFloor);
router.delete("/master-data/floors/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "DELETE"), deleteFloor);

// Master Data - Amenities
router.get("/master-data/amenities", protect, requirePropertyAccess, requirePermission("SETTINGS", "VIEW"), getAmenities);
router.post("/master-data/amenities", protect, requirePropertyAccess, requirePermission("SETTINGS", "CREATE"), createAmenity);
router.patch("/master-data/amenities/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "EDIT"), updateAmenity);
router.delete("/master-data/amenities/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "DELETE"), deleteAmenity);

// Master Data - Bed Types
router.get("/master-data/bed-types", protect, requirePropertyAccess, requirePermission("SETTINGS", "VIEW"), getBedTypes);
router.post("/master-data/bed-types", protect, requirePropertyAccess, requirePermission("SETTINGS", "CREATE"), createBedType);
router.patch("/master-data/bed-types/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "EDIT"), updateBedType);
router.delete("/master-data/bed-types/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "DELETE"), deleteBedType);

// Master Data - Room Views
router.get("/master-data/room-views", protect, requirePropertyAccess, requirePermission("SETTINGS", "VIEW"), getRoomViews);
router.post("/master-data/room-views", protect, requirePropertyAccess, requirePermission("SETTINGS", "CREATE"), createRoomView);
router.patch("/master-data/room-views/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "EDIT"), updateRoomView);
router.delete("/master-data/room-views/:id", protect, requirePropertyAccess, requirePermission("SETTINGS", "DELETE"), deleteRoomView);

export default router;
