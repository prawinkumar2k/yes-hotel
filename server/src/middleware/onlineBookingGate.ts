import { NextFunction, Request, Response } from "express";
import { HotelSettings } from "../models/HotelSettings";

/**
 * Website bookings are accepted only while Admin → Settings has "Accept online bookings" switched on.
 * Anything else (never set, switched off) is "on hold". Staff creating a booking for a guest are not blocked.
 */
export async function requireOnlineBookingOpen(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role;
  if (role && role !== "CUSTOMER") return next();
  try {
    const s: any = await HotelSettings.findOne().sort({ updatedAt: -1 }).select("onlineBookingOpen phone").lean();
    if (s?.onlineBookingOpen === true) return next();
    return res.status(503).json({
      success: false,
      code: "ONLINE_BOOKING_ON_HOLD",
      message: `Online booking is temporarily on hold. Please call us on ${s?.phone || "+91 87698 28787"} to book your stay.`,
    });
  } catch (error) {
    return next(error);
  }
}
