import mongoose from "mongoose";
import { User, IUser } from "../models/User";
import { Role } from "../models/Role";
import { RolePermission } from "../models/RolePermission";
import { UserPermissionOverride } from "../models/UserPermissionOverride";
import { PageResource } from "../models/PageResource";

export interface PermissionCache {
  [pageKey: string]: string[]; // Array of allowed actions, e.g. { "FRONT_DESK": ["VIEW", "EDIT"] }
}

export class PermissionService {
  /**
   * Calculates the effective permissions for a user at a given property.
   * SUPER_ADMIN always gets full access.
   */
  static async getEffectivePermissions(
    userId: mongoose.Types.ObjectId | string,
    propertyId: mongoose.Types.ObjectId | string
  ): Promise<PermissionCache> {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // 1. If Super Admin, return full access
    if (user.role === "SUPER_ADMIN") {
      const allPages = await PageResource.find({ isActive: true });
      const fullAccess: PermissionCache = {};
      allPages.forEach(p => {
        fullAccess[p.key] = p.actions;
      });
      return fullAccess;
    }

    const effectivePermissions: PermissionCache = {};

    // 2. Map string role to DB Role
    const roleDoc = await Role.findOne({ key: user.role, isActive: true });
    
    // 3. Get Role Permissions
    if (roleDoc) {
      const rolePerms = await RolePermission.find({ roleId: roleDoc._id, isActive: true });
      rolePerms.forEach(rp => {
        effectivePermissions[rp.pageKey] = [...rp.actions];
      });
    }

    // 4. Get User Overrides
    // Overrides can be global (propertyId = null) or specific to the requested property
    const orConditions: any[] = [
      { propertyId: { $exists: false } },
      { propertyId: null }
    ];
    
    if (propertyId && propertyId !== "default") {
      orConditions.push({ propertyId: propertyId });
    }

    const overrides = await UserPermissionOverride.find({
      userId,
      $or: orConditions
    });

    overrides.forEach(ov => {
      const currentActions = effectivePermissions[ov.pageKey] || [];
      
      // Add allowActions
      const allowed = new Set([...currentActions, ...ov.allowActions]);
      
      // Remove denyActions
      ov.denyActions.forEach(action => allowed.delete(action));
      
      effectivePermissions[ov.pageKey] = Array.from(allowed);
    });

    return effectivePermissions;
  }

  /**
   * Validates if a user has a specific permission
   */
  static async hasPermission(
    userId: mongoose.Types.ObjectId | string,
    propertyId: mongoose.Types.ObjectId | string,
    pageKey: string,
    action: string
  ): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId, propertyId);
    if (!perms[pageKey]) return false;
    return perms[pageKey].includes(action);
  }
}
