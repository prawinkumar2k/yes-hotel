import { Request, Response } from 'express';
import { PageResource } from '../models/PageResource';
import { Role } from '../models/Role';
import { RolePermission } from '../models/RolePermission';
import { UserPermissionOverride } from '../models/UserPermissionOverride';
import { PermissionService } from '../services/PermissionService';
import { AuthenticatedRequest } from '../middleware/propertyAuth';

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
    const permissions = await RolePermission.find({ roleId });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching role permissions' });
  }
};

export const updateRolePermission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roleId } = req.params;
    const { pageKey, actions } = req.body;

    // Optional: Add audit logic here

    const perm = await RolePermission.findOneAndUpdate(
      { roleId, pageKey },
      { actions },
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
    console.log("DEBUG: req.user.id =", req.user?.id, "userId =", userId);
    
    // Security: Only allow users to fetch their own permissions unless they have PERMISSIONS.VIEW
    // For simplicity right now, just ensure it's their own ID or they are a SUPER_ADMIN or ADMIN.
    if (req.user?.id !== userId && req.user?.role !== "SUPER_ADMIN" && req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: 'Forbidden: Cannot fetch permissions for another user' });
    }

    const propertyId = Array.isArray(req.query.propertyId) 
      ? String(req.query.propertyId[0]) 
      : (req.query.propertyId ? String(req.query.propertyId) : "");

    const perms = await PermissionService.getEffectivePermissions(String(userId), propertyId);
    res.json(perms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching effective permissions' });
  }
};
