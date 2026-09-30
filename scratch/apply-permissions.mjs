import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'server', 'src', 'routes');

const mapping = {
  'accounting.routes.ts': 'ACCOUNTING',
  'admin.routes.ts': 'DASHBOARD.ADMIN',
  'advance.routes.ts': 'ADVANCES',
  'ancillary.routes.ts': 'FRONT_DESK',
  'auditLog.routes.ts': 'AUDIT_LOGS',
  'banquet.routes.ts': 'BANQUETS',
  'booking.routes.ts': 'BOOKINGS',
  'cashier-shift.routes.ts': 'CASHIER_SHIFTS',
  'command-center.routes.ts': 'DASHBOARD.ADMIN',
  'complaint.routes.ts': 'COMPLAINTS',
  'corporate-account.routes.ts': 'CORPORATE_ACCOUNTS',
  'coupon.routes.ts': 'COUPONS',
  'folio.routes.ts': 'CASHIER_SHIFTS',
  'front-desk.routes.ts': 'FRONT_DESK',
  'group-booking.routes.ts': 'GROUP_BOOKINGS',
  'guest.routes.ts': 'GUESTS',
  'housekeeping.routes.ts': 'HOUSEKEEPING',
  'inspection.routes.ts': 'HOUSEKEEPING',
  'inventory.routes.ts': 'INVENTORY',
  'menu.routes.ts': 'MENU_MANAGEMENT',
  'night-audit.routes.ts': 'NIGHT_AUDIT',
  'payment-channel.routes.ts': 'PAYMENT_CHANNELS',
  'payment.routes.ts': 'PAYMENTS',
  'pos.routes.ts': 'RESTAURANT_POS',
  'procurement.routes.ts': 'PROCUREMENT',
  'property.routes.ts': 'MULTI_PROPERTY',
  'rate-plan.routes.ts': 'RATE_PLANS',
  'refund.routes.ts': 'REFUNDS',
  'reports.routes.ts': 'REPORTS_LAYOUT',
  'review.routes.ts': 'REVIEWS',
  'room-rack.routes.ts': 'ROOM_RACK',
  'room.routes.ts': 'ROOMS',
  'settings.routes.ts': 'SETTINGS',
  'staff.routes.ts': 'STAFF',
  'task-approval.routes.ts': 'TASK_APPROVALS',
  'vendor.routes.ts': 'VENDORS',
  'walk-in-registration.routes.ts': 'GUEST_REGISTRATION'
};

const getAction = (method, endpoint) => {
  if (method === 'get') return 'VIEW';
  if (method === 'post') return 'CREATE';
  if (method === 'patch' || method === 'put') return 'EDIT';
  if (method === 'delete') return 'DELETE';
  return 'VIEW';
};

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.ts'));

for (const file of files) {
  if (!mapping[file]) continue;
  const pageKey = mapping[file];
  
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('requirePermission')) continue; // Already processed
  
  // Add imports
  let importsAdded = false;
  const importLines = [
    `import { requirePropertyAccess } from "../middleware/propertyAuth";`,
    `import { requirePermission } from "../middleware/permissionAuth";`
  ].join('\n');
  
  content = content.replace(/import \{ Router \}[^\n]*\n/, match => `${match}${importLines}\n`);

  // Replace authorize(...) with requirePropertyAccess, requirePermission
  const regex = /router\.(get|post|put|patch|delete)\(\s*(['"`][^'"`]+['"`])\s*,\s*protect\s*,\s*authorize\([^)]+\)\s*,\s*([^\)]+)\)/g;
  
  content = content.replace(regex, (match, method, endpoint, handler) => {
    const action = getAction(method, endpoint);
    // Determine if propertyScoped is true. Most are, except STAFF, SETTINGS, AUDIT_LOGS, etc.
    const isSystemScoped = ['STAFF', 'SETTINGS', 'AUDIT_LOGS', 'MULTI_PROPERTY', 'PAYMENT_CHANNELS'].includes(pageKey);
    const middlewares = ['protect'];
    
    if (!isSystemScoped) {
      middlewares.push('requirePropertyAccess');
    }
    
    middlewares.push(`requirePermission("${pageKey}", "${action}")`);
    
    return `router.${method}(${endpoint}, ${middlewares.join(', ')}, ${handler})`;
  });
  
  // Also replace cases where protect is not immediately followed by authorize
  const regex2 = /router\.(get|post|put|patch|delete)\(\s*(['"`][^'"`]+['"`])\s*,\s*authorize\([^)]+\)\s*,\s*([^\)]+)\)/g;
  content = content.replace(regex2, (match, method, endpoint, handler) => {
    const action = getAction(method, endpoint);
    const isSystemScoped = ['STAFF', 'SETTINGS', 'AUDIT_LOGS', 'MULTI_PROPERTY', 'PAYMENT_CHANNELS'].includes(pageKey);
    const middlewares = [];
    
    if (!isSystemScoped) middlewares.push('requirePropertyAccess');
    middlewares.push(`requirePermission("${pageKey}", "${action}")`);
    
    return `router.${method}(${endpoint}, ${middlewares.join(', ')}, ${handler})`;
  });

  fs.writeFileSync(filePath, content);
}

console.log("Refactoring complete");
