import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yes-hotels';

const pageRegistry = [
  // DASHBOARDS
  { key: 'DASHBOARD.ADMIN', name: 'Admin Dashboard', module: 'DASHBOARDS', route: '/admin/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.EXECUTIVE', name: 'Executive Dashboard', module: 'DASHBOARDS', route: '/admin/executive', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.FRONT_DESK', name: 'Front Desk Dashboard', module: 'DASHBOARDS', route: '/front-desk/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.HOUSEKEEPING', name: 'Housekeeping Dashboard', module: 'DASHBOARDS', route: '/housekeeping/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.MAINTENANCE', name: 'Maintenance Dashboard', module: 'DASHBOARDS', route: '/maintenance/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.CASHIER', name: 'Cashier Dashboard', module: 'DASHBOARDS', route: '/cashier/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.RESTAURANT', name: 'Restaurant Dashboard', module: 'DASHBOARDS', route: '/restaurant/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.FINANCE', name: 'Finance Dashboard', module: 'DASHBOARDS', route: '/finance/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.INVENTORY', name: 'Inventory Dashboard', module: 'DASHBOARDS', route: '/inventory/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.PROCUREMENT', name: 'Procurement Dashboard', module: 'DASHBOARDS', route: '/procurement/dashboard', propertyScoped: true, actions: ['VIEW'] },
  { key: 'DASHBOARD.EVENTS', name: 'Events Dashboard', module: 'DASHBOARDS', route: '/events/dashboard', propertyScoped: true, actions: ['VIEW'] },

  // FRONT OFFICE
  { key: 'FRONT_DESK', name: 'Front Desk', module: 'FRONT_OFFICE', route: '/admin/front-desk', propertyScoped: true, actions: ['VIEW', 'EDIT'] },
  { key: 'GUEST_REGISTRATION', name: 'Guest Registration', module: 'FRONT_OFFICE', route: '/admin/guest-registration', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'PRINT'] },
  { key: 'ROOM_RACK', name: 'Room Rack', module: 'FRONT_OFFICE', route: '/admin/room-rack', propertyScoped: true, actions: ['VIEW'] },
  { key: 'BOOKINGS', name: 'Bookings', module: 'FRONT_OFFICE', route: '/admin/bookings', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'CANCEL', 'PRINT', 'EXPORT'] },
  { key: 'CHECK_IN', name: 'Check-In', module: 'FRONT_OFFICE', route: '/admin/check-in', propertyScoped: true, actions: ['VIEW', 'CHECK_IN'] },
  { key: 'CHECK_OUT', name: 'Check-Out', module: 'FRONT_OFFICE', route: '/admin/check-out', propertyScoped: true, actions: ['VIEW', 'CHECK_OUT'] },
  { key: 'IN_HOUSE_GUESTS', name: 'In-House Guests', module: 'FRONT_OFFICE', route: '/admin/in-house-list', propertyScoped: true, actions: ['VIEW', 'PRINT', 'EXPORT'] },
  { key: 'GUESTS', name: 'Guests', module: 'FRONT_OFFICE', route: '/admin/guests', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'] },
  { key: 'CALENDAR', name: 'Calendar', module: 'FRONT_OFFICE', route: '/admin/calendar', propertyScoped: true, actions: ['VIEW'] },
  { key: 'ENQUIRIES', name: 'Enquiries', module: 'FRONT_OFFICE', route: '/admin/enquiries', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },

  // ROOM MANAGEMENT
  { key: 'ROOMS', name: 'Rooms', module: 'ROOM_MANAGEMENT', route: '/admin/rooms', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { key: 'ROOM_CATEGORIES', name: 'Room Categories', module: 'ROOM_MANAGEMENT', route: '/admin/room-categories', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { key: 'HOUSEKEEPING', name: 'Housekeeping', module: 'ROOM_MANAGEMENT', route: '/admin/housekeeping', propertyScoped: true, actions: ['VIEW', 'ASSIGN', 'UPDATE', 'INSPECT', 'RELEASE'] },
  { key: 'MAINTENANCE', name: 'Maintenance', module: 'ROOM_MANAGEMENT', route: '/admin/maintenance', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'RESOLVE', 'CLOSE'] },

  // FINANCE & BILLING
  { key: 'PAYMENTS', name: 'Payments', module: 'FINANCE', route: '/admin/payments', propertyScoped: true, actions: ['VIEW', 'CREATE', 'REFUND', 'PRINT', 'EXPORT'] },
  { key: 'ADVANCES', name: 'Advances', module: 'FINANCE', route: '/admin/advances', propertyScoped: true, actions: ['VIEW', 'CREATE', 'REFUND', 'ADJUST', 'PRINT', 'EXPORT'] },
  { key: 'REFUNDS', name: 'Refunds', module: 'FINANCE', route: '/admin/refunds', propertyScoped: true, actions: ['VIEW', 'CREATE', 'APPROVE', 'PRINT', 'EXPORT'] },
  { key: 'CASHIER_SHIFTS', name: 'Cashier Shifts', module: 'FINANCE', route: '/admin/cashier-shifts', propertyScoped: true, actions: ['VIEW', 'OPEN_SHIFT', 'CLOSE_SHIFT', 'RECONCILE', 'EXPORT'] },
  { key: 'NIGHT_AUDIT', name: 'Night Audit', module: 'FINANCE', route: '/admin/night-audit', propertyScoped: true, actions: ['VIEW', 'EXECUTE', 'PRINT', 'EXPORT'] },
  { key: 'ACCOUNTING', name: 'Accounting', module: 'FINANCE', route: '/admin/accounting', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'] },

  // REVENUE & PRICING
  { key: 'RATE_PLANS', name: 'Rate Plans', module: 'REVENUE', route: '/admin/rate-plans', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'PRICING', name: 'Pricing', module: 'REVENUE', route: '/admin/pricing', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'COUPONS', name: 'Coupons', module: 'REVENUE', route: '/admin/coupons', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },

  // RESTAURANT & POS
  { key: 'RESTAURANT_POS', name: 'Restaurant POS', module: 'RESTAURANT', route: '/admin/pos', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'ORDER', 'SERVE', 'PRINT'] },
  { key: 'MENU_MANAGEMENT', name: 'Menu Management', module: 'RESTAURANT', route: '/admin/menu', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },

  // INVENTORY & PROCUREMENT
  { key: 'INVENTORY', name: 'Inventory', module: 'INVENTORY', route: '/admin/inventory', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'] },
  { key: 'VENDORS', name: 'Vendors', module: 'INVENTORY', route: '/admin/vendors', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'PROCUREMENT', name: 'Procurement', module: 'INVENTORY', route: '/admin/procurement', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'] },

  // CORPORATE & EVENTS
  { key: 'CORPORATE_ACCOUNTS', name: 'Corporate Accounts', module: 'CORPORATE', route: '/admin/corporate-accounts', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'GROUP_BOOKINGS', name: 'Group Bookings', module: 'CORPORATE', route: '/admin/group-bookings', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'BANQUETS', name: 'Banquets', module: 'CORPORATE', route: '/admin/banquets', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'ANCILLARY', name: 'Ancillary Services', module: 'CORPORATE', route: '/admin/ancillary', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT'] },

  // REPORTS
  { key: 'REPORTS_LAYOUT', name: 'Reports', module: 'REPORTS', route: '/admin/reports/*', propertyScoped: true, actions: ['VIEW', 'EXPORT'] },
  { key: 'DAY_SALES_SUMMARY', name: 'Day Sales Summary', module: 'REPORTS', route: '/admin/day-sales-summary', propertyScoped: true, actions: ['VIEW', 'EXPORT', 'PRINT'] },
  { key: 'MONTHLY_MIS', name: 'Monthly MIS', module: 'REPORTS', route: '/admin/monthly-mis', propertyScoped: true, actions: ['VIEW', 'EXPORT'] },

  // CRM
  { key: 'COMPLAINTS', name: 'Complaints', module: 'CRM', route: '/admin/complaints', propertyScoped: true, actions: ['VIEW', 'CREATE', 'EDIT', 'RESOLVE'] },
  { key: 'REVIEWS', name: 'Reviews', module: 'CRM', route: '/admin/reviews', propertyScoped: true, actions: ['VIEW', 'EDIT'] },
  { key: 'CONTACT_MESSAGES', name: 'Contact Messages', module: 'CRM', route: '/admin/contact-messages', propertyScoped: true, actions: ['VIEW'] },

  // ADMINISTRATION
  { key: 'STAFF', name: 'Staff Profiles', module: 'ADMINISTRATION', route: '/admin/staff', propertyScoped: false, actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { key: 'USERS', name: 'User Management', module: 'ADMINISTRATION', route: '/admin/users', propertyScoped: false, actions: ['VIEW', 'CREATE', 'EDIT', 'DISABLE'] },
  { key: 'ROLES', name: 'Role Management', module: 'ADMINISTRATION', route: '/admin/roles', propertyScoped: false, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'PERMISSIONS', name: 'Access Matrix', module: 'ADMINISTRATION', route: '/admin/permissions', propertyScoped: false, actions: ['VIEW', 'EDIT'] },
  { key: 'PROPERTIES', name: 'Property Management', module: 'ADMINISTRATION', route: '/admin/multi-property', propertyScoped: false, actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'SETTINGS', name: 'Settings', module: 'ADMINISTRATION', route: '/admin/settings', propertyScoped: false, actions: ['VIEW', 'EDIT'] },
  { key: 'PAYMENT_CHANNELS', name: 'Payment Channels', module: 'ADMINISTRATION', route: '/admin/settings/payment-channels', propertyScoped: false, actions: ['VIEW', 'EDIT'] },
  { key: 'AUDIT_LOGS', name: 'Audit Logs', module: 'ADMINISTRATION', route: '/admin/audit-logs', propertyScoped: false, actions: ['VIEW', 'EXPORT'] },
  { key: 'CONTENT_MANAGEMENT', name: 'Content Management', module: 'ADMINISTRATION', route: '/admin/content', propertyScoped: false, actions: ['VIEW', 'EDIT'] }
];

const roles = [
  { name: 'Super Admin', key: 'SUPER_ADMIN', isSystem: true, description: 'Unrestricted system access' },
  { name: 'Administrator', key: 'ADMIN', isSystem: true, description: 'Configurable administrative access' },
  { name: 'Manager', key: 'MANAGER', isSystem: true, description: 'Management operational visibility' },
  { name: 'Receptionist', key: 'RECEPTIONIST', isSystem: true, description: 'Front desk operations' },
  { name: 'Cashier', key: 'CASHIER', isSystem: true, description: 'Cash and payment handling' },
  { name: 'Housekeeping', key: 'HOUSEKEEPING', isSystem: true, description: 'Room cleaning and inspection' },
  { name: 'Maintenance', key: 'MAINTENANCE', isSystem: true, description: 'Maintenance ticketing' },
  { name: 'Restaurant', key: 'RESTAURANT', isSystem: true, description: 'F&B POS and orders' },
  { name: 'Finance', key: 'FINANCE', isSystem: true, description: 'Financial reconciliation and reporting' },
  { name: 'Events', key: 'EVENTS', isSystem: true, description: 'Event and banquet management' },
  { name: 'Inventory', key: 'INVENTORY', isSystem: true, description: 'Stock and inventory' },
  { name: 'Procurement', key: 'PROCUREMENT', isSystem: true, description: 'Purchasing and vendors' },
  { name: 'Customer', key: 'CUSTOMER', isSystem: true, description: 'Customer portal access' }
];

const defaultRoleMatrices = {
  RECEPTIONIST: {
    DASHBOARD_FRONT_DESK: ['VIEW'],
    FRONT_DESK: ['VIEW', 'EDIT'],
    GUEST_REGISTRATION: ['VIEW', 'CREATE', 'EDIT', 'PRINT'],
    ROOM_RACK: ['VIEW'],
    BOOKINGS: ['VIEW', 'CREATE', 'EDIT', 'PRINT'],
    CHECK_IN: ['VIEW', 'CHECK_IN'],
    CHECK_OUT: ['VIEW', 'CHECK_OUT'],
    IN_HOUSE_GUESTS: ['VIEW', 'PRINT'],
    GUESTS: ['VIEW', 'CREATE', 'EDIT'],
    CALENDAR: ['VIEW'],
    ENQUIRIES: ['VIEW', 'CREATE', 'EDIT']
  },
  CASHIER: {
    DASHBOARD_CASHIER: ['VIEW'],
    PAYMENTS: ['VIEW', 'CREATE', 'PRINT', 'EXPORT'],
    ADVANCES: ['VIEW', 'CREATE', 'PRINT'],
    CASHIER_SHIFTS: ['VIEW', 'OPEN_SHIFT', 'CLOSE_SHIFT', 'EXPORT']
  },
  HOUSEKEEPING: {
    DASHBOARD_HOUSEKEEPING: ['VIEW'],
    HOUSEKEEPING: ['VIEW', 'ASSIGN', 'UPDATE', 'INSPECT', 'RELEASE'],
    ROOM_RACK: ['VIEW'],
    ROOMS: ['VIEW']
  },
  MAINTENANCE: {
    DASHBOARD_MAINTENANCE: ['VIEW'],
    MAINTENANCE: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'RESOLVE', 'CLOSE'],
    ROOMS: ['VIEW']
  },
  RESTAURANT: {
    DASHBOARD_RESTAURANT: ['VIEW'],
    RESTAURANT_POS: ['VIEW', 'CREATE', 'EDIT', 'ORDER', 'SERVE', 'PRINT'],
    MENU_MANAGEMENT: ['VIEW', 'CREATE', 'EDIT']
  },
  FINANCE: {
    DASHBOARD_FINANCE: ['VIEW'],
    PAYMENTS: ['VIEW', 'CREATE', 'REFUND', 'PRINT', 'EXPORT'],
    ADVANCES: ['VIEW', 'CREATE', 'REFUND', 'ADJUST', 'PRINT', 'EXPORT'],
    REFUNDS: ['VIEW', 'CREATE', 'APPROVE', 'PRINT', 'EXPORT'],
    CASHIER_SHIFTS: ['VIEW', 'OPEN_SHIFT', 'CLOSE_SHIFT', 'RECONCILE', 'EXPORT'],
    NIGHT_AUDIT: ['VIEW', 'EXECUTE', 'PRINT', 'EXPORT'],
    ACCOUNTING: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    DAY_SALES_SUMMARY: ['VIEW', 'EXPORT', 'PRINT'],
    MONTHLY_MIS: ['VIEW', 'EXPORT'],
    REPORTS_LAYOUT: ['VIEW']
  },
  INVENTORY: {
    DASHBOARD_INVENTORY: ['VIEW'],
    INVENTORY: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    VENDORS: ['VIEW', 'CREATE', 'EDIT'],
    PROCUREMENT: ['VIEW', 'CREATE', 'EDIT', 'APPROVE']
  },
  PROCUREMENT: {
    DASHBOARD_PROCUREMENT: ['VIEW'],
    VENDORS: ['VIEW', 'CREATE', 'EDIT'],
    PROCUREMENT: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
    INVENTORY: ['VIEW']
  },
  EVENTS: {
    DASHBOARD_EVENTS: ['VIEW'],
    BANQUETS: ['VIEW', 'CREATE', 'EDIT'],
    GROUP_BOOKINGS: ['VIEW', 'CREATE', 'EDIT']
  },
  MANAGER: {
    DASHBOARD_EXECUTIVE: ['VIEW'],
    DASHBOARD_ADMIN: ['VIEW'],
    FRONT_DESK: ['VIEW'],
    BOOKINGS: ['VIEW'],
    ROOM_RACK: ['VIEW'],
    IN_HOUSE_GUESTS: ['VIEW'],
    GUESTS: ['VIEW'],
    HOUSEKEEPING: ['VIEW'],
    MAINTENANCE: ['VIEW'],
    DAY_SALES_SUMMARY: ['VIEW'],
    MONTHLY_MIS: ['VIEW'],
    REPORTS_LAYOUT: ['VIEW']
  },
  ADMIN: {
    // Basic admin setup, SUPER_ADMIN delegates from here
    DASHBOARD_ADMIN: ['VIEW'],
    USERS: ['VIEW', 'CREATE', 'EDIT'],
    ROLES: ['VIEW'],
    PERMISSIONS: ['VIEW'],
    PROPERTIES: ['VIEW']
  }
};

async function runSeed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  console.log('Seeding PageResource...');
  const pageResourceCollection = db.collection('pageresources');
  for (const page of pageRegistry) {
    await pageResourceCollection.updateOne(
      { key: page.key },
      { $set: { ...page, isActive: true, isSystem: true, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  console.log('Seeding Roles...');
  const roleCollection = db.collection('roles');
  for (const role of roles) {
    await roleCollection.updateOne(
      { key: role.key },
      { $set: { ...role, isActive: true, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  console.log('Seeding Default Role Permissions...');
  const rolePermissionsCollection = db.collection('rolepermissions');

  for (const [roleKey, permissions] of Object.entries(defaultRoleMatrices)) {
    const roleDoc = await roleCollection.findOne({ key: roleKey });
    if (!roleDoc) continue;

    for (const [rawPageKey, actions] of Object.entries(permissions)) {
      // Restore dot for dashboard keys since JS object keys don't like dots easily without quotes
      const pageKey = rawPageKey.replace('_', '.').includes('DASHBOARD.') ? rawPageKey.replace('_', '.') : rawPageKey;
      
      const pageDef = pageRegistry.find(p => p.key === pageKey);
      if (pageDef) {
          await rolePermissionsCollection.updateOne(
              { roleId: roleDoc._id, pageKey: pageKey },
              { $set: { actions: actions, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
              { upsert: true }
          );
      }
    }
  }

  console.log('RBAC Seeding Complete Phase 2.');
  process.exit(0);
}

runSeed().catch(console.error);
