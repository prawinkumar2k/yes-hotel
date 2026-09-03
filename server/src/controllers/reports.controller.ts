import { Request, Response } from "express";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";

function parseRange(req: Request) {
  const { dateFrom, dateTo } = req.query;
  const to = dateTo ? new Date(dateTo as string) : new Date();
  const from = dateFrom ? new Date(dateFrom as string) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

// GET /api/admin/reports/overview
export const getReportsOverview = async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const rangeNights = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

    const [
      revenueAgg,
      bookingsInRange,
      cancelledInRange,
      totalRooms,
      roomNightsBookedAgg,
      categoryPerformance,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, paymentStatus: PaymentStatus.PAID } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Booking.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      Booking.countDocuments({ createdAt: { $gte: from, $lte: to }, status: BookingStatus.CANCELLED }),
      Room.countDocuments({ status: { $nin: [RoomStatus.OUT_OF_SERVICE] } }),
      // Room-nights actually booked in range: sum of nights across
      // non-cancelled bookings whose stay overlaps the range.
      Booking.aggregate([
        {
          $match: {
            status: { $ne: BookingStatus.CANCELLED },
            checkInDate: { $lt: to },
            checkOutDate: { $gt: from },
          },
        },
        {
          $project: {
            overlapStart: { $cond: [{ $gt: ["$checkInDate", from] }, "$checkInDate", from] },
            overlapEnd: { $cond: [{ $lt: ["$checkOutDate", to] }, "$checkOutDate", to] },
          },
        },
        {
          $project: {
            nights: {
              $max: [
                0,
                { $ceil: { $divide: [{ $subtract: ["$overlapEnd", "$overlapStart"] }, 1000 * 60 * 60 * 24] } },
              ],
            },
          },
        },
        { $group: { _id: null, totalNights: { $sum: "$nights" } } },
      ]),
      RoomCategory.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: "bookings",
            let: { catId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$roomCategory", "$$catId"] },
                  createdAt: { $gte: from, $lte: to },
                  paymentStatus: PaymentStatus.PAID,
                },
              },
            ],
            as: "bookings",
          },
        },
        {
          $project: {
            name: 1,
            basePrice: 1,
            bookingsCount: { $size: "$bookings" },
            revenue: { $sum: "$bookings.totalAmount" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    const revenue = revenueAgg[0]?.total ?? 0;
    const paidBookingsCount = revenueAgg[0]?.count ?? 0;
    const roomNightsBooked = roomNightsBookedAgg[0]?.totalNights ?? 0;
    const availableRoomNights = totalRooms * rangeNights;

    const occupancyRate = availableRoomNights > 0 ? (roomNightsBooked / availableRoomNights) * 100 : 0;
    const adr = roomNightsBooked > 0 ? revenue / roomNightsBooked : 0; // Average Daily Rate
    const revPAR = availableRoomNights > 0 ? revenue / availableRoomNights : 0; // Revenue per Available Room
    const cancellationRate = bookingsInRange > 0 ? (cancelledInRange / bookingsInRange) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        range: { from, to, nights: rangeNights },
        revenue,
        paidBookingsCount,
        bookingsInRange,
        cancelledInRange,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        totalRooms,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        adr: Math.round(adr),
        revPAR: Math.round(revPAR),
        categoryPerformance,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
