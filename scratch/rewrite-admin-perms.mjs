import fs from "fs";

const path = "server/src/routes/admin.routes.ts";
let content = fs.readFileSync(path, "utf-8");

// Bookings
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getAdminBookings/g, 'requirePermission("BOOKINGS", "VIEW"), getAdminBookings');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getAdminBookingById/g, 'requirePermission("BOOKINGS", "VIEW"), getAdminBookingById');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "EDIT"\), updateBookingStatus/g, 'requirePermission("BOOKINGS", "UPDATE"), updateBookingStatus');

// Calendar
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getAdminCalendar/g, 'requirePermission("CALENDAR", "VIEW"), getAdminCalendar');

// Contact Messages (Complaints)
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getContactMessages/g, 'requirePermission("COMPLAINTS", "VIEW"), getContactMessages');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "EDIT"\), updateContactStatus/g, 'requirePermission("COMPLAINTS", "UPDATE"), updateContactStatus');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "DELETE"\), deleteContactMessage/g, 'requirePermission("COMPLAINTS", "DELETE"), deleteContactMessage');

// Booking Enquiries
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getBookingEnquiries/g, 'requirePermission("ENQUIRIES", "VIEW"), getBookingEnquiries');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "EDIT"\), updateBookingEnquiryStatus/g, 'requirePermission("ENQUIRIES", "UPDATE"), updateBookingEnquiryStatus');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "DELETE"\), deleteBookingEnquiry/g, 'requirePermission("ENQUIRIES", "DELETE"), deleteBookingEnquiry');

// Reviews
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getAllReviews/g, 'requirePermission("COMPLAINTS", "VIEW"), getAllReviews');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "EDIT"\), moderateReview/g, 'requirePermission("COMPLAINTS", "UPDATE"), moderateReview');

// Room Categories
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getAllCategories/g, 'requirePermission("ROOM_CATEGORIES", "VIEW"), getAllCategories');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getCategoryById/g, 'requirePermission("ROOM_CATEGORIES", "VIEW"), getCategoryById');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "CREATE"\), createCategory/g, 'requirePermission("ROOM_CATEGORIES", "CREATE"), createCategory');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "EDIT"\), updateCategory/g, 'requirePermission("ROOM_CATEGORIES", "UPDATE"), updateCategory');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "DELETE"\), deleteCategory/g, 'requirePermission("ROOM_CATEGORIES", "DELETE"), deleteCategory');

// Pricing Rules
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "VIEW"\), getPricingRules/g, 'requirePermission("ROOM_CATEGORIES", "VIEW"), getPricingRules');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "CREATE"\), createPricingRule/g, 'requirePermission("ROOM_CATEGORIES", "CREATE"), createPricingRule');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "EDIT"\), updatePricingRule/g, 'requirePermission("ROOM_CATEGORIES", "UPDATE"), updatePricingRule');
content = content.replace(/requirePermission\("DASHBOARD.ADMIN", "DELETE"\), deletePricingRule/g, 'requirePermission("ROOM_CATEGORIES", "DELETE"), deletePricingRule');

fs.writeFileSync(path, content);
console.log("Rewritten admin.routes.ts");
