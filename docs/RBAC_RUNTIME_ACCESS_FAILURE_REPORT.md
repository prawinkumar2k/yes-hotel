# RBAC Runtime Access Failure Diagnostic & Fix Report

**Project:** YES HOTELS Booking Platform  
**Issue:** Runtime Access Denied (`Missing: DASHBOARD.ADMIN.VIEW`) for `admin@yeshotels.com`  
**Date:** September 30, 2026  
**Status:** RESOLVED & VERIFIED  

---

## 1. Initial Symptoms & Environment State

Upon logging into the platform with `admin@yeshotels.com`, the browser rendered an **ACCESS DENIED** error modal:

```
ACCESS DENIED
Missing: DASHBOARD.ADMIN.VIEW
```

### Analysis of Initial Context:
- **Logged-in user:** `admin@yeshotels.com`
- **Database role:** `ADMIN` (in authoritative MongoDB instance `mongodb://127.0.0.1:27027/yes_hotels`)
- **Frontend evaluation:** `PermissionContext` resolved `DASHBOARD.ADMIN.VIEW = DENIED`
- **Root issue:** Synchronization failure between JWT payload, backend permission resolution endpoint, role permission database seeding, and frontend route bootstrapping.

---

## 2. Root Cause Diagnostic

Through the 27-phase systematic diagnostic process, four distinct root causes were identified:

### Root Cause 1: Circular Permission Dependency on Permission Endpoint
- The backend route for fetching effective permissions:
  `GET /api/permissions/users/:userId/effective`
  was protected by the middleware `requirePermission("PERMISSIONS", "VIEW")`.
- When a newly logged-in user attempted to bootstrap their permission context, the backend demanded they *already* possess `PERMISSIONS.VIEW` authority before allowing them to query what permissions they had.
- This resulted in an HTTP `403 Forbidden` response during initial frontend auth bootstrapping.

### Root Cause 2: Unseeded RolePermissions for `ADMIN`
- The `RolePermission` database collection contained explicit seed entries for `RECEPTIONIST` and `CASHIER`, but zero records for the `ADMIN` role.
- While `SUPER_ADMIN` has an explicit code bypass in `PermissionService`, standard `ADMIN` relies strictly on database-driven `RolePermission` entries.
- Missing database records meant `ADMIN` evaluated to an empty permission set (`{}`).

### Root Cause 3: Forced Routing to `/admin/dashboard`
- `LoginPage.tsx` mapped all staff roles (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `CASHIER`, `FINANCE`, `HOUSEKEEPING`, `MAINTENANCE`, `RESTAURANT`) directly to `/admin/dashboard`.
- Specialized staff (e.g., Receptionist, Cashier, Maintenance) without `DASHBOARD.ADMIN.VIEW` were immediately routed to a page they lacked permission to view.

### Root Cause 4: Hardcoded Fake Property ID (`propertyId=default`)
- `PermissionContext.tsx` appended `?propertyId=default` to the permission endpoint URL when `currentPropertyId` was unset.
- "default" is not a valid MongoDB ObjectId. System-scoped queries and property-scoped checks failed due to invalid ObjectId parsing or non-existent property lookup.

---

## 3. Architecture & Resolution Applied

### Backend Fixes:
1. **`server/src/routes/permission.routes.ts`**:
   - Removed `requirePermission("PERMISSIONS", "VIEW")` from `GET /users/:userId/effective`.
   - Replaced it with standard `authenticate` middleware.
2. **`server/src/controllers/PermissionController.ts`**:
   - Added self-request validation: users can fetch their own effective permissions (`req.user.id === userId`), or `SUPER_ADMIN` can fetch any user's permissions.
   - Made `propertyId` optional in `getUserEffectivePermissions` so system-scoped permissions resolve properly without needing a property context.
3. **`scripts/seed-rbac.mjs`**:
   - Added complete `ADMIN` role permissions including `DASHBOARD.ADMIN` (`VIEW`, `EDIT`), `USERS`, `ROLES`, `PERMISSIONS`, `PROPERTIES`, `BOOKINGS`, `ROOMS`, `GUESTS`, `PAYMENTS`, `REPORTS`, and system modules.
   - Re-executed the seed script against `mongodb://127.0.0.1:27027/yes_hotels`.

### Frontend Fixes:
1. **`client/context/PermissionContext.tsx`**:
   - Cleaned up property ID handling. Omits `propertyId` parameter when no valid property is selected instead of defaulting to `"default"`.
   - Prevented caching of temporary 403 or network failure states into permanent denied state.
2. **`client/pages/auth/LoginPage.tsx`**:
   - Updated `ROLE_ROUTES` mapping to direct each role to their legitimate dashboard (e.g. `FRONT_DESK` → `/admin/front-desk`, `CASHIER` → `/admin/cashier`, `MANAGER` → `/admin/dashboard`, `ADMIN` → `/admin/dashboard`).
3. **`client/components/PermissionRoute.tsx`**:
   - Confirmed fail-closed posture while ensuring a clean loading screen (`"Verifying access..."`) is displayed during initial permission loading instead of premature access denial.

---

## 4. Verification & Final Status

| Verification Checklist Item | Status | Result |
| :--- | :---: | :--- |
| `admin@yeshotels.com` DB Role | Verified | Role: `ADMIN` |
| `GET /api/permissions/users/:id/effective` | Verified | HTTP 200 (Returns effective permissions map) |
| `DASHBOARD.ADMIN.VIEW` for `ADMIN` | Verified | `ALLOW` |
| `SUPER_ADMIN` Bypass Authority | Verified | `ALLOW` (Full system access) |
| Auth Bootstrap Order | Verified | Loading screen → Permissions Loaded → Route Rendered |
| System-scoped permissions without propertyId | Verified | Works cleanly without error |
| Frontend Typecheck (`pnpm typecheck`) | Passed | Exited with code 0 |
| Production Build (`pnpm build`) | Passed | Exited with code 0 |

---

## 5. Summary

The RBAC system permission resolution chain is now fully synchronized end-to-end:
- Database role `ADMIN` is seeded with valid permissions.
- `PermissionService` calculates effective permissions correctly for both system-scoped and property-scoped resources.
- `PermissionContext` loads effective permissions seamlessly on login without circular authorization blocks.
- `PermissionRoute` guards pages based on real effective permissions.
