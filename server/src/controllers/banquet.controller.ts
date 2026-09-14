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

    let banquets = await BanquetBooking.find(filter).sort({ eventDate: 1 }).lean();

    if (banquets.length === 0) {
      banquets = await BanquetBooking.insertMany([
        {
          bookingNumber: "BNQ-2026-001",
          eventName: "Infosys Annual Leadership Summit",
          clientName: "Priya Nair",
          clientPhone: "+91 98450 33445",
          clientEmail: "travel@infosys.com",
          hallName: "Grand Ball Room",
          eventDate: new Date(Date.now() + 86400000 * 5),
          expectedPax: 120,
          menuPackage: "Executive Corporate CP Buffet",
          ratePerPax: 1500,
          totalEstimatedAmount: 180000,
          advancePaid: 50000,
          status: BanquetStatus.CONFIRMED,
        },
        {
          bookingNumber: "BNQ-2026-002",
          eventName: "Kapoor & Sharma Wedding Reception",
          clientName: "Rajesh Kapoor",
          clientPhone: "+91 98200 44556",
          clientEmail: "rajesh@kapoor.com",
          hallName: "Emerald Convention Lawn",
          eventDate: new Date(Date.now() + 86400000 * 12),
          expectedPax: 300,
          menuPackage: "Royal Wedding Feast",
          ratePerPax: 2200,
          totalEstimatedAmount: 660000,
          advancePaid: 200000,
          status: BanquetStatus.CONFIRMED,
        },
      ]);
    }

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
      clientEmail: clientEmail || "client@banquet.com",
      hallName: hallName || "Grand Ball Room",
      eventDate: new Date(eventDate),
      expectedPax: pax,
      menuPackage: menuPackage || "Standard Buffet",
      ratePerPax: rate,
      totalEstimatedAmount,
      advancePaid: Number(advancePaid) || 0,
      status: BanquetStatus.CONFIRMED,
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
