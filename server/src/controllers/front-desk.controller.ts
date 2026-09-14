import { Request, Response } from "express";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, HousekeepingRoomStatus, SellStatus, OccupancyStatus } from "../models/Room";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";
import { AdvancePayment, AdvancePaymentStatus } from "../models/AdvancePayment";
import { HotelSettings } from "../models/HotelSettings";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";

/**
 * GET /api/admin/front-desk/summary
 *
 * The single API that powers the Front Desk Command Center page.
 * Returns today's operational snapshot in one roundtrip:
 *  - Arrivals (check-in due today)
 *  - Departures (check-out due today)
 *  - In-house guests
 *  - Rooms needing attention (dirty, awaiting release, blocked)
 *  - Pending payments
 *  - VIP arrivals
 *  - Current business date
 *  - Active maintenance tickets
 */
export const getFrontDeskSummary = async (req: Request, res: Response) => {
  try {
    const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
    const checkInTime = settings?.checkInTime ?? "14:00";
    const checkOutTime = settings?.checkOutTime ?? "11:00";

    // Build today's date range
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Current business date
    const businessDate = await BusinessDate.findOne({ isCurrentDate: true }).lean();

    const [
      arrivals,
      departures,
      inHouse,
      dirtyRooms,
      waitingForRelease,
      blockedRooms,
      pendingPaymentBookings,
      vipArrivals,
      activeMaintenanceCount,
      pendingAdvances,
    ] = await Promise.all([
      // Today's expected arrivals (CONFIRMED, checking in today)
      Booking.find({
        status: BookingStatus.CONFIRMED,
        checkInDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate("assignedRoom", "roomNumber floor")
        .select("bookingReference guestDetails checkInDate checkOutDate assignedRoom paymentStatus isVipGuest source adults children specialRequests")
        .sort({ checkInDate: 1 })
        .lean(),

      // Today's expected departures (CHECKED_IN, checking out today)
      Booking.find({
        status: BookingStatus.CHECKED_IN,
        checkOutDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate("assignedRoom", "roomNumber floor")
        .select("bookingReference guestDetails checkInDate checkOutDate assignedRoom paymentStatus paidAmount totalAmount isVipGuest folio")
        .sort({ checkOutDate: 1 })
        .lean(),

      // Currently in-house
      Booking.find({ status: BookingStatus.CHECKED_IN })
        .populate("assignedRoom", "roomNumber floor")
        .select("bookingReference guestDetails checkInDate checkOutDate assignedRoom paymentStatus isVipGuest source")
        .lean(),

      // Dirty rooms (need housekeeping)
      Room.find({
        housekeepingStatus: {
          $in: [
            HousekeepingRoomStatus.DIRTY,
            HousekeepingRoomStatus.ASSIGNED,
            HousekeepingRoomStatus.CLEANING,
            HousekeepingRoomStatus.CLEANING_COMPLETED,
            HousekeepingRoomStatus.INSPECTION,
            HousekeepingRoomStatus.INSPECTION_FAILED,
          ],
        },
      })
        .select("roomNumber floor housekeepingStatus occupancyStatus")
        .sort({ floor: 1, roomNumber: 1 })
        .lean(),

      // Rooms waiting for manual release
      Room.find({ housekeepingStatus: HousekeepingRoomStatus.WAITING_FOR_RELEASE })
        .select("roomNumber floor housekeepingStatus lastInspectedAt")
        .lean(),

      // Blocked / OOO rooms
      Room.find({
        sellStatus: { $in: [SellStatus.BLOCKED, SellStatus.OUT_OF_ORDER, SellStatus.OUT_OF_SERVICE] },
      })
        .select("roomNumber floor sellStatus housekeepingStatus occupancyStatus")
        .lean(),

      // Bookings with payment pending or partial
      Booking.find({
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        paymentStatus: { $in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
      })
        .select("bookingReference guestDetails checkInDate checkOutDate paymentStatus paidAmount totalAmount")
        .sort({ checkInDate: 1 })
        .lean(),

      // VIP arrivals (today and next 2 days)
      Booking.find({
        status: BookingStatus.CONFIRMED,
        isVipGuest: true,
        checkInDate: { $gte: todayStart, $lte: new Date(todayEnd.getTime() + 2 * 24 * 60 * 60 * 1000) },
      })
        .select("bookingReference guestDetails checkInDate checkOutDate isVipGuest vipNotes source")
        .sort({ checkInDate: 1 })
        .lean(),

      // Open maintenance tickets
      MaintenanceTicket.countDocuments({ status: { $in: [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] } }),

      // Pending advance payments (received, not yet fully applied)
      AdvancePayment.find({
        status: { $in: [AdvancePaymentStatus.RECEIVED, AdvancePaymentStatus.PARTIALLY_ADJUSTED] },
        remainingBalance: { $gt: 0 },
      })
        .select("advanceNumber guest booking amount remainingBalance receivedAt method")
        .sort({ receivedAt: -1 })
        .lean(),
    ]);

    // Rooms without assignment among today's arrivals
    const unassignedArrivals = arrivals.filter((b) => !b.assignedRoom);

    // Summary counts
    const summary = {
      arrivalsCount: arrivals.length,
      departuresCount: departures.length,
      inHouseCount: inHouse.length,
      unassignedArrivalsCount: unassignedArrivals.length,
      dirtyRoomsCount: dirtyRooms.length,
      waitingForReleaseCount: waitingForRelease.length,
      blockedRoomsCount: blockedRooms.length,
      pendingPaymentsCount: pendingPaymentBookings.length,
      vipArrivalsCount: vipArrivals.length,
      activeMaintenanceCount,
      pendingAdvancesCount: pendingAdvances.length,
      pendingAdvancesTotal: pendingAdvances.reduce((s, a) => s + a.remainingBalance, 0),
      counts: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouse: inHouse.length,
        unassignedBookings: unassignedArrivals.length,
        dirtyRooms: dirtyRooms.length,
      },
    };

    return res.json({
      success: true,
      data: {
        businessDate: businessDate
          ? {
              date: businessDate.date,
              state: businessDate.state,
              openedAt: businessDate.openedAt,
            }
          : null,
        hotelConfig: {
          checkInTime,
          checkOutTime,
        },
        summary,
        counts: summary.counts,
        arrivals,
        todaysArrivals: arrivals,
        departures,
        todaysDepartures: departures,
        inHouse,
        unassignedArrivals,
        unassignedBookings: unassignedArrivals,
        dirtyRooms,
        waitingForRelease,
        blockedRooms,
        pendingPaymentBookings,
        vipArrivals,
        pendingAdvances,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * GET /api/admin/front-desk/arrivals
 * Paginated list of today's expected arrivals with search support.
 */
export const getTodayArrivals = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const { q } = req.query;
    const filter: Record<string, any> = {
      status: BookingStatus.CONFIRMED,
      checkInDate: { $gte: todayStart, $lte: todayEnd },
    };

    if (q) {
      const regex = new RegExp(q as string, "i");
      filter.$or = [
        { bookingReference: regex },
        { "guestDetails.firstName": regex },
        { "guestDetails.lastName": regex },
        { "guestDetails.email": regex },
        { "guestDetails.phone": regex },
      ];
    }

    const arrivals = await Booking.find(filter)
      .populate("assignedRoom", "roomNumber floor housekeepingStatus occupancyStatus")
      .populate("roomCategory", "name")
      .sort({ isVipGuest: -1, checkInDate: 1 })
      .lean();

    return res.json({ success: true, data: arrivals, count: arrivals.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * GET /api/admin/front-desk/departures
 * Paginated list of today's expected departures with balance info.
 */
export const getTodayDepartures = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const { q } = req.query;
    const filter: Record<string, any> = {
      status: BookingStatus.CHECKED_IN,
      checkOutDate: { $gte: todayStart, $lte: todayEnd },
    };

    if (q) {
      const regex = new RegExp(q as string, "i");
      filter.$or = [
        { bookingReference: regex },
        { "guestDetails.firstName": regex },
        { "guestDetails.lastName": regex },
        { "guestDetails.email": regex },
      ];
    }

    const departures = await Booking.find(filter)
      .populate("assignedRoom", "roomNumber floor")
      .populate("roomCategory", "name")
      .populate("folio", "balance status totalCharges totalPaid")
      .sort({ checkOutDate: 1 })
      .lean();

    return res.json({ success: true, data: departures, count: departures.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
