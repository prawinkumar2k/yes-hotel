import { Request, Response } from 'express';
import { PageResource } from '../models/PageResource';
import { Role } from '../models/Role';
import { RolePermission } from '../models/RolePermission';
import { UserPermissionOverride } from '../models/UserPermissionOverride';
import { PermissionService } from '../services/PermissionService';
import { AuthenticatedRequest } from '../middleware/propertyAuth';
import { User } from '../models/User';
import { isFullAccessRole } from '../config/permissions';

export const getPages = async (req: Request, res: Response) => {
  try {
    const pages = await PageResource.find().sort({ module: 1, sortOrder: 1, key: 1 });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pages' });
  }
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    const roles = await Role.find().sort({ key: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roles' });
  }
};

export const getRolePermissions = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId).select("key").lean();
    if (!role) return res.status(404).json({ message: 'Role not found' });
    // Effective map for the role: code defaults (config/permissions.ts) plus Access Matrix edits.
    const effective = await PermissionService.getEffectivePermissions(undefined, "default", role.key);
    const edited = new Set(
      (await RolePermission.find({ roleId, source: "UI" }).select("pageKey").lean()).map((r) => r.pageKey)
    );
    res.json(
      Object.entries(effective).map(([pageKey, actions]) => ({
        roleId,
        pageKey,
        actions,
        isActive: true,
        source: edited.has(pageKey) ? "UI" : "DEFAULT",
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Error fetching role permissions' });
  }
};

export const updateRolePermission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roleId } = req.params;
    const { pageKey, actions } = req.body;

    // source "UI" marks this row as an Access Matrix edit, which overrides the code default.
    const perm = await RolePermission.findOneAndUpdate(
      { roleId, pageKey },
      { actions, isActive: true, source: "UI" },
      { upsert: true, new: true }
    );

    res.json(perm);
  } catch (error) {
    res.status(500).json({ message: 'Error updating role permission' });
  }
};

export const getUserOverrides = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const overrides = await UserPermissionOverride.find({ userId });
    res.json(overrides);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user overrides' });
  }
};

export const updateUserOverride = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { pageKey, propertyId, allowActions, denyActions } = req.body;

    const query: any = { userId, pageKey };
    if (propertyId) query.propertyId = propertyId;
    else query.propertyId = null;

    const override = await UserPermissionOverride.findOneAndUpdate(
      query,
      { allowActions: allowActions || [], denyActions: denyActions || [] },
      { upsert: true, new: true }
    );

    res.json(override);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user override' });
  }
};

export const getEffectivePermissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Security: Only allow users to fetch their own permissions unless they have PERMISSIONS.VIEW
    // For simplicity right now, just ensure it's their own ID or they are a SUPER_ADMIN or ADMIN.
    const reqUserId = req.user?.id || req.user?._id?.toString();
    if (reqUserId !== userId && !isFullAccessRole(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden: Cannot fetch permissions for another user' });
    }

    const propertyId = Array.isArray(req.query.propertyId) 
      ? String(req.query.propertyId[0]) 
      : (req.query.propertyId ? String(req.query.propertyId) : "");

    // Resolve the TARGET user's role (not the requester's) when an admin inspects someone else.
    const role = reqUserId === userId
      ? req.user?.role
      : (await User.findById(userId).select("role").lean())?.role;
    const perms = await PermissionService.getEffectivePermissions(String(userId), propertyId, role);
    res.json(perms);
  } catch (error: any) {
    if (error?.message === "User not found") {
      return res.status(401).json({ message: "User session expired or user not found. Please log in again." });
    }
    res.status(500).json({ message: 'Error fetching effective permissions' });
  }
};
