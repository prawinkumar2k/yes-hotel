import { Request, Response } from "express";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";
import { Room, SellStatus } from "../models/Room";
import { Booking, BookingStatus } from "../models/Booking";
import { Payment } from "../models/Payment";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { CorporateAccount } from "../models/CorporateAccount";
import { BanquetBooking, BanquetStatus } from "../models/BanquetBooking";
import { BusinessDate } from "../models/BusinessDate";
import { Folio, FolioStatus } from "../models/Folio";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { Complaint } from "../models/Complaint";
import { Guest } from "../models/Guest";
import { User } from "../models/User";
void User.modelName;
import { addDays as addBizDays, businessDayRange, businessMonthRange, todayBusinessDate, PROPERTY_TIMEZONE } from "../../../shared/dates";

// Data scoping per section uses CAP.CC_* capabilities from config/permissions.ts.
import { PermissionService } from "../services/PermissionService";
import { getSnapshot } from "../services/room-status.service";

const CC_CAPS = ["CC_FINANCE", "CC_FRONT_OFFICE", "CC_OPERATIONS", "CC_RESTAURANT", "CC_CORPORATE", "CC_FORECAST", "CC_APPROVALS"] as const;

export const getCommandCenterData = async (req: Request, res: Response) => {
  try {
    const role = req.user?.role || "CUSTOMER";
    const caps: Record<(typeof CC_CAPS)[number], boolean> = Object.fromEntries(
      await Promise.all(CC_CAPS.map(async (c) => [c, await PermissionService.can(req.user, `CAP.${c}`)] as const))
    ) as any;
    // Day/month boundaries at the property (Asia/Kolkata), independent of the server timezone.
    const todayYmd = todayBusinessDate();
    const { start: startToday, end: endOfTodayExclusive } = businessDayRange(todayYmd);
    const endToday = new Date(endOfTodayExclusive.getTime() - 1);
    const startMonth = businessMonthRange(todayYmd).start;
    const endOfBizDay = (offsetDays: number) => new Date(businessDayRange(addBizDays(todayYmd, offsetDays)).end.getTime() - 1);
    const weekday = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-US", { weekday: "short", timeZone: PROPERTY_TIMEZONE });
    
    const propertyId = (req.user as any)?.propertyId;
    const propertyFilter = propertyId ? { propertyId } : {};

    // ── 1. HOTEL PULSE (all operational roles) ──────────────────────
    // Room counts come from the single room-status snapshot (services/room-status.service.ts),
    // the same source as Front Desk, Housekeeping, Rooms, Room Rack and Reports.
    const snapshot = await getSnapshot(todayYmd, { propertyId });
    const pulse = snapshot.summary;
    const totalRooms = pulse.total;
    const dirty = pulse.dirty;
    const hotelPulse = {
      totalRooms,
      sellableRooms: pulse.sellableRooms,
      occupied: pulse.occupied,
      available: pulse.available,
      dirty: pulse.dirty,
      cleaning: pulse.cleaning,
      cleaningCompleted: pulse.cleaningCompleted,
      inspection: pulse.inspection,
      waitingRelease: 0, // folded into INSPECTION (not yet released) in the room state machine
      ooo: pulse.ooo,
      oos: pulse.oos,
      clean: pulse.clean,
      reserved: pulse.reserved,
      blocked: pulse.blocked,
      unavailable: pulse.ooo + pulse.oos + pulse.blocked,
      occupancyPct: pulse.occupancyPct,
    };

    // ── 2. FRONT OFFICE (arrivals/departures/in-house) ───────────────
    let arrivalsData: any[] = [];
    let departuresData: any[] = [];
    let inHouseData: any[] = [];

    if (caps.CC_OPERATIONS) {
      // In-house = every CHECKED_IN stay (an overdue checkout is still in-house);
      // arrivals = CONFIRMED due in today; departures = in-house due out today or overdue.
      const [inHouseStays, arrivingToday] = await Promise.all([
        Booking.find({ ...propertyFilter, status: BookingStatus.CHECKED_IN })
          .populate("assignedRoom", "roomNumber floor category").lean(),
        Booking.find({ ...propertyFilter, status: BookingStatus.CONFIRMED, checkInDate: { $gte: startToday, $lte: endToday } })
          .populate("assignedRoom", "roomNumber floor category").lean(),
      ]);
      arrivalsData = arrivingToday.slice(0, 15);
      departuresData = inHouseStays.filter((b) => new Date(b.checkOutDate) <= endToday).slice(0, 15);
      inHouseData = inHouseStays.slice(0, 20);

      // Day movements from the snapshot: "expected" by scheduled date, "actual" by the event time.
      const mv = snapshot.movements;
      const frontDeskStats = {
        expectedArrivals: mv.expectedArrivals,
        actualArrivals: mv.arrived,
        expectedDepartures: mv.expectedDepartures,
        overdueDepartures: mv.overdueDepartures,
        actualCheckouts: mv.departed,
        noShows: mv.noShows,
        cancellations: mv.cancellations,
        inHouseStays: mv.inHouseStays,
        inHouseGuests: mv.inHouseGuests,
      };

      inHouseData = { guests: inHouseData, stats: frontDeskStats } as any;
    }

    // ── 3. REVENUE (finance roles only) ─────────────────────────────
    let revenue: any = null;
    if (caps.CC_FINANCE) {
      const [todayAgg, monthAgg, pendingFolios, openCashierShifts] = await Promise.all([
        Payment.aggregate([
          { $match: { ...propertyFilter, createdAt: { $gte: startToday, $lte: endToday }, status: "COMPLETED" } },
          { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]),
        Payment.aggregate([
          { $match: { ...propertyFilter, createdAt: { $gte: startMonth }, status: "COMPLETED" } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Folio.countDocuments({ ...propertyFilter, status: FolioStatus.OPEN, balance: { $gt: 0 } }),
        CashierShift.countDocuments({ ...propertyFilter, status: CashierShiftStatus.OPEN })
      ]);

      const todayByMethod: Record<string, number> = {};
      let todayRevenue = 0;
      todayAgg.forEach((r: any) => {
        todayByMethod[r._id] = r.total;
        todayRevenue += r.total;
      });

      revenue = {
        todayRevenue,
        monthlyRevenue: monthAgg[0]?.total || 0,
        todayCash: todayByMethod["CASH"] || 0,
        todayCard: todayByMethod["CARD"] || 0,
        todayUPI: todayByMethod["UPI"] || 0,
        todayGateway: todayByMethod["GATEWAY"] || 0,
        pendingFolios,
        openCashierShifts,
        roomRevenue: todayRevenue,
        adr: pulse.occupied > 0 ? Math.round(todayRevenue / pulse.occupied) : 0, // TODO(K): room revenue, not collections
        revPar: pulse.sellableRooms > 0 ? Math.round(todayRevenue / pulse.sellableRooms) : 0,
      };
    }

    // ── 4. HOUSEKEEPING ──────────────────────────────────────────────
    const housekeepingTasks = await HousekeepingTask.find({
      ...propertyFilter,
      status: { $nin: [HousekeepingStatus.CLEAN] }
    }).populate("room", "roomNumber floor category").populate("assignedTo", "firstName lastName").lean();

    // Room counts by HK state come from the snapshot; "assigned" and "pending" describe the task workload.
    const hkByStatus = {
      dirty: pulse.dirty,
      assigned: housekeepingTasks.filter(t => t.status === "ASSIGNED").length,
      cleaning: pulse.cleaning,
      completed: pulse.cleaningCompleted,
      inspection: pulse.inspection,
      waitingRelease: 0,
    };

    const housekeeping = {
      ...hkByStatus,
      pending: housekeepingTasks.length,
      tasks: housekeepingTasks.slice(0, 20)
    };

    // ── 5. MAINTENANCE ───────────────────────────────────────────────
    const maintenanceTickets = await MaintenanceTicket.find({
      ...propertyFilter,
      status: { $nin: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] }
    }).populate("room", "roomNumber floor").lean();

    const mtByPriority = {
      critical: maintenanceTickets.filter(t => (t as any).priority === "CRITICAL").length,
      high: maintenanceTickets.filter(t => (t as any).priority === "HIGH").length,
      medium: maintenanceTickets.filter(t => (t as any).priority === "MEDIUM").length,
    };

    const maintenance = {
      open: maintenanceTickets.length,
      ...mtByPriority,
      tickets: maintenanceTickets.slice(0, 15)
    };

    // ── 6. RESTAURANT / F&B (restaurant roles only) ──────────────────
    let restaurant: any = null;
    if (caps.CC_RESTAURANT) {
      const [openOrders, todayFnBRevenue] = await Promise.all([
        RestaurantOrder.find({
          ...propertyFilter,
          status: { $nin: [OrderStatus.SERVED, OrderStatus.BILLED, OrderStatus.CANCELLED] },
          createdAt: { $gte: startToday }
        }).lean(),
        RestaurantOrder.aggregate([
          { $match: { ...propertyFilter, createdAt: { $gte: startToday, $lte: endToday }, status: { $in: [OrderStatus.SERVED, OrderStatus.BILLED] } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
        ])
      ]);

      const kotCount = openOrders.filter(o => (o as any).status === OrderStatus.KITCHEN_PENDING).length;
      const preparingCount = openOrders.filter(o => (o as any).status === OrderStatus.PREPARING).length;
      const readyCount = openOrders.filter(o => (o as any).status === OrderStatus.READY).length;
      const delayedCount = openOrders.filter(o => {
        const created = new Date((o as any).createdAt);
        const ageMinutes = (Date.now() - created.getTime()) / 60000;
        return ageMinutes > 20 && (o as any).status === OrderStatus.PREPARING;
      }).length;

      restaurant = {
        openOrders: openOrders.length,
        kot: kotCount,
        preparing: preparingCount,
        ready: readyCount,
        delayed: delayedCount,
        todayRevenue: todayFnBRevenue[0]?.total || 0,
        todayOrders: todayFnBRevenue[0]?.count || 0,
        orders: openOrders.slice(0, 10)
      };
    }


    // ── 8. CORPORATE (corporate roles) ───────────────────────────────
    let corporate: any = null;
    if (caps.CC_CORPORATE) {
      const { GroupBooking, GroupBookingStatus } = await import("../models/GroupBooking");
      const [totalAccounts, activeAccounts, activeGroupsList] = await Promise.all([
        CorporateAccount.countDocuments({ ...propertyFilter }),
        CorporateAccount.countDocuments({ ...propertyFilter, isActive: true }),
        GroupBooking.find({ ...propertyFilter, status: { $in: [GroupBookingStatus.CONFIRMED, GroupBookingStatus.CHECKED_IN, GroupBookingStatus.TENTATIVE] } }).lean()
      ]);

      const activeGroups = activeGroupsList.length;
      const blockedRooms = activeGroupsList.reduce((sum: number, g: any) => sum + (g.totalRooms || 0), 0);
      const pendingContracts = activeGroupsList.filter((g: any) => g.status === "TENTATIVE").length;

      corporate = { totalAccounts, activeAccounts, activeGroups, blockedRooms, pendingContracts };
    }

    // ── 9. BANQUETS ──────────────────────────────────────────────────
    let banquets: any = null;
    if (caps.CC_FRONT_OFFICE) {
      const today7days = endOfBizDay(7);
      const [todayEventsList, upcomingEvents] = await Promise.all([
        BanquetBooking.find({
          ...propertyFilter,
          eventDate: { $gte: startToday, $lte: endToday },
          status: { $nin: [BanquetStatus.CANCELLED] }
        }).lean(),
        BanquetBooking.countDocuments({
          ...propertyFilter,
          eventDate: { $gte: startToday, $lte: today7days },
          status: { $nin: [BanquetStatus.CANCELLED] }
        })
      ]);

      const events = todayEventsList.map(e => ({
        name: e.eventName || "Event",
        status: e.status,
        time: new Date(e.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        venue: e.hallName || "TBD", // Alternatively, populate venue name
        pax: e.expectedPax || 0
      }));

      banquets = { todayEvents: todayEventsList.length, upcomingEvents, events };
    }

    // ── 10. AUDIT & BUSINESS DATE (admin/finance roles) ─────────────
    let audit: any = null;
    if (caps.CC_FINANCE) {
      const businessDate = await BusinessDate.findOne({ ...propertyFilter }).sort({ date: -1 }).lean();
      audit = {
        currentBusinessDate: businessDate ? (businessDate as any).date : null,
        isAuditDone: businessDate ? (businessDate as any).nightAuditCompleted : false
      };
    }

    // ── 11. FORECAST & TRENDS (admin/manager roles) ───────────────────────────
    let forecast: any = null;
    let revenueTrend: any = [];
    let bookingSources: any = [];
    if (caps.CC_FORECAST) {
      const next7 = endOfBizDay(7);
      const past7Start = businessDayRange(addBizDays(todayYmd, -7)).start;

      const upcomingBookings = await Booking.aggregate([
        {
          $match: {
            ...propertyFilter,
            checkInDate: { $gte: startToday, $lte: next7 },
            status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkInDate", timezone: PROPERTY_TIMEZONE } },
            count: { $sum: 1 },
            revenue: { $sum: "$totalAmount" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const pastPayments = await Payment.aggregate([
        {
          $match: {
            ...propertyFilter,
            createdAt: { $gte: past7Start, $lte: endToday },
            status: "COMPLETED"
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: PROPERTY_TIMEZONE } },
            revenue: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const sources = await Booking.aggregate([
        { $match: { ...propertyFilter, createdAt: { $gte: startMonth } } },
        // Booking.source (OTA, WALK_IN, DIRECT_WEBSITE…); "$bookingSource" does not exist and grouped everything as Direct.
        { $group: { _id: "$source", value: { $sum: 1 } } },
        { $project: { name: { $ifNull: ["$_id", "Direct"] }, value: 1, _id: 0 } },
        { $sort: { value: -1 } }
      ]);

      // Real data only: an empty month shows as empty, never as placeholder figures.
      bookingSources = sources;

      // Merge past revenue and future expected revenue into a 7-day window array
      for (let i = 6; i >= 0; i--) {
        const dateStr = addBizDays(todayYmd, -i);
        const dayName = weekday(dateStr);
        const actualRev = pastPayments.find((p: any) => p._id === dateStr)?.revenue || 0;
        // No fabricated values: "expected" is the booked revenue for that date, else 0.
        const expectedRev = upcomingBookings.find((p: any) => p._id === dateStr)?.revenue || 0;
        revenueTrend.push({
          name: dayName,
          revenue: actualRev,
          expected: expectedRev
        });
      }

      forecast = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = addBizDays(todayYmd, i);
        const dayName = weekday(dateStr);
        const b = upcomingBookings.find((p: any) => p._id === dateStr);
        forecast.push({
          date: dayName,
          revenue: b?.revenue || 0,
          occupancyPct: Math.min(100, Math.round(((b?.count || 0) / (totalRooms || 50)) * 100))
        });
      }
    }

    // ── 12. GUEST INTELLIGENCE (front office roles) ──────────────────
    let guests: any = null;
    if (caps.CC_FRONT_OFFICE) {
      const [totalGuests, vipGuests, newComplaints] = await Promise.all([
        Guest.countDocuments({ ...propertyFilter }),
        Guest.countDocuments({ ...propertyFilter, isVip: true }),
        Complaint.countDocuments({ ...propertyFilter, status: { $in: ["OPEN", "IN_PROGRESS"] } })
      ]);

      guests = { totalGuests, vipGuests, openComplaints: newComplaints };
    }

    // ── 13. ADVANCE PAYMENTS ─────────────────────────────────────────
    const { AdvancePayment } = await import("../models/AdvancePayment");
    const advancesRaw = await AdvancePayment.find({ ...propertyFilter }).lean();
    const advances = {
      held: advancesRaw.reduce((acc, a: any) => acc + (a.remainingBalance || 0), 0),
      receivedToday: advancesRaw.filter((a: any) => new Date(a.createdAt) >= startToday && new Date(a.createdAt) <= endToday).reduce((acc, a: any) => acc + (a.amount || 0), 0),
      applied: advancesRaw.reduce((acc, a: any) => acc + (a.totalAdjusted || 0), 0),
      refunded: advancesRaw.reduce((acc, a: any) => acc + (a.totalRefunded || 0), 0),
      available: advancesRaw.reduce((acc, a: any) => acc + (a.remainingBalance || 0), 0)
    };


    // ── 15. APPROVALS ────────────────────────────────────────────────
    const { TaskApproval } = await import("../models/TaskApproval");
    let approvals: any = null;
    if (caps.CC_APPROVALS) {
       const pendingApprovals = await TaskApproval.countDocuments({ ...propertyFilter, status: "PENDING" as any });
       approvals = { pendingApprovals };
    }

    const actionQueue: any[] = [];
    
    const { AuditLog } = await import("../models/AuditLog");
    const logs = await AuditLog.find({ ...propertyFilter }).sort({ createdAt: -1 }).limit(10).populate("actorId", "firstName lastName").lean();
    const recentActivity: any[] = logs.map(l => ({
      user: l.actorType === "SYSTEM" ? "System" : (l.actorId as any)?.firstName ? `${(l.actorId as any).firstName} ${(l.actorId as any).lastName}` : "Guest",
      action: `${l.action} (${l.resourceType})`,
      time: l.createdAt
    }));

    // Arrivals needing attention
    arrivalsData.slice(0, 3).forEach(a => {
      actionQueue.push({
        priority: "HIGH",
        entity: "Front Desk",
        action: `Arrival: ${a.bookingReference || a._id}`,
        time: a.checkInDate,
        link: `/admin/check-in`
      });
    });

    // Dirty rooms blocking arrivals
    if (dirty > 0) {
      actionQueue.push({
        priority: dirty >= 5 ? "HIGH" : "MEDIUM",
        entity: "Housekeeping",
        action: `${dirty} dirty room${dirty > 1 ? "s" : ""} need turnover`,
        time: new Date(),
        link: `/admin/housekeeping`
      });
    }

    // Critical maintenance
    if (mtByPriority.critical > 0) {
      actionQueue.push({
        priority: "CRITICAL",
        entity: "Maintenance",
        action: `${mtByPriority.critical} critical maintenance issue${mtByPriority.critical > 1 ? "s" : ""}`,
        time: new Date(),
        link: `/admin/maintenance`
      });
    }

    // Open cashier shifts
    if (revenue?.openCashierShifts > 0) {
      actionQueue.push({
        priority: "MEDIUM",
        entity: "Cashier",
        action: `${revenue.openCashierShifts} cashier shift${revenue.openCashierShifts > 1 ? "s" : ""} still open`,
        time: new Date(),
        link: `/admin/cashier-shifts`
      });
    }

    // Pending folios
    if ((revenue?.pendingFolios || 0) > 0) {
      actionQueue.push({
        priority: "MEDIUM",
        entity: "Finance",
        action: `${revenue.pendingFolios} folio${revenue.pendingFolios > 1 ? "s" : ""} with outstanding balance`,
        time: new Date(),
        link: `/admin/advances`
      });
    }

    // Delayed restaurant orders
    if ((restaurant?.delayed || 0) > 0) {
      actionQueue.push({
        priority: "HIGH",
        entity: "Restaurant",
        action: `${restaurant.delayed} delayed kitchen order${restaurant.delayed > 1 ? "s" : ""}`,
        time: new Date(),
        link: `/admin/pos`
      });
    }

    res.json({
      success: true,
      data: {
        hotelPulse,
        revenue,          // null for non-finance roles
        arrivals: arrivalsData,
        departures: departuresData,
        inHouse: inHouseData,
        housekeeping,
        maintenance,
        restaurant,       // null for non-restaurant roles
        corporate,        // null for non-corporate roles
        banquets,         // null for non-front-office roles
        audit,            // null for non-finance roles
        forecast,         // null for non-admin/manager roles
        revenueTrend,
        bookingSources,
        guests,           // null for non-front-office roles
        advances,
        approvals,
        actionQueue: actionQueue.slice(0, 10),
        recentActivity
      }
    });

  } catch (error: any) {
    console.error("Command Center Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
