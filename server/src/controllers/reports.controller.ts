import { Request, Response } from "express";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { Booking, BookingStatus } from "../models/Booking";
import { Room } from "../models/Room";
import { AdvancePayment } from "../models/AdvancePayment";

/**
 * GET /api/admin/reports/overview
 * Overview stats for admin reports dashboard.
 */
export const getReportsOverview = async (_req: Request, res: Response) => {
  try {
    const [totalBookings, checkedInBookings, totalRooms, advances] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: BookingStatus.CHECKED_IN }),
      Room.countDocuments(),
      AdvancePayment.find().lean(),
    ]);

    const totalAdvanceHeld = advances.reduce((sum, a) => sum + (a.remainingBalance || 0), 0);

    return res.json({
      success: true,
      data: {
        totalBookings,
        checkedInBookings,
        totalRooms,
        totalAdvanceHeld,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/sales
 * Financial sales report with CGST / SGST / IGST tax breakdown.
 */
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const query: Record<string, any> = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const lines = await FolioLine.find(query).lean();

    let totalGrossRevenue = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscounts = 0;
    let totalPaymentsCollected = 0;

    for (const line of lines) {
      const amt = line.amount;
      if (line.direction === FolioLineDirection.DEBIT) {
        if (line.lineType === FolioLineType.TAX_CGST) totalCgst += amt;
        else if (line.lineType === FolioLineType.TAX_SGST) totalSgst += amt;
        else if (line.lineType === FolioLineType.TAX_IGST) totalIgst += amt;
        else totalGrossRevenue += amt;
      } else {
        if (line.lineType === FolioLineType.DISCOUNT) totalDiscounts += amt;
        else if (line.lineType === FolioLineType.PAYMENT) totalPaymentsCollected += amt;
      }
    }

    const netRevenue = totalGrossRevenue - totalDiscounts;
    const totalTax = totalCgst + totalSgst + totalIgst;

    return res.json({
      success: true,
      data: {
        summary: {
          totalGrossRevenue,
          totalDiscounts,
          netRevenue,
          totalCgst,
          totalSgst,
          totalIgst,
          totalTax,
          totalPaymentsCollected,
        },
        transactionCount: lines.length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/room-stay
 * Occupancy rate, ADR (Average Daily Rate), RevPAR (Revenue Per Available Room).
 */
export const getRoomStayReport = async (_req: Request, res: Response) => {
  try {
    const totalRooms = await Room.countDocuments();
    const inHouseCount = await Booking.countDocuments({ status: BookingStatus.CHECKED_IN });
    const confirmedCount = await Booking.countDocuments({ status: BookingStatus.CONFIRMED });

    const checkedInBookings = await Booking.find({ status: BookingStatus.CHECKED_IN });
    const totalRevenueInHouse = checkedInBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const occupancyPercentage = totalRooms > 0 ? Math.round((inHouseCount / totalRooms) * 100) : 0;
    const adr = inHouseCount > 0 ? Math.round(totalRevenueInHouse / inHouseCount) : 0;
    const revPar = totalRooms > 0 ? Math.round(totalRevenueInHouse / totalRooms) : 0;

    return res.json({
      success: true,
      data: {
        totalRooms,
        inHouseCount,
        confirmedCount,
        occupancyPercentage,
        averageDailyRate: adr,
        revenuePerAvailableRoom: revPar,
        totalRevenueInHouse,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/gst
 * GST Filing breakdown report.
 */
export const getGstReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const query: Record<string, any> = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const taxLines = await FolioLine.find({
      ...query,
      lineType: { $in: [FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST] },
    }).lean();

    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const t of taxLines) {
      if (t.lineType === FolioLineType.TAX_CGST) totalCgst += t.amount;
      if (t.lineType === FolioLineType.TAX_SGST) totalSgst += t.amount;
      if (t.lineType === FolioLineType.TAX_IGST) totalIgst += t.amount;
    }

    return res.json({
      success: true,
      data: {
        totalCgst: Math.round(totalCgst * 100) / 100,
        totalSgst: Math.round(totalSgst * 100) / 100,
        totalIgst: Math.round(totalIgst * 100) / 100,
        totalGstCollected: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
        recordCount: taxLines.length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/advances
 */
export const getAdvanceReport = async (_req: Request, res: Response) => {
  try {
    const advances = await AdvancePayment.find().lean();
    let totalHeld = 0;
    let totalAdjusted = 0;
    let totalRefunded = 0;

    for (const a of advances) {
      totalHeld += a.remainingBalance || 0;
      totalAdjusted += a.totalAdjusted || 0;
      if (a.status === "REFUNDED") totalRefunded += a.amount;
    }

    return res.json({
      success: true,
      data: {
        totalAdvancesCount: advances.length,
        totalUnadjustedHeld: Math.round(totalHeld * 100) / 100,
        totalAdjusted: Math.round(totalAdjusted * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
