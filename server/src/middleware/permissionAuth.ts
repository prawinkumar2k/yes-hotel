import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "./propertyAuth";
import { PermissionService } from "../services/PermissionService";
import { isFullAccessRole } from "../config/permissions";

/**
 * The backend's only route-level authorization check. Access is defined in
 * config/permissions.ts. Use AFTER protect (and after requirePropertyAccess
 * when the route is property-scoped, so req.propertyId is available).
 */
export const requirePermission = (pageKey: string, action: string = "VIEW") => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized: No user context" });
      }
      if (isFullAccessRole(user.role)) return next();

      const userId = user._id || user.id;
      const propertyId = req.propertyId || "default";
      const allowed = await PermissionService.hasPermission(userId, propertyId, pageKey, action, user.role);
      if (!allowed) {
        return res.status(403).json({ success: false, message: `Forbidden: You lack ${action} permission for ${pageKey}` });
      }
      next();
    } catch (error: any) {
      console.error("Permission Authorization Error:", error);
      res.status(500).json({ success: false, message: "Internal server error during permission check" });
    }
  };
};

/**
 * Staff need PAGE:ACTION; a CUSTOMER may proceed only for a booking they own
 * (`:bookingId` route param), and is flagged read-only via req.ownerAccess.
 */
export const requirePermissionOrBookingOwner = (pageKey: string, action: string = "VIEW") => {
  const staffCheck = requirePermission(pageKey, action);
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== "CUSTOMER") return staffCheck(req, res, next);
    try {
      const bookingId = String(req.params.bookingId || "");
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({ success: false, message: "Invalid booking ID" });
      }
      const { Booking } = await import("../models/Booking");
      const booking = await Booking.findById(bookingId).select("customer").lean();
      if (!booking || String(booking.customer) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Forbidden: not your booking" });
      }
      (req as any).ownerAccess = true;
      next();
    } catch (error: any) {
      console.error("Ownership Authorization Error:", error);
      res.status(500).json({ success: false, message: "Internal server error during permission check" });
    }
  };
};
