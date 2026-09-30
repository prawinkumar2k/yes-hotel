import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27027/yes_hotels';

const pageRegistry = [
  // DASHBOARDS
  { key: 'DASHBOARD.ADMIN', name: 'Admin Dashboard', module: 'DASHBOARDS', route: '/admin/dashboard', actions: ['VIEW'] },
  { key: 'DASHBOARD.EXECUTIVE', name: 'Executive Dashboard', module: 'DASHBOARDS', route: '/admin/executive', actions: ['VIEW'] },
  { key: 'DASHBOARD.FRONT_DESK', name: 'Front Desk Dashboard', module: 'DASHBOARDS', route: '/front-desk/dashboard', actions: ['VIEW'] },
  { key: 'DASHBOARD.HOUSEKEEPING', name: 'Housekeeping Dashboard', module: 'DASHBOARDS', route: '/housekeeping/dashboard', actions: ['VIEW'] },
  { key: 'DASHBOARD.MAINTENANCE', name: 'Maintenance Dashboard', module: 'DASHBOARDS', route: '/maintenance/dashboard', actions: ['VIEW'] },
  { key: 'DASHBOARD.CASHIER', name: 'Cashier Dashboard', module: 'DASHBOARDS', route: '/cashier/dashboard', actions: ['VIEW'] },
  { key: 'DASHBOARD.RESTAURANT', name: 'Restaurant Dashboard', module: 'DASHBOARDS', route: '/restaurant/dashboard', actions: ['VIEW'] },
  { key: 'DASHBOARD.FINANCE', name: 'Finance Dashboard', module: 'DASHBOARDS', route: '/finance/dashboard', actions: ['VIEW'] },

  // FRONT OFFICE
  { key: 'FRONT_DESK', name: 'Front Desk', module: 'FRONT_OFFICE', route: '/admin/front-desk', actions: ['VIEW', 'EDIT'] },
  { key: 'GUEST_REGISTRATION', name: 'Guest Registration', module: 'FRONT_OFFICE', route: '/admin/guest-registration', actions: ['VIEW', 'CREATE', 'EDIT', 'PRINT'] },
  { key: 'ROOM_RACK', name: 'Room Rack', module: 'FRONT_OFFICE', route: '/admin/room-rack', actions: ['VIEW'] },
  { key: 'BOOKINGS', name: 'Bookings', module: 'FRONT_OFFICE', route: '/admin/bookings', actions: ['VIEW', 'CREATE', 'EDIT', 'CANCEL', 'PRINT', 'EXPORT'] },
  { key: 'CHECK_IN', name: 'Check-In', module: 'FRONT_OFFICE', route: '/admin/check-in', actions: ['VIEW', 'CHECK_IN'] },
  { key: 'CHECK_OUT', name: 'Check-Out', module: 'FRONT_OFFICE', route: '/admin/check-out', actions: ['VIEW', 'CHECK_OUT'] },
  { key: 'IN_HOUSE_GUESTS', name: 'In-House Guests', module: 'FRONT_OFFICE', route: '/admin/in-house-list', actions: ['VIEW', 'PRINT', 'EXPORT'] },
  { key: 'GUESTS', name: 'Guests', module: 'FRONT_OFFICE', route: '/admin/guests', actions: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'] },
  { key: 'CALENDAR', name: 'Calendar', module: 'FRONT_OFFICE', route: '/admin/calendar', actions: ['VIEW'] },
  { key: 'ENQUIRIES', name: 'Enquiries', module: 'FRONT_OFFICE', route: '/admin/enquiries', actions: ['VIEW', 'CREATE', 'EDIT'] },

  // ROOM MANAGEMENT
  { key: 'ROOMS', name: 'Rooms', module: 'ROOM_MANAGEMENT', route: '/admin/rooms', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { key: 'ROOM_CATEGORIES', name: 'Room Categories', module: 'ROOM_MANAGEMENT', route: '/admin/room-categories', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { key: 'HOUSEKEEPING', name: 'Housekeeping', module: 'ROOM_MANAGEMENT', route: '/admin/housekeeping', actions: ['VIEW', 'ASSIGN', 'UPDATE', 'INSPECT'] },
  { key: 'MAINTENANCE', name: 'Maintenance', module: 'ROOM_MANAGEMENT', route: '/admin/maintenance', actions: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN', 'RESOLVE', 'CLOSE'] },

  // FINANCE & BILLING
  { key: 'PAYMENTS', name: 'Payments', module: 'FINANCE', route: '/admin/payments', actions: ['VIEW', 'CREATE', 'REFUND', 'PRINT', 'EXPORT'] },
  { key: 'ADVANCES', name: 'Advances', module: 'FINANCE', route: '/admin/advances', actions: ['VIEW', 'CREATE', 'REFUND', 'ADJUST', 'PRINT', 'EXPORT'] },
  { key: 'REFUNDS', name: 'Refunds', module: 'FINANCE', route: '/admin/refunds', actions: ['VIEW', 'CREATE', 'APPROVE', 'PRINT', 'EXPORT'] },
  { key: 'CASHIER_SHIFTS', name: 'Cashier Shifts', module: 'FINANCE', route: '/admin/cashier-shifts', actions: ['VIEW', 'OPEN_SHIFT', 'CLOSE_SHIFT', 'RECONCILE', 'EXPORT'] },
  { key: 'NIGHT_AUDIT', name: 'Night Audit', module: 'FINANCE', route: '/admin/night-audit', actions: ['VIEW', 'EXECUTE', 'PRINT', 'EXPORT'] },
  { key: 'ACCOUNTING', name: 'Accounting', module: 'FINANCE', route: '/admin/accounting', actions: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'] },

  // SYSTEM ADMINISTRATION
  { key: 'STAFF', name: 'Staff Profiles', module: 'ADMINISTRATION', route: '/admin/staff', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { key: 'USERS', name: 'User Management', module: 'ADMINISTRATION', route: '/admin/users', actions: ['VIEW', 'CREATE', 'EDIT', 'DISABLE'] },
  { key: 'ROLES', name: 'Role Management', module: 'ADMINISTRATION', route: '/admin/roles', actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'PERMISSIONS', name: 'Access Matrix', module: 'ADMINISTRATION', route: '/admin/permissions', actions: ['VIEW', 'EDIT'] },
  { key: 'PROPERTIES', name: 'Property Management', module: 'ADMINISTRATION', route: '/admin/multi-property', actions: ['VIEW', 'CREATE', 'EDIT'] },
  { key: 'SETTINGS', name: 'Settings', module: 'ADMINISTRATION', route: '/admin/settings', actions: ['VIEW', 'EDIT'] },
  { key: 'AUDIT_LOGS', name: 'Audit Logs', module: 'ADMINISTRATION', route: '/admin/audit-logs', actions: ['VIEW', 'EXPORT'] }
];

const roles = [
  { name: 'Super Admin', key: 'SUPER_ADMIN', isSystem: true, description: 'Unrestricted system access' },
  { name: 'Administrator', key: 'ADMIN', isSystem: true, description: 'General administration access' },
  { name: 'Manager', key: 'MANAGER', isSystem: true, description: 'Management operational visibility' },
  { name: 'Supervisor', key: 'SUPERVISOR', isSystem: true, description: 'Supervisor operations' },
  { name: 'Receptionist', key: 'RECEPTIONIST', isSystem: true, description: 'Front desk operations' },
  { name: 'Cashier', key: 'CASHIER', isSystem: true, description: 'Cash and payment handling' },
  { name: 'Housekeeping', key: 'HOUSEKEEPING', isSystem: true, description: 'Room cleaning and inspection' },
  { name: 'Maintenance', key: 'MAINTENANCE', isSystem: true, description: 'Maintenance ticketing' },
  { name: 'Restaurant', key: 'RESTAURANT', isSystem: true, description: 'POS and restaurant operations' },
  { name: 'Finance', key: 'FINANCE', isSystem: true, description: 'Financial reconciliation and reporting' },
  { name: 'Customer', key: 'CUSTOMER', isSystem: true, description: 'Customer portal access' }
];

const demoUsers = [
  { firstName: 'Super', lastName: 'Admin', email: 'superadmin@yeshotels.com', password: 'SuperAdmin@123', role: 'SUPER_ADMIN' },
  { firstName: 'System', lastName: 'Admin', email: 'admin@yeshotels.com', password: 'Admin@123', role: 'ADMIN' },
  { firstName: 'Hotel', lastName: 'Manager', email: 'manager@yeshotels.com', password: 'Manager@123', role: 'MANAGER' },
  { firstName: 'Floor', lastName: 'Supervisor', email: 'supervisor@yeshotels.com', password: 'Supervisor@123', role: 'SUPERVISOR' },
  { firstName: 'Front', lastName: 'Desk', email: 'reception@yeshotels.com', password: 'Reception@123', role: 'RECEPTIONIST' },
  { firstName: 'Shift', lastName: 'Cashier', email: 'cashier@yeshotels.com', password: 'Cashier@123', role: 'CASHIER' },
  { firstName: 'House', lastName: 'Keeping', email: 'housekeeping@yeshotels.com', password: 'House@123', role: 'HOUSEKEEPING' },
  { firstName: 'Chief', lastName: 'Maintenance', email: 'maintenance@yeshotels.com', password: 'Main@123', role: 'MAINTENANCE' },
  { firstName: 'Food', lastName: 'Service', email: 'restaurant@yeshotels.com', password: 'Restaurant@123', role: 'RESTAURANT' },
  { firstName: 'Finance', lastName: 'Officer', email: 'finance@yeshotels.com', password: 'Finance@123', role: 'FINANCE' },
  { firstName: 'Valued', lastName: 'Guest', email: 'customer@yeshotels.com', password: 'Customer@123', role: 'CUSTOMER' },
];

async function runSeed() {
  console.log('Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  console.log('Seeding PageResource...');
  const pageResourceCollection = db.collection('pageresources');
  for (const page of pageRegistry) {
    await pageResourceCollection.updateOne(
      { key: page.key },
      { $set: { ...page, isActive: true, isSystem: true, propertyScoped: true, updatedAt: new Date() },
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

  // helper to grant pages to role
  const grantPagesToRole = async (roleKey, pageKeys) => {
    const roleDoc = await roleCollection.findOne({ key: roleKey });
    if (!roleDoc) return;
    for (const pageKey of pageKeys) {
      const pageDef = pageRegistry.find(p => p.key === pageKey);
      if (pageDef) {
        await rolePermissionsCollection.updateOne(
          { roleId: roleDoc._id, pageKey: pageKey },
          { $set: { actions: pageDef.actions, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
      }
    }
  };

  // ADMIN
  await grantPagesToRole('ADMIN', [
    'DASHBOARD.ADMIN', 'DASHBOARD.EXECUTIVE', 'FRONT_DESK', 'GUEST_REGISTRATION', 'ROOM_RACK', 'BOOKINGS',
    'CHECK_IN', 'CHECK_OUT', 'IN_HOUSE_GUESTS', 'GUESTS', 'CALENDAR', 'ENQUIRIES',
    'ROOMS', 'ROOM_CATEGORIES', 'HOUSEKEEPING', 'MAINTENANCE', 'PAYMENTS', 'ADVANCES',
    'REFUNDS', 'CASHIER_SHIFTS', 'NIGHT_AUDIT', 'ACCOUNTING', 'STAFF', 'USERS',
    'ROLES', 'PERMISSIONS', 'PROPERTIES', 'SETTINGS', 'AUDIT_LOGS'
  ]);

  // MANAGER
  await grantPagesToRole('MANAGER', [
    'DASHBOARD.ADMIN', 'DASHBOARD.EXECUTIVE', 'FRONT_DESK', 'GUEST_REGISTRATION', 'ROOM_RACK', 'BOOKINGS',
    'CHECK_IN', 'CHECK_OUT', 'IN_HOUSE_GUESTS', 'GUESTS', 'CALENDAR', 'ENQUIRIES',
    'ROOMS', 'ROOM_CATEGORIES', 'HOUSEKEEPING', 'MAINTENANCE', 'PAYMENTS', 'ADVANCES',
    'REFUNDS', 'CASHIER_SHIFTS', 'NIGHT_AUDIT', 'ACCOUNTING', 'STAFF', 'USERS', 'SETTINGS'
  ]);

  // SUPERVISOR
  await grantPagesToRole('SUPERVISOR', [
    'DASHBOARD.ADMIN', 'DASHBOARD.EXECUTIVE', 'FRONT_DESK', 'GUEST_REGISTRATION', 'ROOM_RACK', 'BOOKINGS',
    'CHECK_IN', 'CHECK_OUT', 'IN_HOUSE_GUESTS', 'GUESTS', 'CALENDAR', 'ENQUIRIES',
    'ROOMS', 'ROOM_CATEGORIES', 'HOUSEKEEPING', 'MAINTENANCE'
  ]);

  // RECEPTIONIST
  await grantPagesToRole('RECEPTIONIST', [
    'DASHBOARD.FRONT_DESK', 'FRONT_DESK', 'GUEST_REGISTRATION', 'ROOM_RACK', 'BOOKINGS',
    'CHECK_IN', 'CHECK_OUT', 'IN_HOUSE_GUESTS', 'GUESTS', 'CALENDAR', 'ENQUIRIES'
  ]);

  // CASHIER
  await grantPagesToRole('CASHIER', [
    'DASHBOARD.CASHIER', 'PAYMENTS', 'ADVANCES', 'CASHIER_SHIFTS', 'REFUNDS'
  ]);

  // HOUSEKEEPING
  await grantPagesToRole('HOUSEKEEPING', [
    'DASHBOARD.HOUSEKEEPING', 'HOUSEKEEPING', 'ROOMS'
  ]);

  // MAINTENANCE
  await grantPagesToRole('MAINTENANCE', [
    'DASHBOARD.MAINTENANCE', 'MAINTENANCE'
  ]);

  // RESTAURANT
  await grantPagesToRole('RESTAURANT', [
    'DASHBOARD.RESTAURANT'
  ]);

  // FINANCE
  await grantPagesToRole('FINANCE', [
    'DASHBOARD.FINANCE', 'PAYMENTS', 'ADVANCES', 'REFUNDS', 'CASHIER_SHIFTS', 'NIGHT_AUDIT', 'ACCOUNTING'
  ]);

  console.log('Seeding Demo Users into DB...');
  const usersCollection = db.collection('users');
  for (const userDef of demoUsers) {
    const passwordHash = await bcrypt.hash(userDef.password, 10);
    await usersCollection.updateOne(
      { email: userDef.email },
      { 
        $set: { 
          firstName: userDef.firstName,
          lastName: userDef.lastName,
          name: `${userDef.firstName} ${userDef.lastName}`,
          role: userDef.role,
          passwordHash: passwordHash,
          isActive: true,
          status: 'ACTIVE',
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    console.log(`  User ${userDef.email} (${userDef.role}) ready.`);
  }

  console.log('RBAC & Demo Users Seeding Complete!');
  process.exit(0);
}

runSeed().catch(console.error);

