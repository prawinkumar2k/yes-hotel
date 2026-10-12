import mongoose from "mongoose";
import { Role } from "../models/Role";
import { RolePermission } from "../models/RolePermission";
import { UserPermissionOverride } from "../models/UserPermissionOverride";
import { PageResource } from "../models/PageResource";
import {
  ALL_ACTIONS,
  ALL_PAGE_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  isFullAccessRole,
} from "../config/permissions";

export interface PermissionCache {
  [pageKey: string]: string[]; // Array of allowed actions, e.g. { "FRONT_DESK": ["VIEW", "EDIT"] }
}

type Actor = { id?: string; _id?: unknown; role?: string } | undefined | null;

export class PermissionService {
  /**
   * Effective permissions for a role (+ optional user) at a property.
   * See config/permissions.ts for the resolution order.
   */
  static async getEffectivePermissions(
    userId: mongoose.Types.ObjectId | string | undefined,
    propertyId: mongoose.Types.ObjectId | string,
    role: string | undefined,
  ): Promise<PermissionCache> {
    if (!role) throw new Error("User not found");

    if (isFullAccessRole(role)) {
      const fullAccess: PermissionCache = {};
      const pages = await PageResource.find({ isActive: true }).select("key").lean();
      for (const key of [...ALL_PAGE_KEYS, ...pages.map((p) => p.key)]) fullAccess[key] = [...ALL_ACTIONS];
      return fullAccess;
    }

    const effective: PermissionCache = {};
    for (const [page, actions] of Object.entries(DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? {})) {
      effective[page] = [...(actions ?? [])];
    }

    // Access Matrix edits (source "UI") replace the default action list for that page.
    const roleDoc = await Role.findOne({ key: role, isActive: true }).select("_id").lean();
    if (roleDoc) {
      const edits = await RolePermission.find({ roleId: roleDoc._id, isActive: true, source: "UI" }).lean();
      for (const rp of edits) effective[rp.pageKey] = [...rp.actions];
    }

    if (userId) {
      const scope: any[] = [{ propertyId: { $exists: false } }, { propertyId: null }];
      if (propertyId && propertyId !== "default") scope.push({ propertyId });
      const overrides = await UserPermissionOverride.find({ userId, $or: scope }).lean();
      for (const ov of overrides) {
        const allowed = new Set([...(effective[ov.pageKey] || []), ...ov.allowActions]);
        ov.denyActions.forEach((a) => allowed.delete(a));
        effective[ov.pageKey] = [...allowed];
      }
    }
    return effective;
  }

  static async hasPermission(
    userId: mongoose.Types.ObjectId | string | undefined,
    propertyId: mongoose.Types.ObjectId | string,
    pageKey: string,
    action: string,
    role: string | undefined,
  ): Promise<boolean> {
    if (isFullAccessRole(role)) return true;
    const perms = await this.getEffectivePermissions(userId, propertyId, role);
    return (perms[pageKey] || []).includes(action);
  }

  /** Controller-level check for the request's user, e.g. can(req.user, "CAP.BOOKING_CANCEL_ANY"). */
  static async can(user: Actor, pageKey: string, action = "ALLOW", propertyId: string = "default"): Promise<boolean> {
    if (!user?.role) return false;
    const userId = (user.id ?? (user._id ? String(user._id) : undefined)) as string | undefined;
    return this.hasPermission(userId, propertyId, pageKey, action, user.role);
  }
}
