import { Request, Response } from "express";
import { AncillaryService, ServiceCategory } from "../models/AncillaryService";
import { Room } from "../models/Room";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLineType } from "../models/FolioLine";
import { postCharge } from "../services/folio.service";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/ancillary-services
 */
export const getAncillaryServices = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const filter: Record<string, any> = {};
    if (category) filter.category = category;

    let services = await AncillaryService.find(filter).sort({ createdAt: -1 }).lean();

    if (services.length === 0 && !category) {
      services = await AncillaryService.insertMany([
        {
          serviceNumber: "SVC-SPA-01",
          category: ServiceCategory.SPA,
          serviceName: "Aroma Therapy Massage 60 Min",
          guestName: "Ananya Sharma",
          roomNumber: "102",
          amount: 2500,
          taxAmount: 450,
          totalAmount: 2950,
          isChargedToFolio: true,
          performedBy: "Dr. Maya (Therapist)",
        },
        {
          serviceNumber: "SVC-TRP-01",
          category: ServiceCategory.TRANSPORT,
          serviceName: "Airport Pickup Drop (Sedan)",
          guestName: "Rahul Verma",
          roomNumber: "204",
          amount: 1800,
          taxAmount: 0,
          totalAmount: 1800,
          isChargedToFolio: true,
          performedBy: "Ramesh (Driver)",
        },
      ]);
    }

    return res.json({ success: true, data: services });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/ancillary-services
 * Record a Spa, Transport, Laundry or Minibar service & post to Folio if requested
 */
export const createAncillaryService = async (req: Request, res: Response) => {
  try {
    const { category, serviceName, guestName, roomNumber, amount, chargeToFolio, performedBy, notes } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id || "STAFF";

    if (!category || !serviceName || !guestName || !amount) {
      return res.status(400).json({ success: false, message: "category, serviceName, guestName, amount are required" });
    }

    const amt = Number(amount);
    const taxAmount = Math.round(amt * 0.18); // 18% Service GST
    const totalAmount = amt + taxAmount;
    const serviceNumber = `SVC-${Date.now().toString(36).toUpperCase()}`;

    let folioId: string | undefined = undefined;
    let bookingId: string | undefined = undefined;

    // Folio Charge Integration
    if (chargeToFolio && roomNumber) {
      const room = await Room.findOne({ roomNumber });
      if (!room || !room.currentBooking) {
        return res.status(400).json({
          success: false,
          message: `Cannot charge to Room ${roomNumber}: Room is not currently occupied by a checked-in guest.`,
        });
      }

      bookingId = room.currentBooking.toString();
      const folio = await Folio.findOne({ booking: room.currentBooking, status: FolioStatus.OPEN });
      if (!folio) {
        return res.status(400).json({
          success: false,
          message: `Cannot charge to Room ${roomNumber}: Guest has no open folio available for posting.`,
        });
      }

      folioId = folio._id.toString();

      let lineType = FolioLineType.SPA;
      if (category === ServiceCategory.TRANSPORT) lineType = FolioLineType.TRANSPORT;
      else if (category === ServiceCategory.LAUNDRY) lineType = FolioLineType.LAUNDRY;
      else if (category === ServiceCategory.MINIBAR) lineType = FolioLineType.MINIBAR;
      else lineType = FolioLineType.ADDON;

      await postCharge(
        {
          folioId,
          bookingId,
          lineType,
          description: `${serviceName} (${category})`,
          amount: totalAmount,
          date: new Date(),
          postedBy: actorId.toString(),
        },
        { req }
      );
    }

    const service = await AncillaryService.create({
      serviceNumber,
      category,
      serviceName,
      guestName,
      roomNumber,
      bookingId,
      folioId,
      amount: amt,
      taxAmount,
      totalAmount,
      isChargedToFolio: Boolean(chargeToFolio && folioId),
      performedBy,
      notes,
    });

    await createAuditLog({
      req,
      action: "ancillary_service.created",
      resourceType: "AncillaryService",
      resourceId: service._id.toString(),
      metadata: { serviceNumber, category, totalAmount, isChargedToFolio: service.isChargedToFolio },
    });

    return res.json({ success: true, message: `${serviceName} recorded`, data: service });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
