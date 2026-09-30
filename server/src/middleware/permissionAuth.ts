import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./propertyAuth";
import { PermissionService } from "../services/PermissionService";

/**
 * Middleware to require a specific permission for an endpoint.
 * Must be used AFTER requirePropertyAccess so that req.propertyId is available.
 */
export const requirePermission = (pageKey: string, action: string = "VIEW") => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const propertyId = req.propertyId || "default";

      if (!user) {
        return res.status(401).json({ message: "Unauthorized: No user context" });
      }

      const userId = user._id || user.id;

      const hasPerm = await PermissionService.hasPermission(userId, propertyId, pageKey, action);

      if (!hasPerm) {
        return res.status(403).json({ 
          message: `Forbidden: You lack ${action} permission for ${pageKey}` 
        });
      }

      next();
    } catch (error: any) {
      console.error("Permission Authorization Error:", error);
      res.status(500).json({ message: "Internal server error during permission check", error: error.message, stack: error.stack });
    }
  };
};
