import { Request, Response } from "express";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { createAuditLog } from "../services/audit.service";
import { transitionBookingStatus, IllegalBookingTransitionError } from "../services/booking-state.service";

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalBookings,
      todayArrivals,
      todayDepartures,
      occupiedRooms,
      availableRooms,
      pendingPayments,
      todayRevenue,
      monthRevenue,
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ checkInDate: { $gte: today, $lt: tomorrow } }),
      Booking.countDocuments({ checkOutDate: { $gte: today, $lt: tomorrow } }),
      Room.countDocuments({ status: RoomStatus.OCCUPIED }),
      Room.countDocuments({ status: RoomStatus.AVAILABLE }),
      Booking.countDocuments({ paymentStatus: PaymentStatus.UNPAID, status: { $in: ["CONFIRMED","CHECKED_IN"] } } as any),
      Booking.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, paymentStatus: PaymentStatus.PAID } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: monthStart }, paymentStatus: PaymentStatus.PAID } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalBookings,
        todayArrivals,
        todayDepartures,
        occupiedRooms,
        availableRooms,
        pendingPayments,
        revenueToday: todayRevenue[0]?.total ?? 0,
        revenueMonth: monthRevenue[0]?.total ?? 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminBookings = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "15", status, search } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    const query: Record<string, any> = {};
    if (status && status !== "ALL") query.status = status;
    if (search) {
      // Escape regex metacharacters and force to a string — an admin-only
      // route, but an uncontrolled $regex is still a self-inflicted ReDoS
      // risk from a crafted search term (or a query object slipping past a
      // string-typed field), same fix already applied in getPayments.
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { bookingReference: { $regex: escaped, $options: "i" } },
        { "guestDetails.firstName": { $regex: escaped, $options: "i" } },
        { "guestDetails.lastName": { $regex: escaped, $options: "i" } },
        { "guestDetails.email": { $regex: escaped, $options: "i" } },
      ];
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("roomCategory", "name slug")
        .populate("assignedRoom", "roomNumber floor")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l),
      Booking.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: { bookings, total, totalPages: Math.ceil(total / l), page: p },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminBookingById = async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("roomCategory", "name slug basePrice images")
      .populate("assignedRoom", "roomNumber floor")
      .populate("customer", "firstName lastName email phone");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    return res.status(200).json({ success: true, data: booking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// This generic quick-edit endpoint only ever performed a raw
// findByIdAndUpdate — it completely bypassed the validated state machine
// (transitionBookingStatus) that every other transition path in this
// codebase goes through, including the specific fix documented in
// booking-state.service.ts making CHECKED_IN -> CANCELLED illegal
// everywhere. Through this endpoint an admin could set ANY status
// (CHECKED_OUT back to CHECKED_IN, PENDING straight to CHECKED_IN skipping
// room assignment and folio creation entirely, etc.) with zero checks.
// CHECKED_IN and CHECKED_OUT are excluded here on top of the legality
// check because those transitions have mandatory side effects (room
// assignment + folio creation; folio settlement + room release to
// housekeeping) that only the dedicated /check-in and /check-out
// endpoints perform — this quick-edit must not be usable to reach either
// status without them.
const BOOKING_STATUS_QUICK_EDIT_BLOCKED = new Set([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]);

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: BookingStatus };
    if (BOOKING_STATUS_QUICK_EDIT_BLOCKED.has(status)) {
      return res.status(400).json({
        success: false,
        message: `Use the dedicated check-in/check-out flow to move a booking to ${status} — this cannot be set directly.`,
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    try {
      await transitionBookingStatus(booking, status, {
        req,
        action: "booking.status_changed",
        metadata: { bookingReference: booking.bookingReference },
      });
    } catch (error) {
      if (error instanceof IllegalBookingTransitionError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }
    await booking.save();

    return res.status(200).json({ success: true, data: booking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminCalendar = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ success: false, message: "Start and end dates are required" });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    // Fetch physical rooms and categories
    const [rooms, categories] = await Promise.all([
      Room.find().sort({ roomNumber: 1 }),
      RoomCategory.find().sort({ displayOrder: 1 })
    ]);

    // Fetch bookings that overlap with the date range
    const bookings = await Booking.find({
      $or: [
        { checkInDate: { $lte: endDate }, checkOutDate: { $gte: startDate } }
      ],
      status: { $nin: [BookingStatus.CANCELLED] }
    }).populate("roomCategory", "name slug").populate("assignedRoom", "roomNumber");

    return res.status(200).json({
      success: true,
      data: {
        rooms,
        categories,
        bookings
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
