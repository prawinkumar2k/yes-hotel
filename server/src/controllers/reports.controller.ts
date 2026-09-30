import { Request, Response } from "express";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { Booking, BookingStatus } from "../models/Booking";
import { Room, HousekeepingRoomStatus } from "../models/Room";
import { AdvancePayment } from "../models/AdvancePayment";
import { RestaurantOrder } from "../models/RestaurantOrder";
import { Complaint } from "../models/Complaint";
import { Payment } from "../models/Payment";

import { Folio } from "../models/Folio";
import { HousekeepingTask } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";
import { InventoryItem } from "../models/InventoryItem";
import { PurchaseOrder } from "../models/PurchaseOrder";
import { CorporateAccount } from "../models/CorporateAccount";
import { CashierShift } from "../models/CashierShift";

/**
 * GET /api/admin/reports/overview?dateFrom&dateTo
 * Overview stats for the admin Reports page (client/pages/admin/AdminReports.tsx).
 *
 * Rewritten from a stub that ignored dateFrom/dateTo entirely and returned
 * only {totalBookings, checkedInBookings, totalRooms, totalAdvanceHeld} —
 * the frontend has always expected revenue/adr/revPAR/occupancyRate/
 * cancellationRate/categoryPerformance/range, none of which the stub
 * provided, so this page has been throwing a runtime TypeError
 * (`Cannot read properties of undefined (reading 'toLocaleString')`) on
 * every load. Confirmed live during this audit.
 *
 * "Bookings in range" = bookings whose stay starts (checkInDate) in
 * [dateFrom, dateTo] — the standard "arrivals for period" framing for this
 * kind of dashboard. Revenue/ADR/RevPAR exclude CANCELLED bookings.
 */
export const getReportsOverview = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const from = req.query.dateFrom ? new Date(req.query.dateFrom as string) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.dateTo ? new Date(req.query.dateTo as string) : now;
    // Make `to` inclusive of the whole day.
    const toInclusive = new Date(to);
    toInclusive.setHours(23, 59, 59, 999);

    const rangeMatch = { checkInDate: { $gte: from, $lte: toInclusive } };
    const daysInRange = Math.max(1, Math.ceil((toInclusive.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));

    const [totalRooms, summaryAgg, categoryPerformanceRaw] = await Promise.all([
      Room.countDocuments(),
      Booking.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: null,
            bookingsInRange: { $sum: 1 },
            cancelledCount: { $sum: { $cond: [{ $eq: ["$status", BookingStatus.CANCELLED] }, 1, 0] } },
            paidBookingsCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0] } },
            revenue: { $sum: { $cond: [{ $ne: ["$status", BookingStatus.CANCELLED] }, "$totalAmount", 0] } },
            roomNights: {
              $sum: {
                $cond: [
                  { $ne: ["$status", BookingStatus.CANCELLED] },
                  { $divide: [{ $subtract: ["$checkOutDate", "$checkInDate"] }, 1000 * 60 * 60 * 24] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { ...rangeMatch, status: { $ne: BookingStatus.CANCELLED } } },
        { $group: { _id: "$roomCategory", bookingsCount: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
        { $lookup: { from: "roomcategories", localField: "_id", foreignField: "_id", as: "category" } },
        { $unwind: "$category" },
        { $project: { _id: "$category._id", name: "$category.name", basePrice: "$category.basePrice", bookingsCount: 1, revenue: 1 } },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    const summary = summaryAgg[0] || { bookingsInRange: 0, cancelledCount: 0, paidBookingsCount: 0, revenue: 0, roomNights: 0 };
    const revenue = Math.round(summary.revenue * 100) / 100;
    const roomNights = Math.round(summary.roomNights * 100) / 100;
    const occupancyRate = totalRooms > 0 ? Math.round((roomNights / (totalRooms * daysInRange)) * 10000) / 100 : 0;
    const adr = roomNights > 0 ? Math.round((revenue / roomNights) * 100) / 100 : 0;
    const revPAR = totalRooms > 0 ? Math.round((revenue / (totalRooms * daysInRange)) * 100) / 100 : 0;
    const cancellationRate = summary.bookingsInRange > 0 ? Math.round((summary.cancelledCount / summary.bookingsInRange) * 10000) / 100 : 0;

    return res.json({
      success: true,
      data: {
        revenue,
        paidBookingsCount: summary.paidBookingsCount,
        bookingsInRange: summary.bookingsInRange,
        cancellationRate,
        occupancyRate,
        adr,
        revPAR,
        totalRooms,
        categoryPerformance: categoryPerformanceRaw,
        range: { from: from.toISOString(), to: toInclusive.toISOString() },
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
          discountAmount: booking.discountAmount || 0,
          appliedCoupon: booking.appliedCoupon || "-",
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

/**
 * GET /api/reports/day-summary
 * Replicates the "YH - Day Sales Summary" and "CASH Sheet" PDF structure.
 */
export const getDaySummary = async (req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayQuery = { $gte: todayStart, $lte: todayEnd };

    // 1. Fetch relevant bookings for today
    const checkIns = await Booking.find({ checkInDate: todayQuery });
    const checkOuts = await Booking.find({ checkOutDate: todayQuery });
    const dayUses = await Booking.find({ stayType: "HOURLY", createdAt: todayQuery });
    
    // Total occupied rooms (Checked In status)
    const activeBookings = await Booking.find({ status: BookingStatus.CHECKED_IN });
    const totalPax = activeBookings.reduce((sum, b) => sum + (b.adults || 1) + (b.children || 0), 0);

    const cancelled = await Booking.countDocuments({ status: BookingStatus.CANCELLED, cancelledAt: todayQuery });
    const noShows = await Booking.countDocuments({ status: BookingStatus.NO_SHOW, noShowAt: todayQuery });
    
    // Through channels (Walkin, OTA, Agency, Auto)
    const walkins = checkIns.filter(b => b.source === "WALK_IN").length;
    const otas = checkIns.filter(b => b.source === "OTA").length;
    const agencies = checkIns.filter(b => b.source === "CORPORATE").length;
    
    // 2. Fetch payments for today
    const todayPayments = await Payment.find({ createdAt: todayQuery });
    
    let resrvAdv = 0, roomAdv = 0, partial = 0, final = 0, advAdjd = 0;
    const paymentModes: Record<string, number> = {
      CASH: 0, UPI: 0, CARD: 0, PAYTM: 0, HDFC: 0, OTA_CREDIT: 0
    };

    todayPayments.forEach(p => {
      const anyP = p as any;
      // Very basic bucketing for the summary
      if (anyP.purpose === "ADVANCE") {
        const b = checkIns.find(cb => cb._id.toString() === p.booking?.toString());
        if (b) roomAdv += p.amount;
        else resrvAdv += p.amount;
      } else if (anyP.purpose === "SETTLEMENT") {
        final += p.amount;
      } else {
        partial += p.amount;
      }
      
      const mode = p.method.toUpperCase();
      if (paymentModes[mode] !== undefined) paymentModes[mode] += p.amount;
      else if (mode.includes("UPI")) paymentModes.UPI += p.amount;
      else if (mode.includes("CARD")) paymentModes.CARD += p.amount;
      else paymentModes.CASH += p.amount;
    });

    // 3. Cash Sheet Data
    const cashPayments = todayPayments.filter(p => p.method.toUpperCase().includes("CASH"));
    let todayCashInward = 0;
    const cashTransactions = cashPayments.map(p => {
      todayCashInward += p.amount;
      const anyP = p as any;
      return {
        party: anyP.notes || "Guest",
        description: anyP.purpose || "Payment",
        debit: 0,
        credit: p.amount
      };
    });

    return res.json({
      success: true,
      data: {
        date: new Date().toISOString(),
        page1: {
          rooms: {
            checkIn: checkIns.length,
            checkOut: checkOuts.length,
            dayUse: dayUses.length
          },
          occupancy: {
            room: activeBookings.length,
            pax: totalPax
          },
          status: {
            cancelled,
            noShow: noShows,
            noOfInquiry: 0 // Stub
          },
          through: {
            walkin: walkins,
            ota: otas,
            agency: agencies,
            auto: 0
          },
          receipts: {
            resrvAdv,
            roomAdv,
            partial,
            final,
            advAdjd
          },
          modes: paymentModes
        },
        page2: {
          openingBalance: 0, // Stub - would come from CashierShift
          todayCashInward,
          transactions: cashTransactions,
          total: todayCashInward,
          closingBalance: todayCashInward
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/monthly-mis
 * Provides a monthly MIS report, grouping payments and sales by day.
 */
export const getMonthlyMIS = async (req: Request, res: Response) => {
  try {
    const month = req.query.month ? String(req.query.month) : new Date().toISOString().substring(0, 7);
    const [year, m] = month.split('-');
    
    // Create dates in local time roughly
    const startOfMonth = new Date(parseInt(year), parseInt(m) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(m), 0, 23, 59, 59, 999);
    
    const daysInMonth = endOfMonth.getDate();
    const query = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };

    // Grouping by day mapping
    const dailyData: Record<number, any> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(parseInt(year), parseInt(m) - 1, i);
      dailyData[i] = {
        date: d.toISOString(),
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        cash: 0,
        card: 0,
        upi: 0,
        paytm: 0,
        ota: 0,
        refunds: 0,
        expenses: 0,
        salesRoom: 0,
        salesFb: 0,
        advances: 0,
      };
    }

    const payments = await Payment.find(query);
    payments.forEach(p => {
      const anyP = p as any;
      const day = new Date(anyP.createdAt).getDate();
      const amount = p.amount;
      
      const method = (p.method || "").toUpperCase();
      if (method.includes("CASH")) dailyData[day].cash += amount;
      else if (method.includes("CARD")) dailyData[day].card += amount;
      else if (method.includes("UPI")) dailyData[day].upi += amount;
      else if (method.includes("PAYTM")) dailyData[day].paytm += amount;
      else dailyData[day].ota += amount;

      if (anyP.purpose === "ADVANCE") {
        dailyData[day].advances += amount;
      }
    });

    const folios = await FolioLine.find({ ...query, direction: FolioLineDirection.DEBIT });
    folios.forEach(f => {
      const anyF = f as any;
      const day = new Date(anyF.createdAt).getDate();
      if (anyF.lineType === "ROOM_CHARGE") dailyData[day].salesRoom += f.amount;
      else if (anyF.lineType === "POS_CHARGE") dailyData[day].salesFb += f.amount;
    });

    // Compute totals per row
    Object.values(dailyData).forEach(row => {
      row.dayTotal = row.cash + row.card + row.upi + row.paytm + row.ota;
      row.grandTotal = row.dayTotal - row.refunds - row.expenses;
      row.salesTotal = row.salesRoom + row.salesFb;
      row.difference = row.grandTotal - row.salesTotal;
    });

    return res.json({
      success: true,
      data: Object.values(dailyData)
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDynamicReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const range = req.query.range as string || "today";
    
    // Set date bounds
    const now = new Date();
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let dateQuery: any = { $gte: startDate, $lte: endDate };
    let createdAtQuery: any = { createdAt: dateQuery };

    if (range === "all-time") {
      dateQuery = {};
      createdAtQuery = {};
    } else if (range === "yesterday") {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      dateQuery = { $gte: startDate, $lte: endDate };
      createdAtQuery = { createdAt: dateQuery };
    } else if (range === "this-week") {
      startDate.setDate(startDate.getDate() - startDate.getDay());
      dateQuery = { $gte: startDate, $lte: endDate };
      createdAtQuery = { createdAt: dateQuery };
    } else if (range === "this-month") {
      startDate.setDate(1);
      dateQuery = { $gte: startDate, $lte: endDate };
      createdAtQuery = { createdAt: dateQuery };
    } else if (range === "last-month") {
      startDate.setMonth(startDate.getMonth() - 1, 1);
      endDate.setMonth(endDate.getMonth(), 0);
      dateQuery = { $gte: startDate, $lte: endDate };
      createdAtQuery = { createdAt: dateQuery };
    }

    let kpis = {};
    let table: any[] = [];
    
    // Helpers for fields that use dateQuery
    const dateField = range === "all-time" ? {} : { date: dateQuery };
    const checkInField = range === "all-time" ? {} : { checkInDate: dateQuery };
    const checkOutField = range === "all-time" ? {} : { checkOutDate: dateQuery };

    switch (reportId) {
      case "daily-summary": {
        const [totalRooms, inHouse, arrivals, departures, salesLines] = await Promise.all([
          Room.countDocuments(),
          Booking.countDocuments({ status: BookingStatus.CHECKED_IN }),
          Booking.countDocuments(checkInField),
          Booking.countDocuments(checkOutField),
          FolioLine.find({ ...dateField, direction: FolioLineDirection.DEBIT })
        ]);

        let roomRevenue = 0, restaurantRevenue = 0;
        for (const line of salesLines as any[]) {
           if (line.lineType === "ROOM_CHARGE") roomRevenue += line.amount;
           else if (line.lineType === "POS_CHARGE") restaurantRevenue += line.amount;
        }

        kpis = {
          TotalRooms: totalRooms,
          OccupiedRooms: inHouse,
          Arrivals: arrivals,
          Departures: departures,
          DailyRevenue: roomRevenue + restaurantRevenue
        };

        table = [
          { Metric: "Room Revenue", Value: `₹${roomRevenue.toLocaleString('en-IN')}` },
          { Metric: "F&B Revenue", Value: `₹${restaurantRevenue.toLocaleString('en-IN')}` },
          { Metric: "Pending Arrivals", Value: arrivals },
          { Metric: "Pending Departures", Value: departures }
        ];
        break;
      }
      
      case "management-summary": {
        const [totalRooms, inHouse, dirtyRooms, unresolvedTickets] = await Promise.all([
          Room.countDocuments(),
          Booking.countDocuments({ status: BookingStatus.CHECKED_IN }),
          Room.countDocuments({ housekeepingStatus: HousekeepingRoomStatus.DIRTY }),
          MaintenanceTicket.countDocuments({ status: { $ne: MaintenanceStatus.RESOLVED } })
        ]);

        kpis = {
          OccupancyPercentage: totalRooms ? Math.round((inHouse/totalRooms)*100) + '%' : '0%',
          RoomsToClean: dirtyRooms,
          PendingMaintenance: unresolvedTickets,
          ActiveGuests: inHouse
        };

        table = [
          { Department: "Front Office", Status: "Active", Focus: "Guest Check-ins" },
          { Department: "Housekeeping", Status: dirtyRooms > 0 ? "Busy" : "Clear", Focus: `${dirtyRooms} rooms pending` },
          { Department: "Maintenance", Status: unresolvedTickets > 0 ? "Action Required" : "Clear", Focus: `${unresolvedTickets} tickets open` },
          { Department: "Restaurant", Status: "Active", Focus: "Normal Operations" }
        ];
        break;
      }

      case "executive": {
        const [salesLines, payments, advances] = await Promise.all([
          FolioLine.find({ ...dateField, direction: FolioLineDirection.DEBIT }),
          Payment.find(createdAtQuery),
          AdvancePayment.find(createdAtQuery)
        ]);

        let roomRevenue = 0, restaurantRevenue = 0, taxes = 0;
        for (const line of salesLines as any[]) {
           if (line.lineType === "ROOM_CHARGE") roomRevenue += line.amount;
           else if (line.lineType === "POS_CHARGE") restaurantRevenue += line.amount;
           else if (line.lineType.startsWith("TAX_")) taxes += line.amount;
        }

        const totalPayments = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        const totalAdvances = advances.reduce((acc, p: any) => acc + (p.amount || 0), 0);

        kpis = {
          GrossRevenue: roomRevenue + restaurantRevenue + taxes,
          NetRevenue: roomRevenue + restaurantRevenue,
          TaxesCollected: taxes,
          PaymentsCollected: totalPayments,
          AdvancesHeld: totalAdvances
        };

        table = [
          { Category: "Room Revenue", Gross: roomRevenue, Tax: taxes * 0.8, Net: roomRevenue - (taxes*0.8) },
          { Category: "F&B Revenue", Gross: restaurantRevenue, Tax: taxes * 0.2, Net: restaurantRevenue - (taxes*0.2) },
          { Category: "Cash Flow (Payments)", Gross: totalPayments, Tax: 0, Net: totalPayments },
          { Category: "Cash Flow (Advances)", Gross: totalAdvances, Tax: 0, Net: totalAdvances }
        ];
        break;
      }
      case "rooms": {
        const rooms = await Room.find().lean();
        
        const clean = rooms.filter((r: any) => r.housekeepingStatus === "CLEAN").length;
        const dirty = rooms.filter((r: any) => r.housekeepingStatus === "DIRTY").length;
        const ooo = rooms.filter((r: any) => r.sellStatus === "OUT_OF_ORDER").length;
        const oos = rooms.filter((r: any) => r.sellStatus === "OUT_OF_SERVICE").length;

        kpis = {
           TotalRooms: rooms.length,
           CleanRooms: clean,
           DirtyRooms: dirty,
           OutOfOrder: ooo,
           OutOfService: oos
        };
        
        table = rooms.map((r: any) => ({
           RoomNumber: r.roomNumber,
           Category: r.category,
           SellStatus: r.sellStatus,
           Housekeeping: r.housekeepingStatus || 'CLEAN',
           Maintenance: r.maintenanceStatus || 'OK'
        }));
        break;
      }
      
      case "occupancy": {
        const [rooms, inHouse, arrivals] = await Promise.all([
          Room.find().lean(),
          Booking.find({ status: BookingStatus.CHECKED_IN }).populate("assignedRoom").lean(),
          Booking.countDocuments(checkInField)
        ]);
        
        kpis = {
           TotalRooms: rooms.length,
           OccupiedRooms: inHouse.length,
           OccupancyRate: rooms.length ? Math.round((inHouse.length/rooms.length)*100) + '%' : '0%',
           PendingArrivals: arrivals
        };
        
        table = inHouse.map((b: any) => ({
           Room: b.assignedRoom?.roomNumber || 'Unassigned',
           Guest: b.guestDetails?.firstName ? `${b.guestDetails.firstName} ${b.guestDetails.lastName}` : 'Unknown',
           Adults: b.adults,
           CheckIn: b.checkInDate,
           CheckOut: b.checkOutDate
        }));
        break;
      }
      case "bookings": {
        const bookings = await Booking.find(createdAtQuery).lean();
        kpis = {
           TotalBookings: bookings.length,
           Confirmed: bookings.filter((b: any) => b.status === BookingStatus.CONFIRMED).length,
           CheckedIn: bookings.filter((b: any) => b.status === BookingStatus.CHECKED_IN).length,
           Cancelled: bookings.filter((b: any) => b.status === BookingStatus.CANCELLED).length,
        };
        table = bookings.map((b: any) => ({
           BookingNumber: b.bookingReference || b._id,
           Guest: b.guestDetails?.firstName ? `${b.guestDetails.firstName} ${b.guestDetails.lastName}` : 'Unknown',
           CheckIn: b.checkInDate,
           CheckOut: b.checkOutDate,
           TotalAmount: b.totalAmount,
           Status: b.status
        }));
        break;
      }
      case "sales": {
        const lines = await FolioLine.find({ ...dateField, direction: FolioLineDirection.DEBIT }).lean();
        let roomSales = 0, posSales = 0, tax = 0;
        lines.forEach((l: any) => {
           if (l.lineType === "ROOM_CHARGE") roomSales += l.amount;
           else if (l.lineType === "RESTAURANT") posSales += l.amount;
           else if (l.lineType.startsWith("TAX_")) tax += l.amount;
        });
        kpis = {
           RoomSales: roomSales,
           RestaurantSales: posSales,
           TotalTax: tax,
           TotalGrossSales: roomSales + posSales + tax
        };
        table = lines.map((l: any) => ({
           Date: l.date,
           Description: l.description,
           Type: l.lineType,
           Amount: l.amount
        }));
        break;
      }
      case "payments": {
        const payments = await Payment.find(createdAtQuery).lean();
        let cash = 0, card = 0, upi = 0;
        payments.forEach((p: any) => {
           if (p.method === "CASH") cash += p.amount;
           else if (p.method === "CARD") card += p.amount;
           else if (p.method === "UPI") upi += p.amount;
        });
        kpis = {
           TotalReceived: cash + card + upi,
           CashReceived: cash,
           CardReceived: card,
           UpiReceived: upi,
           TransactionCount: payments.length
        };
        table = payments.map((p: any) => ({
           Reference: p.transactionId || p._id,
           Amount: p.amount,
           Method: p.method,
           Status: p.status,
           Date: p.createdAt || p.date
        }));
        break;
      }
      
      case "cashier": {
        const shifts = await CashierShift.find(createdAtQuery).populate('user').lean();
        let discrepancies = 0;
        let totalDeclared = 0;
        shifts.forEach((s: any) => {
           totalDeclared += (s.declaredCash || 0);
           if (s.cashDiscrepancy && s.cashDiscrepancy !== 0) discrepancies++;
        });
        
        kpis = {
           TotalShifts: shifts.length,
           OpenShifts: shifts.filter((s: any) => s.status === 'OPEN').length,
           TotalDeclaredCash: totalDeclared,
           ShiftsWithDiscrepancy: discrepancies
        };
        
        table = shifts.map((s: any) => ({
           Cashier: s.user?.firstName ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown',
           Status: s.status,
           OpeningBalance: s.openingBalance,
           DeclaredCash: s.declaredCash || 0,
           Discrepancy: s.cashDiscrepancy || 0
        }));
        break;
      }
      
      case "cash-sheet": {
        const cashPayments = await Payment.find({ ...createdAtQuery, method: "CASH" }).lean();
        const totalCash = cashPayments.reduce((acc, p: any) => acc + (p.amount || 0), 0);
        
        kpis = {
           TotalCashTransactions: cashPayments.length,
           TotalCashVolume: totalCash,
           AverageTransactionSize: cashPayments.length > 0 ? Math.round(totalCash / cashPayments.length) : 0
        };
        
        table = cashPayments.map((p: any) => ({
           Time: p.createdAt,
           Reference: p.transactionId || p._id,
           Purpose: p.purpose || 'Payment',
           Amount: p.amount,
           Status: p.status
        }));
        break;
      }
      case "advances": {
         const advances = await AdvancePayment.find(createdAtQuery).lean();
         const totalAdvances = advances.reduce((acc, p: any) => acc + (p.amount || 0), 0);
         const totalAdjusted = advances.reduce((acc, p: any) => acc + (p.totalAdjusted || 0), 0);
         
         kpis = {
           TotalReceived: totalAdvances,
           TotalUsed: totalAdjusted,
           TotalRemaining: totalAdvances - totalAdjusted,
           Count: advances.length
         };
         
         table = advances.map((a: any) => ({
            Reference: a.advanceNumber || a._id,
            Guest: a.guest ? String(a.guest) : 'Unknown',
            OriginalAmount: a.amount || 0,
            UsedAmount: a.totalAdjusted || 0,
            Remaining: a.remainingBalance || 0,
            Status: a.status
         }));
         break;
      }
      case "tax": {
        const lines = await FolioLine.find({ ...dateField, lineType: { $in: [FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST] } }).lean();
        let cgst = 0, sgst = 0, igst = 0;
        lines.forEach(l => {
           if (l.lineType === FolioLineType.TAX_CGST) cgst += l.amount;
           if (l.lineType === FolioLineType.TAX_SGST) sgst += l.amount;
           if (l.lineType === FolioLineType.TAX_IGST) igst += l.amount;
        });
        kpis = {
           TotalTax: cgst + sgst + igst,
           TotalCGST: cgst,
           TotalSGST: sgst,
           TotalIGST: igst
        };
        table = lines.map(l => ({
           Description: l.description,
           Type: l.lineType,
           Amount: l.amount,
           Date: l.date
        }));
        break;
      }
      case "guest-bills": {
        const folios = await Folio.find(createdAtQuery).lean();
        kpis = { TotalFolios: folios.length };
        table = folios.map((f: any) => ({
           FolioNumber: f.folioNumber || f._id,
           Status: f.status,
           Balance: f.balance || 0,
           CreatedAt: f.createdAt
        }));
        break;
      }
      case "restaurant": {
        const orders = await RestaurantOrder.find(createdAtQuery).lean();
        kpis = { TotalOrders: orders.length, TotalRevenue: orders.reduce((acc, o: any) => acc + (o.totalAmount || 0), 0) };
        table = orders.map((o: any) => ({
           OrderNumber: o.orderNumber || o._id,
           Table: o.tableNumber || 'N/A',
           Status: o.status,
           Total: o.totalAmount,
           Date: o.createdAt
        }));
        break;
      }
      case "housekeeping": {
        const tasks = await HousekeepingTask.find(createdAtQuery).lean();
        kpis = { TotalTasks: tasks.length, Completed: tasks.filter((t: any) => t.status === 'COMPLETED').length };
        table = tasks.map((t: any) => ({
           Room: t.room ? String(t.room) : 'General',
           TaskType: t.taskType,
           Status: t.status,
           Priority: t.priority,
           Date: t.createdAt
        }));
        break;
      }
      case "maintenance": {
        const tickets = await MaintenanceTicket.find(createdAtQuery).lean();
        kpis = { TotalTickets: tickets.length, Resolved: tickets.filter((t: any) => t.status === 'RESOLVED').length };
        table = tickets.map((t: any) => ({
           Issue: t.issueType || t.title,
           Room: t.room ? String(t.room) : 'General',
           Status: t.status,
           Priority: t.priority,
           Date: t.createdAt
        }));
        break;
      }
      case "inventory": {
        const items = await InventoryItem.find().lean();
        kpis = { TotalItems: items.length, LowStock: items.filter((i: any) => i.quantity <= i.minThreshold).length };
        table = items.map((i: any) => ({
           Item: i.name,
           Category: i.category,
           Quantity: i.quantity,
           Threshold: i.minThreshold,
           Unit: i.unit
        }));
        break;
      }
      case "procurement": {
        const orders = await PurchaseOrder.find(createdAtQuery).lean();
        kpis = { TotalPOs: orders.length, TotalAmount: orders.reduce((acc, o: any) => acc + (o.totalAmount || 0), 0) };
        table = orders.map((o: any) => ({
           PONumber: o.poNumber || o._id,
           Vendor: o.vendor ? String(o.vendor) : 'Unknown',
           Status: o.status,
           Total: o.totalAmount,
           Date: o.createdAt
        }));
        break;
      }
      case "corporate": {
        const accounts = await CorporateAccount.find().lean();
        kpis = { TotalAccounts: accounts.length };
        table = accounts.map((a: any) => ({
           Company: a.companyName,
           Code: a.corporateCode,
           Contact: a.contactPerson,
           Email: a.email,
           Phone: a.phone
        }));
        break;
      }
      case "night-audit": {
        const lines = await FolioLine.find(createdAtQuery).lean();
        kpis = { TotalPostings: lines.length, RevenuePosted: lines.filter((l: any) => l.direction === 'DEBIT').reduce((acc, l: any) => acc + (l.amount || 0), 0) };
        table = lines.map((l: any) => ({
           Date: l.date,
           Description: l.description,
           Amount: l.amount,
           Type: l.lineType
        }));
        break;
      }
      default:
        kpis = { Info: `Report ${reportId} is partially implemented or empty for this date range.` };
        table = [];
    }
    
    return res.json({ success: true, data: { kpis, table, range } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

