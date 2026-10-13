import { Request, Response } from "express";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, HousekeepingRoomStatus } from "../models/Room";
import { AdvancePayment } from "../models/AdvancePayment";
import { RestaurantOrder } from "../models/RestaurantOrder";
import { Complaint } from "../models/Complaint";
import { Payment } from "../models/Payment";

import { Folio } from "../models/Folio";
import { HousekeepingTask } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";

import { CorporateAccount } from "../models/CorporateAccount";
import { CashierShift } from "../models/CashierShift";
import {
  addDays,
  businessDayRange,
  businessMonthRange,
  daysBetween,
  endOfBusinessMonth,
  isBusinessDate,
  nights as countNights,
  PROPERTY_TIMEZONE,
  startOfBusinessMonth,
  startOfBusinessWeek,
  stayNights,
  toBusinessDate,
  todayBusinessDate,
} from "../../../shared/dates";

/** [start, endInclusive] of a business date at the property, for $gte/$lte queries. */
function dayBounds(ymd: string) {
  const r = businessDayRange(ymd);
  return { start: r.start, end: new Date(r.end.getTime() - 1) };
}
/** A ?date-style query value as a business date (YYYY-MM-DD), or the fallback. */
function ymdParam(value: unknown, fallback: string = todayBusinessDate()): string {
  if (isBusinessDate(value)) return value;
  return value ? toBusinessDate(String(value)) : fallback;
}
/** Day of month (1-31) of an instant at the property. */
const bizDayOfMonth = (d: Date | string) => Number(toBusinessDate(d).slice(8, 10));

/**
 * GET /api/admin/reports/overview?dateFrom&dateTo
 * Overview stats for the admin Reports page (client/pages/admin/AdminReports.tsx).
 *
 * Rewritten from a stub that ignored dateFrom/dateTo entirely and returned
 * only {totalBookings, checkedInBookings, totalRooms, totalAdvanceHeld} â€”
 * the frontend has always expected revenue/adr/revPAR/occupancyRate/
 * cancellationRate/categoryPerformance/range, none of which the stub
 * provided, so this page has been throwing a runtime TypeError
 * (`Cannot read properties of undefined (reading 'toLocaleString')`) on
 * every load. Confirmed live during this audit.
 *
 * "Bookings in range" = bookings whose stay starts (checkInDate) in
 * [dateFrom, dateTo] â€” the standard "arrivals for period" framing for this
 * kind of dashboard. Revenue/ADR/RevPAR exclude CANCELLED bookings.
 */
export const getReportsOverview = async (req: Request, res: Response) => {
  try {
    // Business dates at the property; `to` is inclusive of its whole day.
    const toYmd = ymdParam(req.query.dateTo);
    const fromYmd = ymdParam(req.query.dateFrom, addDays(toYmd, -30));
    const from = dayBounds(fromYmd).start;
    const toInclusive = dayBounds(toYmd).end;

    const rangeMatch = { checkInDate: { $gte: from, $lte: toInclusive } };
    const daysInRange = Math.max(1, daysBetween(fromYmd, toYmd) + 1);

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
                  // Same rule as shared nights(): calendar-date changes at the property, not 24h periods.
                  { $dateDiff: { startDate: "$checkInDate", endDate: "$checkOutDate", unit: "day", timezone: PROPERTY_TIMEZONE } },
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
    const todayYmd = todayBusinessDate();
    const since = dayBounds(addDays(todayYmd, -(days - 1))).start;

    const pipeline: any[] = [
      { $match: { direction: FolioLineDirection.DEBIT, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: PROPERTY_TIMEZONE } },
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
    // Continuous series of business dates (no gaps, no future dates).
    for (let i = days - 1; i >= 0; i--) {
      const key = addDays(todayYmd, -i);
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
    const since = dayBounds(addDays(todayBusinessDate(), -30)).start;

    const bookings = await Booking.find({
      status: { $in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
      checkInDate: { $gte: since },
    }).lean();

    const map: Record<string, number> = {};
    for (const b of bookings) {
      // One room-night per business date of the stay.
      for (const key of stayNights(b.checkInDate, b.checkOutDate)) {
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
    const todayYmd = todayBusinessDate();
    const today = dayBounds(todayYmd).start;
    const monthStart = businessMonthRange(todayYmd).start;

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
    // Occupancy from the room-status snapshot: occupied rooms / sellable rooms (same as every board).
    const { getSnapshot } = await import("../services/room-status.service");
    const occupancyPct = (await getSnapshot(todayYmd)).summary.occupancyPct;

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
 * Once entered, guests are NEVER removed upon checkout; their actual
 * checkout time and settlement details are updated.
 */
export const getInHouseList = async (req: Request, res: Response) => {
  try {
    const dateParam = req.query.date as string;
    const { start: startOfDay, end: endOfDay } = dayBounds(ymdParam(dateParam));

    // Active in-house stays + any guests who checked out today or were in-house today.
    // Once entered in the physical logbook, entries are NEVER deleted upon checkout!
    const bookings = await Booking.find({
      $or: [
        { status: BookingStatus.CHECKED_IN },
        {
          status: BookingStatus.CHECKED_OUT,
          $or: [
            { checkedOutAt: { $gte: startOfDay, $lte: endOfDay } },
            { checkOutDate: { $gte: startOfDay, $lte: endOfDay } },
            { checkedInAt: { $gte: startOfDay, $lte: endOfDay } },
            { checkInDate: { $gte: startOfDay, $lte: endOfDay } },
          ],
        },
      ],
    })
      .populate("assignedRoom", "roomNumber")
      .lean();

    const companyIds = bookings.map((b: any) => b.company).filter(Boolean);
    const corporateMap = new Map<string, string>();
    if (companyIds.length > 0) {
      try {
        const companies = await CorporateAccount.find({ _id: { $in: companyIds } }).lean();
        companies.forEach((c: any) => corporateMap.set(c._id.toString(), c.companyName));
      } catch (e) {
        // Fallback gracefully
      }
    }

    const data = await Promise.all(
      bookings.map(async (booking: any) => {
        // Aggregate folio details (Extra Bed, Food Bill, Advance, Payments)
        let folioLines: any[] = [];
        try {
          if (booking.folio) {
            folioLines = await FolioLine.find({ $or: [{ folio: booking.folio }, { booking: booking._id }] }).lean();
          } else {
            folioLines = await FolioLine.find({ booking: booking._id }).lean();
          }
        } catch (e) {
          folioLines = [];
        }
        
        let extraBedCount = 0;
        let foodBill = 0;
        let advance = 0;
        let settled = 0;
        const paymentModes = new Set<string>();
        let balance = 0;

        folioLines.forEach((line: any) => {
          if (line.lineType === FolioLineType.EXTRA_BED && line.direction === FolioLineDirection.DEBIT) {
            extraBedCount++;
          } else if (line.lineType === FolioLineType.RESTAURANT && line.direction === FolioLineDirection.DEBIT) {
            foodBill += (line.amount || 0);
          } else if (line.lineType === FolioLineType.ADVANCE_ADJUSTMENT && line.direction === FolioLineDirection.CREDIT) {
            advance += (line.amount || 0);
          } else if (line.lineType === FolioLineType.PAYMENT && line.direction === FolioLineDirection.CREDIT) {
            settled += (line.amount || 0);
            if (line.notes) paymentModes.add(line.notes.split(" ")[0]);
          }

          if (line.direction === FolioLineDirection.DEBIT) balance += (line.amount || 0);
          else if (line.direction === FolioLineDirection.CREDIT) balance -= (line.amount || 0);
        });

        try {
          const payments = await Payment.find({ booking: booking._id }).lean();
          payments.forEach((p: any) => {
            if (p.method) paymentModes.add(p.method);
          });
        } catch (e) {
          // ignore
        }

        try {
          let advanceTotal = 0;
          const advances = await AdvancePayment.find({ booking: booking._id }).lean();
          advances.forEach((a: any) => advanceTotal += (a.amount || 0));
          advance = Math.max(advance, advanceTotal);
        } catch (e) {
          // ignore
        }

        if (settled === 0 && (booking.paidAmount || 0) > 0) {
          settled = booking.paidAmount;
        }

        if (booking.status === BookingStatus.CHECKED_OUT && (booking.paymentStatus === PaymentStatus.PAID || booking.paymentStatus === "PAID")) {
          balance = 0;
        }

        // Calculate nights
        const checkIn = booking.checkInDate ? new Date(booking.checkInDate) : new Date();
        const checkOut = booking.checkOutDate ? new Date(booking.checkOutDate) : new Date();
        const nights = Math.max(1, countNights(checkIn, checkOut) || 1);

        // Tariff = Base Room Charge per night
        const tariff = booking.ratePerNight ?? (nights > 0 ? Math.round((booking.totalAmount || 0) / nights) : 0);

        const checkInTimeDisplay = booking.checkedInAt || booking.checkInDate;
        const checkOutTimeDisplay = booking.status === BookingStatus.CHECKED_OUT
          ? (booking.checkedOutAt || booking.checkOutDate)
          : booking.checkOutDate;

        const companyName = booking.company ? corporateMap.get(booking.company.toString()) : null;
        const companyGroup = companyName || booking.guestDetails?.organization || booking.groupId?.toString() || booking.source || "Direct";

        return {
          _id: booking._id,
          status: booking.status,
          grcNo: booking.bookingReference || "—",
          roomNo: booking.assignedRoom?.roomNumber || "—",
          guestName: `${booking.guestDetails?.firstName || ""} ${booking.guestDetails?.lastName || ""}`.trim() || "Guest",
          companyGroup,
          adults: booking.adults || 1,
          childKids: booking.children || 0,
          tariff: Math.round(tariff || 0),
          plan: booking.ratePlan || booking.mealPlan || "EP",
          extraBed: extraBedCount || (booking.extraPersonsWithBed ? 1 : 0),
          foodBill: Math.round(foodBill || 0),
          checkedIn: checkInTimeDisplay,
          checkOut: checkOutTimeDisplay,
          nights,
          advance: Math.round(advance || 0),
          balance: Math.max(0, Math.round(balance || 0)),
          settled: Math.round(settled || 0),
          paymentMode: Array.from(paymentModes).join(", ") || booking.paymentMethod || "-",
          discountAmount: booking.discountAmount || 0,
          appliedCoupon: booking.appliedCoupon || "-",
        };
      })
    );

    // Sort by Room Number safely
    data.sort((a, b) => String(a.roomNo || "").localeCompare(String(b.roomNo || ""), undefined, { numeric: true }));

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reports/day-summary?date=YYYY-MM-DD
 * Replicates the "YH - Day Sales Summary" and "CASH Sheet" PDF structure.
 * Accepts optional ?date param (defaults to today).
 */
export const getDaySummary = async (req: Request, res: Response) => {
  try {
    // Support ?date=YYYY-MM-DD param (default: today)
    const targetYmd = ymdParam(req.query.date);
    const targetDate = dayBounds(targetYmd).start;
    const { start: dayStart, end: dayEnd } = dayBounds(targetYmd);
    // A date-range condition only; property scoping is propertyMatch below (putting
    // propertyId inside this operator object made Mongo reject the query).
    const dayQuery: any = { $gte: dayStart, $lte: dayEnd };

    // 1. Fetch relevant bookings for the day
    // We add propertyId to the queries.
    const propertyMatch = (req as any).propertyId ? { propertyId: (req as any).propertyId } : {};
    
    const [checkIns, checkOuts, dayUses, activeBookings, cancelledCount, noShowCount, totalRooms] = await Promise.all([
      Booking.find({ ...propertyMatch, checkInDate: dayQuery }),
      Booking.find({ ...propertyMatch, checkOutDate: dayQuery }),
      Booking.find({ ...propertyMatch, stayType: "HOURLY", createdAt: dayQuery }),
      Booking.find({ ...propertyMatch, status: BookingStatus.CHECKED_IN }),
      Booking.countDocuments({ ...propertyMatch, status: BookingStatus.CANCELLED, updatedAt: dayQuery }),
      Booking.countDocuments({ ...propertyMatch, status: BookingStatus.NO_SHOW, updatedAt: dayQuery }),
      Room.countDocuments(propertyMatch),
    ]);

    const totalPax = activeBookings.reduce((sum, b) => sum + (b.adults || 1) + (b.children || 0), 0);
    const occupiedOnTarget =
      targetYmd === todayBusinessDate()
        ? (await (await import("../services/room-status.service")).getSnapshot(targetYmd)).summary.occupied
        : await Booking.countDocuments({
            ...propertyMatch,
            status: { $in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
            checkInDate: { $lte: dayEnd },
            checkOutDate: { $gt: dayEnd },
          });

    // Through channels
    const walkins = checkIns.filter(b => b.source === "WALK_IN").length;
    const otas = checkIns.filter(b => b.source === "OTA").length;
    const agencies = checkIns.filter(b => b.source === "CORPORATE").length;

    // 2. Fetch payments for the day
    const todayPayments = await Payment.find({ ...propertyMatch, createdAt: dayQuery });

    let resrvAdv = 0, roomAdv = 0, partial = 0, final = 0, advAdjd = 0;
    const paymentModes: Record<string, number> = {
      CASH: 0, UPI: 0, CARD: 0, PAYTM: 0, HDFC: 0, OTA_CREDIT: 0
    };

    todayPayments.forEach(p => {
      const anyP = p as any;
      if (anyP.purpose === "ADVANCE") {
        const b = checkIns.find(cb => cb._id.toString() === p.booking?.toString());
        if (b) roomAdv += p.amount;
        else resrvAdv += p.amount;
      } else if (anyP.purpose === "SETTLEMENT") {
        final += p.amount;
      } else {
        partial += p.amount;
      }

      const mode = (p.method || 'UNKNOWN').toUpperCase();
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

    const roomSalesTotal = paymentModes.CASH + paymentModes.UPI + paymentModes.CARD + paymentModes.PAYTM;

    return res.json({
      success: true,
      data: {
        date: dayStart.toISOString(),
        // -- Flat fields expected by DaySummaryTab --
        totalRooms,
        checkIns: checkIns.length,
        checkOuts: checkOuts.length,
        dayUses: dayUses.length,
        // Rooms occupied on the target date: the room-status snapshot for today; for a past date,
        // stays (in-house or departed) that covered that night.
        occupiedRooms: occupiedOnTarget,
        totalPax,
        cancelled: cancelledCount,
        noShows: noShowCount,
        inquiries: 0,
        walkins,
        otas,
        agencies,
        resrvAdv,
        roomAdv,
        partial,
        final,
        advAdjd,
        paymentModes,
        salesRoom: roomSalesTotal,
        misc: 0,
        // -- Aliases used by DaySummaryReport.tsx --
        checkIn: checkIns.length,
        checkOut: checkOuts.length,
        dayUse: dayUses.length,
        occupancy: occupiedOnTarget,
        pax: totalPax,
        noShow: noShowCount,
        walkin: walkins,
        ota: otas,
        agency: agencies,
        auto: 0,
        cash: paymentModes.CASH,
        paytm: paymentModes.PAYTM,
        hdfcUpi: paymentModes.UPI + paymentModes.HDFC,
        otaCredit: paymentModes.OTA_CREDIT,
        credits: resrvAdv + roomAdv + partial + final,
        roomSales: roomSalesTotal,
        miscSales: 0,
        // -- Nested structure (kept for CashSheetReport backward compat) --
        page1: {
          rooms: { checkIn: checkIns.length, checkOut: checkOuts.length, dayUse: dayUses.length },
          occupancy: { room: occupiedOnTarget, pax: totalPax },
          status: { cancelled: cancelledCount, noShow: noShowCount, noOfInquiry: 0 },
          through: { walkin: walkins, ota: otas, agency: agencies, auto: 0 },
          receipts: { resrvAdv, roomAdv, partial, final, advAdjd },
          modes: paymentModes
        },
        page2: {
          openingBalance: 0,
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
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : todayBusinessDate().slice(0, 7);
    const [year, m] = month.split('-');

    // Month boundaries at the property (Asia/Kolkata).
    const monthRange = businessMonthRange(month);
    const startOfMonth = monthRange.start;
    const endOfMonth = new Date(monthRange.end.getTime() - 1);

    const daysInMonth = Number(endOfBusinessMonth(`${month}-01`).slice(8, 10));
    const query = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };

    // Grouping by day mapping
    const dailyData: Record<number, any> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      const ymd = `${month}-${String(i).padStart(2, "0")}`;
      dailyData[i] = {
        date: ymd, // business date (YYYY-MM-DD)
        day: new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-US", { weekday: "short", timeZone: PROPERTY_TIMEZONE }),
        cash: 0,
        card: 0,
        upi: 0,
        paytm: 0,
        ota: 0,
        otaMmt: 0,
        otaAgoda: 0,
        otaBooking: 0,
        otaGoibibo: 0,
        refunds: 0,
        expenses: 0,
        salesRoom: 0,
        salesFb: 0,
        advances: 0,
        advancesAdj: 0,
        advancesUnadj: 0,
      };
    }

    const payments = await Payment.find(query).populate("booking");
    payments.forEach(p => {
      const anyP = p as any;
      const day = bizDayOfMonth(anyP.createdAt);
      const amount = p.amount;
      
      const method = (p.method || "").toUpperCase();
      if (method.includes("CASH")) dailyData[day].cash += amount;
      else if (method.includes("CARD")) dailyData[day].card += amount;
      else if (method.includes("UPI")) dailyData[day].upi += amount;
      else if (method.includes("PAYTM")) dailyData[day].paytm += amount;
      else {
        dailyData[day].ota += amount;
        // Check what OTA it is
        const otaName = (anyP.booking?.otaName || "").toUpperCase();
        if (otaName.includes("MAKEMYTRIP") || otaName.includes("MMT")) dailyData[day].otaMmt += amount;
        else if (otaName.includes("AGODA")) dailyData[day].otaAgoda += amount;
        else if (otaName.includes("BOOKING")) dailyData[day].otaBooking += amount;
        else if (otaName.includes("GOIBIBO")) dailyData[day].otaGoibibo += amount;
      }

      if (anyP.purpose === "ADVANCE") {
        dailyData[day].advances += amount;
        dailyData[day].advancesUnadj += amount; // We'll assume unadjusted for raw Payment advances unless updated below
      }
    });

    const advances = await AdvancePayment.find({ receivedAt: { $gte: startOfMonth, $lte: endOfMonth } });
    advances.forEach(a => {
      const day = bizDayOfMonth(a.receivedAt);
      const amt = a.amount;
      const adj = a.totalAdjusted || 0;
      dailyData[day].advances += amt;
      dailyData[day].advancesAdj += adj;
      dailyData[day].advancesUnadj += (amt - adj);
    });

    const folios = await FolioLine.find({ ...query, direction: FolioLineDirection.DEBIT });
    folios.forEach(f => {
      const anyF = f as any;
      const day = bizDayOfMonth(anyF.createdAt);
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
    
    // Date bounds as business dates at the property (Asia/Kolkata), inclusive.
    const now = new Date();
    const todayYmd = todayBusinessDate();
    let fromYmd = todayYmd;
    let toYmd = todayYmd;
    if (range === "yesterday") {
      fromYmd = toYmd = addDays(todayYmd, -1);
    } else if (range === "this-week") {
      fromYmd = startOfBusinessWeek(todayYmd);
    } else if (range === "this-month") {
      fromYmd = startOfBusinessMonth(todayYmd);
    } else if (range === "last-month") {
      fromYmd = startOfBusinessMonth(addDays(startOfBusinessMonth(todayYmd), -1));
      toYmd = endOfBusinessMonth(fromYmd);
    }
    const startDate = dayBounds(fromYmd).start;
    const endDate = dayBounds(toYmd).end;

    let dateQuery: any = { $gte: startDate, $lte: endDate };
    let createdAtQuery: any = { createdAt: dateQuery };
    if (range === "all-time") {
      dateQuery = {};
      createdAtQuery = {};
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
          { Metric: "Room Revenue", Value: `â‚¹${roomRevenue.toLocaleString('en-IN')}` },
          { Metric: "F&B Revenue", Value: `â‚¹${restaurantRevenue.toLocaleString('en-IN')}` },
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

