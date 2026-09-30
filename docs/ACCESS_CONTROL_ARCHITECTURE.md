# Access Control Architecture

## Overview
Yes Hotels uses a robust, database-driven Role-Based Access Control (RBAC) system combined with strict Property Scoping. The architecture guarantees that no user can access data or perform actions outside their assigned property and explicit permissions.

## Data Models

### 1. `Role`
Represents a collection of permissions. Roles can be system-defined (e.g., `RECEPTIONIST`, `CASHIER`) or custom-created.
- Fields: `key`, `name`, `isSystem`, `isActive`

### 2. `PageResource`
The registry of all accessible modules and pages in the application.
- Fields: `key`, `module`, `name`, `route`, `actions` (e.g. `VIEW`, `CREATE`, `EDIT`)

### 3. `RolePermission`
Maps a `Role` to a `PageResource` with a specific set of allowed actions.
- Fields: `roleId`, `pageKey`, `actions`

### 4. `UserPermissionOverride`
Allows granular control over specific users, allowing or denying specific actions at specific properties, independently of their Role.
- Fields: `userId`, `propertyId`, `pageKey`, `allowActions`, `denyActions`

### 5. `User` (Property Scope)
The `User` model defines the authorized properties.
- `propertyId`: Single assigned property
- `propertyIds`: Multiple assigned properties (for multi-property users)

## Resolution Logic
Permissions are evaluated at runtime by `PermissionService.getEffectivePermissions(userId, propertyId)`.

The formula is:
\`\`\`
EFFECTIVE_ACCESS = ROLE_PERMISSIONS + USER_ALLOW_OVERRIDES - USER_DENY_OVERRIDES
\`\`\`
*(Subject to Property Access validation first)*

`SUPER_ADMIN` completely bypasses the granular checks and receives full access to all pages and actions for the requested property.

## Middleware Enforcement
Every protected route must go through two middlewares in sequence:

1. **`requirePropertyAccess`**: Validates `x-property-id` against the User's allowed properties. Secures data at the tenant level.
2. **`requirePermission("PAGE_KEY", "ACTION")`**: Evaluates if the effective permissions contain the requested action for the page.

Example API Definition:
\`\`\`ts
router.post(
  "/bookings/:id/refund",
  authenticate,
  requirePropertyAccess,
  requirePermission("PAYMENTS", "REFUND"),
  refundBookingHandler
);
\`\`\`

## Frontend Enforcement
The frontend utilizes the `<PermissionRoute>` or `<ProtectedRoute>` components which read the user's evaluated permissions and current property state. It strictly enforces:
- Sidebar visibility
- Dashboard access
- Direct URL navigation (renders Access Denied)
- Button-level rendering (e.g., hiding a Refund button)
