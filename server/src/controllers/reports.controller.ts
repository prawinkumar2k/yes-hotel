import { Request, Response } from "express";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { Booking, BookingStatus } from "../models/Booking";
import { Room } from "../models/Room";
import { AdvancePayment } from "../models/AdvancePayment";
import { RestaurantOrder } from "../models/RestaurantOrder";
import { Complaint } from "../models/Complaint";
import { Payment } from "../models/Payment";

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

/**
 * GET /api/reports/revenue-trend
 * Daily revenue totals for the past N days (default 30).
 */
export const getRevenueTrend = async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);

    const pipeline: any[] = [
      { $match: { direction: FolioLineDirection.DEBIT, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await FolioLine.aggregate(pipeline);

    // Fill missing dates with 0
    const map: Record<string, { revenue: number; transactions: number }> = {};
    for (const r of rows) map[r._id] = { revenue: Math.round(r.revenue), transactions: r.transactions };

    const trend: { date: string; revenue: number; transactions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend.push({ date: key, ...(map[key] || { revenue: 0, transactions: 0 }) });
    }

    return res.json({ success: true, data: trend });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/department-pl
 * Revenue breakdown by department/line-type for P&L view.
 */
export const getDepartmentPL = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const query: any = { direction: FolioLineDirection.DEBIT };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const pipeline: any[] = [
      { $match: query },
      { $group: { _id: "$lineType", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ];

    const rows = await FolioLine.aggregate(pipeline);

    // Also get POS revenue separately
    const posQuery: any = { status: { $in: ["CLOSED", "SERVED"] } };
    if (startDate || endDate) {
      posQuery.createdAt = {};
      if (startDate) posQuery.createdAt.$gte = new Date(startDate as string);
      if (endDate) posQuery.createdAt.$lte = new Date(endDate as string);
    }
    const posOrders = await RestaurantOrder.aggregate([
      { $match: posQuery },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]);

    const departments = rows.map((r) => ({
      department: r._id,
      revenue: Math.round(r.total * 100) / 100,
      transactions: r.count,
    }));

    return res.json({
      success: true,
      data: {
        byLineType: departments,
        posRevenue: posOrders[0]?.total ? Math.round(posOrders[0].total * 100) / 100 : 0,
        posOrderCount: posOrders[0]?.count || 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/occupancy-heatmap
 * Per-day occupancy count for the past 30 days.
 */
export const getOccupancyHeatmap = async (_req: Request, res: Response) => {
  try {
    const totalRooms = await Room.countDocuments();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const bookings = await Booking.find({
      status: { $in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
      checkInDate: { $gte: since },
    }).lean();

    const map: Record<string, number> = {};
    for (const b of bookings) {
      const checkin = new Date(b.checkInDate);
      const checkout = new Date(b.checkOutDate);
      for (let d = new Date(checkin); d < checkout; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        map[key] = (map[key] || 0) + 1;
      }
    }

    const heatmap = Object.entries(map).map(([date, occupied]) => ({
      date,
      occupied,
      occupancyPct: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ success: true, data: { totalRooms, heatmap } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/executive-summary
 * Single aggregated KPI snapshot for the executive command center.
 */
export const getExecutiveSummary = async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalRooms,
      inHouseCount,
      totalBookingsToday,
      monthlyRevRows,
      openComplaints,
      paymentsToday,
    ] = await Promise.all([
      Room.countDocuments(),
      Booking.countDocuments({ status: BookingStatus.CHECKED_IN }),
      Booking.countDocuments({ createdAt: { $gte: today } }),
      FolioLine.aggregate([
        { $match: { direction: FolioLineDirection.DEBIT, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Complaint.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS"] } }),
      Payment.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    const monthlyRevenue = monthlyRevRows[0]?.total || 0;
    const occupancyPct = totalRooms > 0 ? Math.round((inHouseCount / totalRooms) * 100) : 0;

    // Checked-in bookings for ADR calc
    const inHouseBookings = await Booking.find({ status: BookingStatus.CHECKED_IN }).lean();
    const inHouseRevenue = inHouseBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const adr = inHouseCount > 0 ? Math.round(inHouseRevenue / inHouseCount) : 0;
    const revpar = totalRooms > 0 ? Math.round(inHouseRevenue / totalRooms) : 0;

    return res.json({
      success: true,
      data: {
        occupancyPct,
        inHouseCount,
        totalRooms,
        adr,
        revpar,
        monthlyRevenue: Math.round(monthlyRevenue),
        totalBookingsToday,
        openComplaints,
        paymentsToday: paymentsToday[0]?.total ? Math.round(paymentsToday[0].total) : 0,
        paymentsTodayCount: paymentsToday[0]?.count || 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/in-house-list
 * Replicates the physical "Guest In-House List" logbook structure.
 */
export const getInHouseList = async (_req: Request, res: Response) => {
  try {
    const activeBookings = await Booking.find({ status: BookingStatus.CHECKED_IN })
      .populate("assignedRoom", "roomNumber")
      .populate("company", "name")
      .lean();

    const data = await Promise.all(
      activeBookings.map(async (booking) => {
        // Aggregate folio details (Extra Bed, Food Bill, Advance, Payments)
        const folioLines = booking.folio ? await FolioLine.find({ folio: booking.folio }).lean() : [];
        
        let extraBedCount = 0;
        let foodBill = 0;
        let advance = 0;
        let settled = 0;
        const paymentModes = new Set<string>();
        let balance = 0;

        folioLines.forEach((line) => {
          if (line.lineType === FolioLineType.EXTRA_BED && line.direction === FolioLineDirection.DEBIT) {
            extraBedCount++;
          } else if (line.lineType === FolioLineType.RESTAURANT && line.direction === FolioLineDirection.DEBIT) {
            foodBill += line.amount;
          } else if (line.lineType === FolioLineType.ADVANCE_ADJUSTMENT && line.direction === FolioLineDirection.CREDIT) {
            advance += line.amount;
          } else if (line.lineType === FolioLineType.PAYMENT && line.direction === FolioLineDirection.CREDIT) {
            settled += line.amount;
            if (line.notes) paymentModes.add(line.notes.split(" ")[0]); // Assuming notes starts with method e.g. "CASH payment"
          }

          if (line.direction === FolioLineDirection.DEBIT) balance += line.amount;
          else if (line.direction === FolioLineDirection.CREDIT) balance -= line.amount;
        });

        // Also check Payments directly for settled and payment modes if needed, but FolioLine is source of truth for the folio
        const payments = await Payment.find({ booking: booking._id }).lean();
        payments.forEach(p => {
            paymentModes.add(p.method);
        });

        let advanceTotal = 0;
        const advances = await AdvancePayment.find({ booking: booking._id }).lean();
        advances.forEach(a => advanceTotal += a.amount);
        advance = Math.max(advance, advanceTotal); // Just in case it's not adjusted yet

        // Calculate nights
        const checkin = new Date(booking.checkInDate);
        const checkout = new Date(booking.checkOutDate);
        const nights = Math.max(1, Math.round((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24)));

        // Tariff = Base Room Charge per night (approx)
        const tariff = booking.totalAmount / nights;

        return {
          _id: booking._id,
          grcNo: booking.bookingReference,
          roomNo: (booking.assignedRoom as any)?.roomNumber || "Unassigned",
          guestName: `${booking.guestDetails.firstName} ${booking.guestDetails.lastName}`.trim(),
          companyGroup: (booking.company as any)?.name || booking.groupId?.toString() || booking.source,
          adults: booking.adults || 1,
          childKids: booking.children || 0,
          tariff: Math.round(tariff),
          plan: booking.ratePlan || "EP",
          extraBed: extraBedCount,
          foodBill: Math.round(foodBill),
          checkedIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          nights,
          advance: Math.round(advance),
          balance: Math.round(balance),
          settled: Math.round(settled),
          paymentMode: Array.from(paymentModes).join(", ") || "-",
        };
      })
    );

    // Sort by Room Number
    data.sort((a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }));

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

