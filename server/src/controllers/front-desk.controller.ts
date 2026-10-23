import { Request, Response } from "express";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, HousekeepingRoomStatus, SellStatus, OccupancyStatus } from "../models/Room";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";
import { AdvancePayment, AdvancePaymentStatus } from "../models/AdvancePayment";
import { HotelSettings } from "../models/HotelSettings";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";
import { businessDayRange, todayBusinessDate, addDays } from "../../../shared/dates";
import { getSnapshot } from "../services/room-status.service";

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

    // Today at the property (Asia/Kolkata), independent of the server timezone.
    const { start: todayStart, end: todayEndExclusive } = businessDayRange(todayBusinessDate());
    const todayEnd = new Date(todayEndExclusive.getTime() - 1);

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
        .populate("roomCategory", "name")
        .select("bookingReference groupId billNumber guestDetails checkInDate checkOutDate assignedRoom roomCategory paymentStatus paidAmount totalAmount ratePerNight isVipGuest source adults children specialRequests")
        .sort({ checkInDate: 1 })
        .lean(),

      // Departures: in-house stays due out today or overdue (an overdue stay is still to depart)
      Booking.find({
        status: BookingStatus.CHECKED_IN,
        checkOutDate: { $lte: todayEnd },
      })
        .populate("assignedRoom", "roomNumber floor")
        .populate("roomCategory", "name")
        .select("bookingReference groupId billNumber guestDetails checkInDate checkOutDate assignedRoom roomCategory paymentStatus paidAmount totalAmount ratePerNight isVipGuest folio")
        .sort({ checkOutDate: 1 })
        .lean(),

      // Currently in-house
      Booking.find({ status: BookingStatus.CHECKED_IN })
        .populate("assignedRoom", "roomNumber floor")
        .populate("roomCategory", "name")
        .select("bookingReference groupId billNumber guestDetails checkInDate checkOutDate assignedRoom roomCategory paymentStatus paidAmount totalAmount ratePerNight isVipGuest source")
        .lean(),

      // Dirty rooms: the room-status snapshot's DIRTY state (same definition as every board)
      getSnapshot(todayBusinessDate()).then((snap) =>
        snap.rooms
          .filter((r) => r.hk === "DIRTY")
          .map((r) => ({ _id: r.roomId, roomNumber: r.roomNumber, floor: r.floor, housekeepingStatus: r.hk, occupancyStatus: r.occupancy, hkTaskStatus: r.hkTaskStatus })),
      ),

      // Rooms waiting for manual release
      Room.find({ housekeepingStatus: HousekeepingRoomStatus.WAITING_FOR_RELEASE })
        .select("roomNumber floor housekeepingStatus lastInspectedAt")
        .lean(),

      // Blocked / OOO / OOS rooms from the snapshot (includes rooms held by critical maintenance)
      getSnapshot(todayBusinessDate()).then((snap) =>
        snap.rooms
          .filter((r) => r.sell !== "SELLABLE" || r.blocked)
          .map((r) => ({ _id: r.roomId, roomNumber: r.roomNumber, floor: r.floor, sellStatus: r.sell === "OOO" ? "OUT_OF_ORDER" : r.sell === "OOS" ? "OUT_OF_SERVICE" : "BLOCKED", sellReason: r.sellReason, housekeepingStatus: r.hk, occupancyStatus: r.occupancy })),
      ),

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
        checkInDate: { $gte: todayStart, $lt: businessDayRange(addDays(todayBusinessDate(), 2)).end },
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

    // Room lists for the desk: ready to sell now, and occupied (with the guest), from the same snapshot.
    const snap = await getSnapshot(todayBusinessDate());
    const roomRow = (r: any) => ({ _id: r.roomId, roomNumber: r.roomNumber, floor: r.floor, categoryName: r.categoryName, housekeepingStatus: r.hk, occupancyStatus: r.occupancy, bookingId: r.bookingId, bookingReference: r.bookingReference, guestName: r.guestName, overdue: r.overdue });
    const byNumber = (a: any, b: any) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true });
    const availableRooms = snap.rooms.filter((r) => r.occupancy === "VACANT" && r.hk === "CLEAN" && r.sell === "SELLABLE" && !r.blocked).map(roomRow).sort(byNumber);
    const occupiedRooms = snap.rooms.filter((r) => r.occupancy === "OCCUPIED").map(roomRow).sort(byNumber);

    // Rooms without assignment among today's arrivals
    const unassignedArrivals = arrivals.filter((b) => !b.assignedRoom);

    // Reservations still waiting for a room: arriving today or in the next 14 days (they need a room before arrival).
    const horizon = new Date(todayEnd.getTime() + 14 * 86400000);
    const unassignedBookings = await Booking.find({
      status: BookingStatus.CONFIRMED,
      assignedRoom: null,
      checkInDate: { $lte: horizon },
      checkOutDate: { $gt: todayStart },
    })
      .populate("roomCategory", "name")
      .select("bookingReference groupId billNumber guestDetails checkInDate checkOutDate assignedRoom roomCategory paymentStatus paidAmount totalAmount ratePerNight isVipGuest source adults children")
      .sort({ checkInDate: 1 })
      .lean();

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
        unassignedBookings: unassignedBookings.length,
        dirtyRooms: dirtyRooms.length,
        availableRooms: availableRooms.length,
        occupiedRooms: occupiedRooms.length,
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
        unassignedBookings,
        dirtyRooms,
        availableRooms,
        occupiedRooms,
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
    // Today at the property (Asia/Kolkata), independent of the server timezone.
    const { start: todayStart, end: todayEndExclusive } = businessDayRange(todayBusinessDate());
    const todayEnd = new Date(todayEndExclusive.getTime() - 1);

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
    // Today at the property (Asia/Kolkata), independent of the server timezone.
    const { start: todayStart, end: todayEndExclusive } = businessDayRange(todayBusinessDate());
    const todayEnd = new Date(todayEndExclusive.getTime() - 1);

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
