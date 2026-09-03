import { Request, Response } from "express";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { createAuditLog } from "../services/audit.service";

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

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    await createAuditLog({
      req,
      action: "booking.status_changed",
      resourceType: "Booking",
      resourceId: booking._id.toString(),
      metadata: { bookingReference: booking.bookingReference, status },
    });

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
