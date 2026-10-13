/**
 * The single permission map for the backend.
 *
 * Every protected route checks access with requirePermission(PAGE, ACTION)
 * (middleware/permissionAuth.ts), and controller-level decisions use
 * PermissionService.can(user, PAGE, ACTION). Both resolve against this map.
 *
 * Resolution order (PermissionService.getEffectivePermissions):
 *   1. FULL_ACCESS_ROLES get every page/action.
 *   2. DEFAULT_ROLE_PERMISSIONS[role] below.
 *   3. rolepermissions rows with source "UI" (edits made in the Access Matrix)
 *      replace the action list for that role + page. Rows without that source
 *      are inert seed output.
 *   4. userpermissionoverrides allow/deny individual actions for one user.
 *
 * Page keys mirror client PermissionRoute pageKeys. Keys under "CAP." are
 * capabilities used by controller logic rather than whole pages.
 *
 * Change access here, then run `npx tsx scripts/audit/rbac-matrix.ts` (see
 * docs/rbac/) to see exactly which routes change for which roles.
 */
import { UserRole } from "../models/User";

export type RoleKey = `${UserRole}`;
export type PermissionMap = Partial<Record<string, string[]>>;

export const FULL_ACCESS_ROLES: RoleKey[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/** Every action name used anywhere; full-access roles are granted all of them. */
export const ALL_ACTIONS = [
  "VIEW", "CREATE", "EDIT", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT", "PRINT",
  "CANCEL", "CHECK_IN", "CHECK_OUT", "ASSIGN", "INSPECT", "RESOLVE", "CLOSE", "EXECUTE",
  "ADJUST", "REFUND", "DISABLE", "OPEN_SHIFT", "CLOSE_SHIFT", "RECONCILE",
  "POST_CHARGE", "VOID_LINE", "SETTLE", "VOID", "VIEW_STATUS", "ALLOW",
] as const;

// Every authenticated staff role (everything except CUSTOMER and the full-access roles).
const ALL_STAFF: RoleKey[] = [
  UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.RECEPTIONIST, UserRole.CASHIER,
  UserRole.HOUSEKEEPING, UserRole.MAINTENANCE, UserRole.RESTAURANT, UserRole.FINANCE,
  UserRole.EVENTS, UserRole.INVENTORY, UserRole.PROCUREMENT,
];

// Roles allowed to mutate folios, payments, advances, refunds and cashier shifts.
const MONEY_DESK: RoleKey[] = [UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER];

const FOLIO_MUTATE = ["POST_CHARGE", "VOID_LINE", "EDIT", "SETTLE"];
const SHIFT_MUTATE = ["OPEN_SHIFT", "CLOSE_SHIFT", "RECONCILE"];
const ADVANCE_MUTATE = ["CREATE", "ADJUST", "REFUND"];

const base: Record<RoleKey, PermissionMap> = {
  SUPER_ADMIN: {},
  ADMIN: {},
  CUSTOMER: {},
  MANAGER: {
    "ACCOUNTING": ["VIEW", "CREATE", "EDIT", "EXPORT"],
    "ADVANCES": ["VIEW", "CREATE", "REFUND", "ADJUST", "PRINT", "EXPORT"],
    "BOOKINGS": ["VIEW", "CREATE", "EDIT", "CANCEL", "PRINT", "EXPORT"],
    "CALENDAR": ["VIEW"],
    "CASHIER_SHIFTS": ["VIEW", "OPEN_SHIFT", "CLOSE_SHIFT", "RECONCILE", "EXPORT"],
    "CHECK_IN": ["VIEW", "CHECK_IN"],
    "CHECK_OUT": ["VIEW", "CHECK_OUT"],
    "DASHBOARD.ADMIN": ["VIEW"],
    "DASHBOARD.EXECUTIVE": ["VIEW"],
    "ENQUIRIES": ["VIEW", "CREATE", "EDIT"],
    "FRONT_DESK": ["VIEW", "EDIT"],
    "GUESTS": ["VIEW", "CREATE", "EDIT", "EXPORT"],
    "GUEST_REGISTRATION": ["VIEW", "CREATE", "EDIT", "PRINT"],
    "HOUSEKEEPING": ["VIEW", "ASSIGN", "UPDATE", "INSPECT"],
    "IN_HOUSE_GUESTS": ["VIEW", "PRINT", "EXPORT"],
    "MAINTENANCE": ["VIEW", "CREATE", "EDIT", "ASSIGN", "RESOLVE", "CLOSE"],
    "NIGHT_AUDIT": ["VIEW", "EXECUTE", "PRINT", "EXPORT"],
    "PAYMENTS": ["VIEW", "CREATE", "REFUND", "PRINT", "EXPORT"],
    "REFUNDS": ["VIEW", "CREATE", "APPROVE", "PRINT", "EXPORT"],
    "ROOMS": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "ROOM_CATEGORIES": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "ROOM_RACK": ["VIEW"],
    "SETTINGS": ["VIEW", "EDIT"],
    "STAFF": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "USERS": ["VIEW", "CREATE", "EDIT", "DISABLE"],
    // formerly authorize(ADMIN, MANAGER, ...) route groups
    "GALLERY": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "PAYMENT_CHANNELS": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "GROUP_BOOKINGS": ["VIEW", "CREATE", "EDIT"],
    "GUEST_COMPLAINTS": ["VIEW", "CREATE", "EDIT"],
    "FAQS": ["CREATE", "EDIT", "DELETE"],
    "TESTIMONIALS": ["CREATE", "EDIT", "DELETE"],
  },
  SUPERVISOR: {
    "BOOKINGS": ["VIEW", "CREATE", "EDIT", "CANCEL", "PRINT", "EXPORT"],
    "CALENDAR": ["VIEW"],
    "CHECK_IN": ["VIEW", "CHECK_IN"],
    "CHECK_OUT": ["VIEW", "CHECK_OUT"],
    "DASHBOARD.ADMIN": ["VIEW"],
    "DASHBOARD.EXECUTIVE": ["VIEW"],
    "ENQUIRIES": ["VIEW", "CREATE", "EDIT"],
    "FRONT_DESK": ["VIEW", "EDIT"],
    "GUESTS": ["VIEW", "CREATE", "EDIT", "EXPORT"],
    "GUEST_REGISTRATION": ["VIEW", "CREATE", "EDIT", "PRINT"],
    "HOUSEKEEPING": ["VIEW", "ASSIGN", "UPDATE", "INSPECT"],
    "IN_HOUSE_GUESTS": ["VIEW", "PRINT", "EXPORT"],
    "MAINTENANCE": ["VIEW", "CREATE", "EDIT", "ASSIGN", "RESOLVE", "CLOSE"],
    "ROOMS": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "ROOM_CATEGORIES": ["VIEW", "CREATE", "EDIT", "DELETE"],
    "ROOM_RACK": ["VIEW"],
  },
  RECEPTIONIST: {
    "BOOKINGS": ["VIEW", "CREATE", "EDIT", "CANCEL", "PRINT", "EXPORT"],
    "CALENDAR": ["VIEW"],
    "CHECK_IN": ["VIEW", "CHECK_IN"],
    "CHECK_OUT": ["VIEW", "CHECK_OUT"],
    "DASHBOARD.FRONT_DESK": ["VIEW"],
    "ENQUIRIES": ["VIEW", "CREATE", "EDIT"],
    "FRONT_DESK": ["VIEW", "EDIT"],
    "GUESTS": ["VIEW", "CREATE", "EDIT", "EXPORT"],
    "GUEST_REGISTRATION": ["VIEW", "CREATE", "EDIT", "PRINT"],
    "IN_HOUSE_GUESTS": ["VIEW", "PRINT", "EXPORT"],
    "ROOM_RACK": ["VIEW"],
    "GROUP_BOOKINGS": ["VIEW", "CREATE", "EDIT"],
    "GUEST_COMPLAINTS": ["VIEW", "CREATE", "EDIT"],
    // money-desk mutations (no read access to the ledgers was added)
    "ADVANCES": ADVANCE_MUTATE,
    "REFUNDS": ["CREATE"],
    "CASHIER_SHIFTS": SHIFT_MUTATE,
  },
  CASHIER: {
    "ADVANCES": ["VIEW", "CREATE", "REFUND", "ADJUST", "PRINT", "EXPORT"],
    "CASHIER_SHIFTS": ["VIEW", "OPEN_SHIFT", "CLOSE_SHIFT", "RECONCILE", "EXPORT"],
    "DASHBOARD.CASHIER": ["VIEW"],
    "PAYMENTS": ["VIEW", "CREATE", "REFUND", "PRINT", "EXPORT"],
    "REFUNDS": ["VIEW", "CREATE", "APPROVE", "PRINT", "EXPORT"],
  },
  HOUSEKEEPING: {
    "DASHBOARD.HOUSEKEEPING": ["VIEW"],
    "HOUSEKEEPING": ["VIEW", "ASSIGN", "UPDATE", "INSPECT"],
    "ROOMS": ["VIEW"], // N4: housekeepers view rooms; they cannot create, edit or delete them
    "GUEST_COMPLAINTS": ["VIEW", "CREATE", "EDIT"],
  },
  MAINTENANCE: {
    "DASHBOARD.MAINTENANCE": ["VIEW"],
    "MAINTENANCE": ["VIEW", "CREATE", "EDIT", "ASSIGN", "RESOLVE", "CLOSE"],
    "GUEST_COMPLAINTS": ["VIEW", "CREATE", "EDIT"],
  },
  RESTAURANT: {
    "DASHBOARD.RESTAURANT": ["VIEW"],
  },
  FINANCE: {
    "ACCOUNTING": ["VIEW", "CREATE", "EDIT", "EXPORT"],
    // read-only on the money desk: mutations are MONEY_DESK only
    "ADVANCES": ["VIEW", "PRINT", "EXPORT"],
    "CASHIER_SHIFTS": ["VIEW", "EXPORT"],
    "DASHBOARD.FINANCE": ["VIEW"],
    "NIGHT_AUDIT": ["VIEW", "EXECUTE", "PRINT", "EXPORT"],
    "PAYMENTS": ["VIEW", "PRINT", "EXPORT"],
    "REFUNDS": ["VIEW", "APPROVE", "PRINT", "EXPORT"],
  },
  EVENTS: {},
  INVENTORY: {},
  PROCUREMENT: {},
};

/** Grant `actions` on `page` to each role in `roles` (merging with what the role already has). */
function grant(map: Record<RoleKey, PermissionMap>, roles: RoleKey[], page: string, actions: readonly string[]) {
  for (const r of roles) {
    const current = map[r][page] ?? [];
    map[r][page] = [...new Set([...current, ...actions])];
  }
}

// Folios: staff read (unchanged from before), money desk mutates. Customers
// read their own booking's folio via requirePermissionOrBookingOwner.
grant(base, ALL_STAFF, "FOLIOS", ["VIEW"]);
grant(base, MONEY_DESK, "FOLIOS", FOLIO_MUTATE);

// Unified command-center endpoint (formerly authorize() with an explicit role list; SUPERVISOR was not on it).
grant(base, ALL_STAFF.filter((r) => r !== UserRole.SUPERVISOR), "DASHBOARD.COMMAND_CENTER", ["VIEW"]);

// Capabilities used inside controllers (formerly hardcoded role arrays).
grant(base, [UserRole.MANAGER, UserRole.RECEPTIONIST], "CAP.BOOKING_CANCEL_ANY", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.SUPERVISOR], "CAP.SHIFT_SUPERVISOR_OVERRIDE", ["ALLOW"]);
grant(base, [UserRole.MANAGER], "CAP.PAYMENT_CONFIRM_DEMO_ANY", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE, UserRole.CASHIER], "CAP.CC_FINANCE", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FINANCE], "CAP.CC_FRONT_OFFICE", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.FINANCE, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE], "CAP.CC_OPERATIONS", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.RESTAURANT, UserRole.FINANCE], "CAP.CC_RESTAURANT", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE, UserRole.RECEPTIONIST], "CAP.CC_CORPORATE", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE], "CAP.CC_FORECAST", ["ALLOW"]);
grant(base, [UserRole.MANAGER], "CAP.CC_APPROVALS", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE], "CAP.APPROVAL_TIER_EXECUTIVE", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE, UserRole.RECEPTIONIST, UserRole.SUPERVISOR], "CAP.APPROVAL_TIER_MANAGER", ["ALLOW"]);
// Approval floor by priority (task approvals and maintenance completion):
// CRITICAL needs MANAGER or higher; HIGH can be approved by SUPERVISOR or higher.
grant(base, [UserRole.MANAGER], "CAP.APPROVE_CRITICAL", ["ALLOW"]);
// Passing a housekeeping inspection (formerly a hardcoded MANAGER/ADMIN check).
grant(base, [UserRole.MANAGER], "CAP.HK_PASS_INSPECTION", ["ALLOW"]);
// Checking a guest into a room that is not CLEAN (reason required, audit-logged).
grant(base, [UserRole.MANAGER], "CAP.CHECKIN_UNCLEAN_OVERRIDE", ["ALLOW"]);
grant(base, [UserRole.MANAGER, UserRole.SUPERVISOR], "CAP.APPROVE_HIGH", ["ALLOW"]);

// ── N2: pages that had no grants, and the night-audit view ──────────────────
// Night audit: MANAGER and FINANCE run it (EXECUTE above); SUPERVISOR and RECEPTIONIST view status.
grant(base, [UserRole.SUPERVISOR, UserRole.RECEPTIONIST, UserRole.MANAGER, UserRole.FINANCE], "NIGHT_AUDIT", ["VIEW_STATUS"]);
// POS: RESTAURANT takes orders and runs the KOT/kitchen flow, CASHIER settles bills,
// MANAGER can also void (reason required, audit-logged).
grant(base, [UserRole.RESTAURANT], "RESTAURANT_POS", ["VIEW", "CREATE", "EDIT"]);
grant(base, [UserRole.CASHIER], "RESTAURANT_POS", ["VIEW", "SETTLE"]);
grant(base, [UserRole.MANAGER], "RESTAURANT_POS", ["VIEW", "CREATE", "EDIT", "SETTLE", "VOID"]);
// Menu: MANAGER maintains it; the POS roles read it (the POS screen lists menu items).
grant(base, [UserRole.MANAGER], "MENU_MANAGEMENT", ["VIEW", "CREATE", "EDIT", "DELETE"]);
grant(base, [UserRole.RESTAURANT, UserRole.CASHIER], "MENU_MANAGEMENT", ["VIEW"]);
grant(base, [UserRole.MANAGER], "COUPONS", ["VIEW", "CREATE", "EDIT", "DELETE"]);
grant(base, [UserRole.RECEPTIONIST], "COUPONS", ["VIEW"]);
grant(base, [UserRole.MANAGER], "BANQUETS", ["VIEW", "CREATE", "EDIT"]);
grant(base, [UserRole.RECEPTIONIST], "BANQUETS", ["VIEW"]);
grant(base, [UserRole.MANAGER], "RATE_PLANS", ["CREATE", "EDIT"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE], "CORPORATE_ACCOUNTS", ["VIEW", "CREATE", "EDIT"]);
grant(base, [UserRole.MANAGER, UserRole.FINANCE], "REPORTS_LAYOUT", ["VIEW"]);
grant(base, [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.RECEPTIONIST, UserRole.FINANCE], "TASK_APPROVALS", ["VIEW", "CREATE", "APPROVE", "REJECT"]);
// Audit logs, permissions/roles and multi-property (incl. GET /api/properties) stay full-access only.

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionMap> = base;

/** All page keys that appear in the map (full-access roles receive each of them). */
export const ALL_PAGE_KEYS: string[] = [
  ...new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flatMap((p) => Object.keys(p))),
];

export function isFullAccessRole(role: string | undefined): boolean {
  return !!role && (FULL_ACCESS_ROLES as string[]).includes(role);
}

/** Role hierarchy for account management. Higher number = more senior. */
export const ROLE_RANK: Record<RoleKey, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  MANAGER: 70,
  SUPERVISOR: 60,
  FINANCE: 50,
  RECEPTIONIST: 40,
  CASHIER: 40,
  RESTAURANT: 40,
  EVENTS: 40,
  INVENTORY: 40,
  PROCUREMENT: 40,
  HOUSEKEEPING: 30,
  MAINTENANCE: 30,
  CUSTOMER: 0,
};

const PROTECTED_ACCOUNT_ROLES = ["SUPER_ADMIN", "ADMIN"];

/**
 * Account-management guard. Returns a denial message, or null when allowed.
 * - Only SUPER_ADMIN may create, edit, disable, reset or re-role a SUPER_ADMIN or ADMIN account.
 * - Nobody may grant a role ranked above their own, or manage an account ranked above their own.
 */
export function accountChangeDenial(
  actorRole: string | undefined,
  change: { targetRole?: string; newRole?: string },
): string | null {
  const actorRank = ROLE_RANK[actorRole as RoleKey] ?? -1;
  const isSuper = actorRole === "SUPER_ADMIN";
  const { targetRole, newRole } = change;
  if (targetRole && PROTECTED_ACCOUNT_ROLES.includes(targetRole) && !isSuper) {
    return `Only a SUPER_ADMIN can manage ${targetRole} accounts`;
  }
  if (newRole && PROTECTED_ACCOUNT_ROLES.includes(newRole) && !isSuper) {
    return `Only a SUPER_ADMIN can assign the ${newRole} role`;
  }
  if (newRole && (ROLE_RANK[newRole as RoleKey] ?? Infinity) > actorRank) {
    return `You cannot assign a role higher than your own (${newRole})`;
  }
  if (targetRole && (ROLE_RANK[targetRole as RoleKey] ?? Infinity) > actorRank) {
    return `You cannot manage an account with a higher role (${targetRole})`;
  }
  return null;
}
