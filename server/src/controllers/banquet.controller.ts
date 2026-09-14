import { Request, Response } from "express";
import { BanquetBooking, BanquetStatus } from "../models/BanquetBooking";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/banquets
 */
export const getBanquetBookings = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const banquets = await BanquetBooking.find(filter).sort({ eventDate: 1 }).lean();

    return res.json({ success: true, data: banquets });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/banquets
 */
export const createBanquetBooking = async (req: Request, res: Response) => {
  try {
    const { eventName, clientName, clientPhone, clientEmail, hallName, eventDate, expectedPax, menuPackage, ratePerPax, advancePaid, notes } = req.body;

    if (!eventName || !clientName || !clientPhone || !eventDate || !expectedPax || !ratePerPax) {
      return res.status(400).json({ success: false, message: "eventName, clientName, clientPhone, eventDate, expectedPax, ratePerPax are required" });
    }

    const pax = Number(expectedPax);
    const rate = Number(ratePerPax);
    const totalEstimatedAmount = pax * rate;
    const bookingNumber = `BNQ-${Date.now().toString(36).toUpperCase()}`;

    const banquet = await BanquetBooking.create({
      bookingNumber,
      eventName,
      clientName,
      clientPhone,
      clientEmail,
      hallName: hallName || "Grand Ball Room",
      eventDate: new Date(eventDate),
      expectedPax: pax,
      menuPackage: menuPackage || "Standard Buffet",
      ratePerPax: rate,
      totalEstimatedAmount,
      advancePaid: Number(advancePaid) || 0,
      status: BanquetStatus.INQUIRY,
      notes,
    });

    await createAuditLog({
      req,
      action: "banquet.created",
      resourceType: "BanquetBooking",
      resourceId: banquet._id.toString(),
      metadata: { bookingNumber, totalEstimatedAmount },
    });

    return res.json({ success: true, message: `Banquet Event ${bookingNumber} booked`, data: banquet });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/banquets/:id/status
 */
export const updateBanquetStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!Object.values(BanquetStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const banquet = await BanquetBooking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!banquet) return res.status(404).json({ success: false, message: "Banquet booking not found" });

    await createAuditLog({
      req,
      action: "banquet.status_updated",
      resourceType: "BanquetBooking",
      resourceId: banquet._id.toString(),
      metadata: { bookingNumber: banquet.bookingNumber, newStatus: status },
    });

    return res.json({ success: true, message: `Banquet status updated to ${status}`, data: banquet });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
