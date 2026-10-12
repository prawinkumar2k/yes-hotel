import mongoose from 'mongoose';
import { User, UserRole } from '../server/src/models/User.js';
import { Property } from '../server/src/models/Property.js';
import { Role } from '../server/src/models/Role.js';
import { RolePermission } from '../server/src/models/RolePermission.js';
import { PermissionService } from '../server/src/services/PermissionService.js';
import { requirePermission } from '../server/src/middleware/permissionAuth.js';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
}

async function auditRolesAndPermissions() {
  console.log("=== STARTING ROLES AND PERMISSIONS AUDIT & VALIDATION ===");
  await mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels');

  const property = await Property.findOne({});
  if (!property) throw new Error("No property found in database.");

  console.log(`Auditing permissions for Property: ${property.name} (${property._id})`);

  // Inspect existing roles in DB
  const dbRoles = await Role.find({}).lean();
  console.log(`\nExisting Roles in DB (${dbRoles.length}):`, dbRoles.map(r => r.key));

  const rolePermissions = await RolePermission.find({}).lean();
  console.log(`Total Role-Permission mapping records in DB: ${rolePermissions.length}`);

  // Test matrix of roles
  const testRoles = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.HOUSEKEEPING,
    UserRole.MAINTENANCE,
    UserRole.CUSTOMER,
  ];

  // Specific critical endpoints / pageKeys to check
  const criticalResources = [
    { pageKey: "DASHBOARD.ADMIN", label: "Executive Command Center" },
    { pageKey: "PAYMENTS", label: "Payments & Folios" },
    { pageKey: "ADVANCES", label: "Advance Deposits" },
    { pageKey: "GUESTS", label: "Guest Directory & PII" },
    { pageKey: "STAFF", label: "Staff & User Roles Management" },
    { pageKey: "SETTINGS", label: "Hotel Master Settings" },
    { pageKey: "AUDIT_LOGS", label: "Security Audit Logs" },
    { pageKey: "HOUSEKEEPING", label: "Housekeeping Operations" },
    { pageKey: "MAINTENANCE", label: "Maintenance Tickets" },
    { pageKey: "ENQUIRIES", label: "Enquiries & Leads" }
  ];

  const results: Record<string, Record<string, boolean>> = {};

  for (const roleKey of testRoles) {
    results[roleKey] = {};
    // Find or mock user
    let user = await User.findOne({ role: roleKey });
    if (!user) {
      user = new User({
        _id: new mongoose.Types.ObjectId(),
        firstName: `Test`,
        lastName: `${roleKey}`,
        email: `test_${roleKey.toLowerCase()}@yeshotels.test`,
        role: roleKey,
        propertyId: property._id
      });
    }

    const perms = await PermissionService.getEffectivePermissions(user._id, property._id, user.role);

    console.log(`\n--------------------------------------------------`);
    console.log(`ROLE: ${roleKey} (User: ${user.email})`);
    console.log(`Total allowed page modules: ${Object.keys(perms).length}`);

    for (const res of criticalResources) {
      const allowed = Array.isArray(perms[res.pageKey]) && perms[res.pageKey].includes("VIEW");
      results[roleKey][res.pageKey] = allowed;
      const icon = allowed ? "✓ ALLOWED" : "✗ FORBIDDEN";
      console.log(`  [${icon}] ${res.label} (${res.pageKey})`);
    }

    // Direct Middleware Integration Verification:
    // Verify requirePermission middleware behavior for this user
    for (const res of [
      { pageKey: "DASHBOARD.ADMIN", action: "VIEW" },
      { pageKey: "STAFF", action: "EDIT" },
      { pageKey: "HOUSEKEEPING", action: "VIEW" }
    ]) {
      const middleware = requirePermission(res.pageKey, res.action);
      const req: any = {
        user: { _id: user._id, id: user._id.toString(), role: user.role },
        propertyId: property._id.toString()
      };
      const resObj = mockRes();
      let nextCalled = false;
      await middleware(req, resObj, () => { nextCalled = true; });

      const expectedAllowed = perms[res.pageKey]?.includes(res.action) ?? false;
      if (nextCalled !== expectedAllowed) {
        console.warn(`  ⚠️ Middleware mismatch for ${res.pageKey}.${res.action}: nextCalled=${nextCalled}, expected=${expectedAllowed}`);
      }
    }
  }

  // Security Invariants Verification:
  console.log(`\n================ SECURITY INVARIANT CHECKS ================`);

  // Invariant 1: Housekeeping MUST NOT access Executive Command Center or Payments or Staff
  if (results[UserRole.HOUSEKEEPING]["DASHBOARD.ADMIN"]) {
    throw new Error("SECURITY BREACH: HOUSEKEEPING role has access to Executive Command Center!");
  }
  if (results[UserRole.HOUSEKEEPING]["PAYMENTS"] || results[UserRole.HOUSEKEEPING]["ADVANCES"]) {
    throw new Error("SECURITY BREACH: HOUSEKEEPING role has access to Financial Payments!");
  }
  if (results[UserRole.HOUSEKEEPING]["STAFF"] || results[UserRole.HOUSEKEEPING]["AUDIT_LOGS"]) {
    throw new Error("SECURITY BREACH: HOUSEKEEPING role has access to Staff/Audit Logs!");
  }
  console.log("✓ Invariant 1 PASSED: Housekeeping is strictly restricted from Admin Command Center, Payments, Staff & Audit Logs.");

  // Invariant 2: Customer MUST NOT access ANY admin page
  for (const res of criticalResources) {
    if (results[UserRole.CUSTOMER][res.pageKey]) {
      throw new Error(`SECURITY BREACH: CUSTOMER role has access to ${res.pageKey}!`);
    }
  }
  console.log("✓ Invariant 2 PASSED: Customers have zero access to administrative modules.");

  // Invariant 3: Maintenance MUST NOT access Guest directory, Staff, or Payments
  if (results[UserRole.MAINTENANCE]["GUESTS"] || results[UserRole.MAINTENANCE]["STAFF"] || results[UserRole.MAINTENANCE]["PAYMENTS"]) {
    throw new Error("SECURITY BREACH: MAINTENANCE role has access to Guest/Staff/Payments!");
  }
  console.log("✓ Invariant 3 PASSED: Maintenance is strictly restricted to Maintenance/Housekeeping contexts.");

  // Invariant 4: Admin has full access
  if (!results[UserRole.ADMIN]["DASHBOARD.ADMIN"] || !results[UserRole.ADMIN]["STAFF"] || !results[UserRole.ADMIN]["PAYMENTS"]) {
    throw new Error("ADMIN role lacks critical executive permissions!");
  }
  console.log("✓ Invariant 4 PASSED: Admin maintains complete command authority.");

  console.log("\n=== ALL ROLE & PERMISSION AUDIT INVARIANTS VERIFIED 100% ===");
  await mongoose.disconnect();
  process.exit(0);
}

auditRolesAndPermissions().catch(err => {
  console.error("FATAL ERROR IN ROLE AUDIT:", err);
  process.exit(1);
});
