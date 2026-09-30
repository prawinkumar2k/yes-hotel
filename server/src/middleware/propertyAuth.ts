import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export interface AuthenticatedRequest extends Request {
  user?: any; // To be typed properly with IUser
  propertyId?: mongoose.Types.ObjectId;
}

export const requirePropertyAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 1. System-level roles that are not property-scoped
    const systemRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"];
    if (systemRoles.includes(user.role)) {
      // These roles can access any property — attach a property context if available
      let reqProp = req.headers["x-property-id"] as string;
      if (!reqProp && user.propertyId) reqProp = user.propertyId.toString();
      if (!reqProp && user.propertyIds && user.propertyIds.length > 0) reqProp = user.propertyIds[0].toString();

      if (reqProp) {
        try {
          req.propertyId = new mongoose.Types.ObjectId(reqProp);
        } catch {
          // requestedPropertyId was not a valid ObjectId (e.g. "default") — proceed without it
        }
      }
      return next();
    }

    // 2. Determine requested property for non-system users
    let requestedPropertyId = req.headers["x-property-id"] as string;

    if (!requestedPropertyId) {
      // Fallback: If user has a single propertyId, use that.
      if (user.propertyId) {
        requestedPropertyId = user.propertyId.toString();
      } else if (user.propertyIds && user.propertyIds.length > 0) {
        requestedPropertyId = user.propertyIds[0].toString();
      } else {
        return res.status(400).json({ message: "Property context is required" });
      }
    }

    let isAuthorized = false;
    
    if (user.propertyId && user.propertyId.toString() === requestedPropertyId) {
      isAuthorized = true;
    } else if (user.propertyIds) {
      const authorizedIds = user.propertyIds.map((id: any) => id.toString());
      if (authorizedIds.includes(requestedPropertyId)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: "Forbidden: You do not have access to this property" });
    }

    req.propertyId = new mongoose.Types.ObjectId(requestedPropertyId);
    next();
  } catch (error) {
    console.error("Property Authorization Error:", error);
    res.status(500).json({ message: "Internal server error during property authorization" });
  }
};
