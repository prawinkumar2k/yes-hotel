import { Request, Response } from "express";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";
import { Room, SellStatus } from "../models/Room";
import { Booking, BookingStatus } from "../models/Booking";
import { Payment } from "../models/Payment";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { InventoryItem } from "../models/InventoryItem";
import { CorporateAccount } from "../models/CorporateAccount";
import { BanquetBooking, BanquetStatus } from "../models/BanquetBooking";
import { BusinessDate } from "../models/BusinessDate";
import { Folio, FolioStatus } from "../models/Folio";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { Complaint } from "../models/Complaint";
import { Guest } from "../models/Guest";
import { startOfDay, endOfDay, startOfMonth, addDays } from "date-fns";

// ─────────────────────────────────────────────────────────────
// Role groups for data scoping
// ─────────────────────────────────────────────────────────────
const FINANCE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "FINANCE", "CASHIER"];
const FRONT_OFFICE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "FINANCE"];
const RESTAURANT_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RESTAURANT", "FINANCE"];
const INVENTORY_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "INVENTORY", "PROCUREMENT", "FINANCE"];
const CORPORATE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "FINANCE", "RECEPTIONIST"];

export const getCommandCenterData = async (req: Request, res: Response) => {
  try {
    const role = req.user?.role || "CUSTOMER";
    const today = new Date();
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);
    const startMonth = startOfMonth(today);

    // ── 1. HOTEL PULSE (all operational roles) ──────────────────────
    const rooms = await Room.find({}).lean();
    const totalRooms = rooms.length;
    const sellableRooms = rooms.filter(r => r.sellStatus === "SELLABLE").length;
    const occupied = rooms.filter(r => r.occupancyStatus === "OCCUPIED").length;
    const available = rooms.filter(r => r.occupancyStatus === "VACANT" && r.sellStatus === "SELLABLE").length;
    const dirty = rooms.filter(r => r.housekeepingStatus === "DIRTY").length;
    const cleaning = rooms.filter(r => r.housekeepingStatus === "CLEANING").length;
    const cleaningCompleted = rooms.filter(r => r.housekeepingStatus === "CLEANING_COMPLETED").length;
    const inspectionRooms = rooms.filter(r => r.housekeepingStatus === "INSPECTION").length;
    const waitingRelease = rooms.filter(r => r.housekeepingStatus === "WAITING_FOR_RELEASE").length;
    const ooo = rooms.filter(r => r.sellStatus === SellStatus.OUT_OF_ORDER).length;
    const oos = rooms.filter(r => r.sellStatus === SellStatus.OUT_OF_SERVICE).length;
    const clean = rooms.filter(r => r.housekeepingStatus === "CLEAN" && r.occupancyStatus === "VACANT").length;

    const hotelPulse = {
      totalRooms, sellableRooms, occupied, available, dirty, cleaning,
      cleaningCompleted, inspection: inspectionRooms, waitingRelease, ooo, oos, clean,
      occupancyPct: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0
    };

    // ── 2. FRONT OFFICE (arrivals/departures/in-house) ───────────────
    let arrivalsData: any[] = [];
    let departuresData: any[] = [];
    let inHouseData: any[] = [];

    if (FRONT_OFFICE_ROLES.includes(role) || role === "HOUSEKEEPING" || role === "MAINTENANCE") {
      const todayBookings = await Booking.find({
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        $or: [
          { checkInDate: { $gte: startToday, $lte: endToday } },
          { checkOutDate: { $gte: startToday, $lte: endToday } },
          { checkInDate: { $lte: startToday }, checkOutDate: { $gte: endToday } }
        ]
      }).populate("assignedRoom", "roomNumber floor category").lean();

      arrivalsData = todayBookings.filter(b =>
        b.status === BookingStatus.CONFIRMED &&
        new Date(b.checkInDate) >= startToday &&
        new Date(b.checkInDate) <= endToday
      ).slice(0, 15);

      departuresData = todayBookings.filter(b =>
        b.status === BookingStatus.CHECKED_IN &&
        new Date(b.checkOutDate) >= startToday &&
        new Date(b.checkOutDate) <= endToday
      ).slice(0, 15);

      inHouseData = todayBookings.filter(b => b.status === BookingStatus.CHECKED_IN).slice(0, 20);
    }

    // ── 3. REVENUE (finance roles only) ─────────────────────────────
    let revenue: any = null;
    if (FINANCE_ROLES.includes(role)) {
      const [todayAgg, monthAgg, pendingFolios, openCashierShifts] = await Promise.all([
        Payment.aggregate([
          { $match: { createdAt: { $gte: startToday, $lte: endToday }, status: "COMPLETED" } },
          { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]),
        Payment.aggregate([
          { $match: { createdAt: { $gte: startMonth }, status: "COMPLETED" } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Folio.countDocuments({ status: FolioStatus.OPEN, balance: { $gt: 0 } }),
        CashierShift.countDocuments({ status: CashierShiftStatus.OPEN })
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
        openCashierShifts
      };
    }

    // ── 4. HOUSEKEEPING ──────────────────────────────────────────────
    const housekeepingTasks = await HousekeepingTask.find({
      status: { $nin: [HousekeepingStatus.CLEAN] }
    }).populate("room", "roomNumber floor category").populate("assignedTo", "firstName lastName").lean();

    const hkByStatus = {
      dirty: housekeepingTasks.filter(t => t.status === "DIRTY").length,
      assigned: housekeepingTasks.filter(t => t.status === "ASSIGNED").length,
      cleaning: housekeepingTasks.filter(t => t.status === "CLEANING").length,
      completed: housekeepingTasks.filter(t => t.status === "CLEANING_COMPLETED").length,
      inspection: housekeepingTasks.filter(t => t.status === "INSPECTION").length,
      waitingRelease: housekeepingTasks.filter(t => t.status === "WAITING_FOR_RELEASE").length,
    };

    const housekeeping = {
      ...hkByStatus,
      pending: housekeepingTasks.length,
      tasks: housekeepingTasks.slice(0, 20)
    };

    // ── 5. MAINTENANCE ───────────────────────────────────────────────
    const maintenanceTickets = await MaintenanceTicket.find({
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
    if (RESTAURANT_ROLES.includes(role)) {
      const [openOrders, todayFnBRevenue] = await Promise.all([
        RestaurantOrder.find({
          status: { $nin: [OrderStatus.SERVED, OrderStatus.BILLED, OrderStatus.CANCELLED] },
          createdAt: { $gte: startToday }
        }).lean(),
        RestaurantOrder.aggregate([
          { $match: { createdAt: { $gte: startToday, $lte: endToday }, status: { $in: [OrderStatus.SERVED, OrderStatus.BILLED] } } },
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

    // ── 7. INVENTORY (inventory/procurement roles) ────────────────────
    let inventory: any = null;
    if (INVENTORY_ROLES.includes(role)) {
      const [lowStock, outOfStock, totalItems] = await Promise.all([
        InventoryItem.countDocuments({ $expr: { $lte: ["$quantity", "$reorderPoint"] }, quantity: { $gt: 0 } }),
        InventoryItem.countDocuments({ quantity: { $lte: 0 } }),
        InventoryItem.countDocuments({})
      ]);

      inventory = { lowStock, outOfStock, totalItems };
    }

    // ── 8. CORPORATE (corporate roles) ───────────────────────────────
    let corporate: any = null;
    if (CORPORATE_ROLES.includes(role)) {
      const [totalAccounts, activeAccounts] = await Promise.all([
        CorporateAccount.countDocuments({}),
        CorporateAccount.countDocuments({ isActive: true })
      ]);

      corporate = { totalAccounts, activeAccounts };
    }

    // ── 9. BANQUETS ──────────────────────────────────────────────────
    let banquets: any = null;
    if (FRONT_OFFICE_ROLES.includes(role)) {
      const today7days = addDays(today, 7);
      const [todayEvents, upcomingEvents] = await Promise.all([
        BanquetBooking.countDocuments({
          eventDate: { $gte: startToday, $lte: endToday },
          status: { $nin: [BanquetStatus.CANCELLED] }
        }),
        BanquetBooking.countDocuments({
          eventDate: { $gte: startToday, $lte: today7days },
          status: { $nin: [BanquetStatus.CANCELLED] }
        })
      ]);

      banquets = { todayEvents, upcomingEvents };
    }

    // ── 10. AUDIT & BUSINESS DATE (admin/finance roles) ─────────────
    let audit: any = null;
    if (FINANCE_ROLES.includes(role)) {
      const businessDate = await BusinessDate.findOne({}).sort({ date: -1 }).lean();
      audit = {
        currentBusinessDate: businessDate ? (businessDate as any).date : null,
        isAuditDone: businessDate ? (businessDate as any).nightAuditCompleted : false
      };
    }

    // ── 11. FORECAST (admin/manager roles) ───────────────────────────
    let forecast: any = null;
    if (["ADMIN", "SUPER_ADMIN", "MANAGER", "FINANCE"].includes(role)) {
      const next7 = addDays(today, 7);
      const upcomingBookings = await Booking.aggregate([
        {
          $match: {
            checkInDate: { $gte: startToday, $lte: next7 },
            status: { $in: [BookingStatus.CONFIRMED] }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkInDate" } },
            count: { $sum: 1 },
            revenue: { $sum: "$totalAmount" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      forecast = upcomingBookings.map(b => ({
        date: b._id,
        revenue: b.revenue,
        occupancyPct: Math.min(100, Math.round((b.count / 50) * 100))
      }));
    }

    // ── 12. GUEST INTELLIGENCE (front office roles) ──────────────────
    let guests: any = null;
    if (FRONT_OFFICE_ROLES.includes(role)) {
      const [totalGuests, vipGuests, newComplaints] = await Promise.all([
        Guest.countDocuments({}),
        Guest.countDocuments({ isVip: true }),
        Complaint.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS"] } })
      ]);

      guests = { totalGuests, vipGuests, openComplaints: newComplaints };
    }

    // ── 13. ADVANCE PAYMENTS ─────────────────────────────────────────
    const { AdvancePayment } = await import("../models/AdvancePayment");
    const advancesRaw = await AdvancePayment.find({}).lean();
    const advances = {
      held: advancesRaw.reduce((acc, a: any) => acc + (a.remainingBalance || 0), 0),
      receivedToday: advancesRaw.filter((a: any) => new Date(a.createdAt) >= startToday && new Date(a.createdAt) <= endToday).reduce((acc, a: any) => acc + (a.amount || 0), 0),
      applied: advancesRaw.reduce((acc, a: any) => acc + (a.totalAdjusted || 0), 0),
      refunded: advancesRaw.reduce((acc, a: any) => acc + (a.totalRefunded || 0), 0),
      available: advancesRaw.reduce((acc, a: any) => acc + (a.remainingBalance || 0), 0)
    };

    // ── 14. PROCUREMENT ──────────────────────────────────────────────
    const { PurchaseOrder } = await import("../models/PurchaseOrder");
    let procurement: any = null;
    if (INVENTORY_ROLES.includes(role)) {
      const pendingOrders = await PurchaseOrder.countDocuments({ status: "PENDING" as any });
      procurement = { pendingOrders, supplierCount: 0 };
    }

    // ── 15. APPROVALS ────────────────────────────────────────────────
    const { TaskApproval } = await import("../models/TaskApproval");
    let approvals: any = null;
    if (["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role)) {
       const pendingApprovals = await TaskApproval.countDocuments({ status: "PENDING" as any });
       approvals = { pendingApprovals };
    }

    // ── 16. ACTION QUEUE & RECENT ACTIVITY ───────────────────────────
    const actionQueue: any[] = [];
    const recentActivity: any[] = [];

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
        inventory,        // null for non-inventory roles
        procurement,
        corporate,        // null for non-corporate roles
        banquets,         // null for non-front-office roles
        audit,            // null for non-finance roles
        forecast,         // null for non-admin/manager roles
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
