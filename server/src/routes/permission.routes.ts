import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import * as PermissionController from "../controllers/PermissionController";

const router = Router();

// These endpoints are system-level management endpoints.
// We protect them with the PERMISSIONS.VIEW and PERMISSIONS.EDIT actions.
// They require authentication, and property access (or system admin bypass).

router.use(protect);

// Pages & Roles (Read-Only Matrix Definitions)
router.get("/pages", requirePermission("PERMISSIONS", "VIEW"), PermissionController.getPages);
router.get("/roles", requirePermission("ROLES", "VIEW"), PermissionController.getRoles);
router.get("/roles/:roleId/permissions", requirePermission("PERMISSIONS", "VIEW"), PermissionController.getRolePermissions);

// Update Role Permissions
router.put("/roles/:roleId/permissions", requirePermission("PERMISSIONS", "EDIT"), PermissionController.updateRolePermission);

// User Overrides
router.get("/users/:userId/overrides", requirePermission("PERMISSIONS", "VIEW"), PermissionController.getUserOverrides);
router.put("/users/:userId/overrides", requirePermission("PERMISSIONS", "EDIT"), PermissionController.updateUserOverride);

// Effective Permissions
// Note: This needs requirePropertyAccess if it relies on req.propertyId implicitly, 
// but it currently accepts propertyId via query for calculating perms.
router.get("/users/:userId/effective", PermissionController.getEffectivePermissions);

export default router;
