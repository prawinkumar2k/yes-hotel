import fs from 'fs';
import path from 'path';

const appFile = path.join(process.cwd(), 'client', 'App.tsx');
let content = fs.readFileSync(appFile, 'utf8');

const mapping = {
  '/admin/dashboard': 'DASHBOARD.ADMIN',
  '/admin/executive': 'DASHBOARD.EXECUTIVE',
  '/front-desk/dashboard': 'DASHBOARD.FRONT_DESK',
  '/housekeeping/dashboard': 'DASHBOARD.HOUSEKEEPING',
  '/maintenance/dashboard': 'DASHBOARD.MAINTENANCE',
  '/cashier/dashboard': 'DASHBOARD.CASHIER',
  '/restaurant/dashboard': 'DASHBOARD.RESTAURANT',
  '/finance/dashboard': 'DASHBOARD.FINANCE',
  
  '/admin/front-desk': 'FRONT_DESK',
  '/admin/guest-registration': 'GUEST_REGISTRATION',
  '/admin/room-rack': 'ROOM_RACK',
  '/admin/bookings': 'BOOKINGS',
  '/admin/bookings/:id': 'BOOKINGS',
  '/admin/check-in': 'CHECK_IN',
  '/admin/check-out': 'CHECK_OUT',
  '/admin/in-house-list': 'IN_HOUSE_GUESTS',
  '/admin/guests': 'GUESTS',
  '/admin/calendar': 'CALENDAR',
  '/admin/enquiries': 'ENQUIRIES',
  
  '/admin/rooms': 'ROOMS',
  '/admin/room-categories': 'ROOM_CATEGORIES',
  '/admin/housekeeping': 'HOUSEKEEPING',
  '/staff/mobile-housekeeping': 'HOUSEKEEPING',
  '/admin/maintenance': 'MAINTENANCE',
  
  '/admin/payments': 'PAYMENTS',
  '/admin/advances': 'ADVANCES',
  '/admin/refunds': 'REFUNDS',
  '/admin/cashier-shifts': 'CASHIER_SHIFTS',
  '/admin/night-audit': 'NIGHT_AUDIT',
  '/admin/accounting': 'ACCOUNTING',
  
  '/admin/rate-plans': 'RATE_PLANS',
  '/admin/pricing': 'PRICING',
  '/admin/coupons': 'COUPONS',
  
  '/admin/pos': 'RESTAURANT_POS',
  '/admin/menu': 'MENU_MANAGEMENT',
  
  '/admin/inventory': 'INVENTORY',
  '/admin/vendors': 'VENDORS',
  '/admin/procurement': 'PROCUREMENT',
  
  '/admin/corporate-accounts': 'CORPORATE_ACCOUNTS',
  '/admin/group-bookings': 'GROUP_BOOKINGS',
  '/admin/banquets': 'BANQUETS',
  '/events/dashboard': 'BANQUETS',
  
  '/admin/reports/*': 'REPORTS_LAYOUT',
  '/admin/day-sales-summary': 'DAY_SALES_SUMMARY',
  '/admin/monthly-mis': 'MONTHLY_MIS',
  
  '/admin/complaints': 'COMPLAINTS',
  '/admin/reviews': 'REVIEWS',
  '/admin/contact-messages': 'CONTACT_MESSAGES',
  
  '/admin/staff': 'STAFF',
  '/admin/multi-property': 'MULTI_PROPERTY',
  '/admin/task-approvals': 'TASK_APPROVALS',
  '/admin/settings': 'SETTINGS',
  '/admin/settings/payment-channels': 'PAYMENT_CHANNELS',
  '/admin/audit-logs': 'AUDIT_LOGS',
  '/admin/content': 'CONTENT_MANAGEMENT',
  '/admin/faqs': 'CONTENT_MANAGEMENT',
  '/admin/testimonials': 'CONTENT_MANAGEMENT',
  '/admin/gallery': 'CONTENT_MANAGEMENT',
  '/admin/ancillary': 'FRONT_DESK',
  '/inventory/dashboard': 'INVENTORY',
  '/procurement/dashboard': 'PROCUREMENT',
  '/staff/housekeeping': 'HOUSEKEEPING',
  '/staff/maintenance': 'MAINTENANCE'
};

const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{<ProtectedRoute\s+roles=\{[^}]+\}>(.*?)<\/ProtectedRoute>\}\s*\/>/g;

content = content.replace(routeRegex, (match, urlPath, innerComponent) => {
  const pageKey = mapping[urlPath];
  if (pageKey) {
    return `<Route path="${urlPath}" element={<PermissionRoute pageKey="${pageKey}">${innerComponent}</PermissionRoute>} />`;
  } else {
    // If no page key mapped, like CUSTOMER routes which aren't in page resource, leave them or map them.
    return match;
  }
});

// Import PermissionRoute if not already
if (!content.includes('PermissionRoute')) {
  content = content.replace(
    'import { ProtectedRoute }',
    'import { ProtectedRoute }\nimport { PermissionRoute } from "@/components/common/PermissionRoute";'
  );
}

fs.writeFileSync(appFile, content);
console.log("App.tsx refactoring complete");
