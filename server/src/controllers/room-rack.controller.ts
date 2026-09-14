import { Request, Response } from "express";
import mongoose from "mongoose";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { Booking, BookingStatus } from "../models/Booking";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { MaintenanceTicket } from "../models/MaintenanceTicket";
import {
  transitionHousekeepingStatus,
  setSellStatus,
  setOccupancyStatus,
} from "../services/room-state.service";
import { createAuditLog } from "../services/audit.service";
import { BookingEvent, BookingEventType } from "../models/BookingEvent";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/rooms/rack
// Returns rooms grouped by floor, with full state, current booking, and
// housekeeping task data — the raw data behind the front-desk room rack UI.
// ─────────────────────────────────────────────────────────────────────────────

export const getRoomRack = async (req: Request, res: Response) => {
  try {
    const { floor, housekeepingStatus, sellStatus, occupancyStatus, category } = req.query;

    const filter: Record<string, any> = {};
    if (floor) filter.floor = floor as string;
    if (housekeepingStatus) filter.housekeepingStatus = housekeepingStatus as string;
    if (sellStatus) filter.sellStatus = sellStatus as string;
    if (occupancyStatus) filter.occupancyStatus = occupancyStatus as string;
    if (category) filter.category = category as string;

    const rooms = await Room.find(filter)
      .populate("category", "name slug basePrice")
      .populate("currentBooking", "bookingReference guestDetails checkInDate checkOutDate status isVipGuest")
      .populate("lastInspectedBy", "name")
      .populate("releasedBy", "name")
      .sort({ floor_number: 1, sortOrder: 1, roomNumber: 1 })
      .lean();

    // Enrich each room with its active housekeeping task (if any)
    const roomIds = rooms.map((r) => r._id);
    const activeTasks = await HousekeepingTask.find({
      room: { $in: roomIds },
      status: {
        $in: [
          HousekeepingStatus.DIRTY,
          HousekeepingStatus.ASSIGNED,
          HousekeepingStatus.CLEANING,
          HousekeepingStatus.CLEANING_COMPLETED,
          HousekeepingStatus.INSPECTION,
          HousekeepingStatus.WAITING_FOR_RELEASE,
        ],
      },
    })
      .populate("assignedTo", "name")
      .lean();

    const taskByRoom = new Map(activeTasks.map((t) => [t.room.toString(), t]));

    // Active maintenance tickets
    const activeTickets = await MaintenanceTicket.find({
      room: { $in: roomIds },
      status: { $in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
    } as any)
      .select("room status priority issueTitle")
      .lean();
    const ticketByRoom = new Map<string, typeof activeTickets[0]>();
    for (const t of activeTickets) {
      ticketByRoom.set(t.room.toString(), t);
    }

    // Group by floor
    const floorMap = new Map<string, any[]>();
    for (const room of rooms) {
      const floorKey = room.floor ?? "G";
      if (!floorMap.has(floorKey)) floorMap.set(floorKey, []);
      floorMap.get(floorKey)!.push({
        ...room,
        activeHousekeepingTask: taskByRoom.get(room._id.toString()) ?? null,
        activeMaintenanceTicket: ticketByRoom.get(room._id.toString()) ?? null,
      });
    }

    const floors = Array.from(floorMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([floor, rooms]) => ({ floor, rooms }));

    return res.json({ success: true, data: { floors, totalRooms: rooms.length } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/rooms/:id/manual-release
// Authorized release of a room from WAITING_FOR_RELEASE → CLEAN.
// MANAGER or ADMIN only — enforced at the route level.
// ─────────────────────────────────────────────────────────────────────────────

export const manualReleaseRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const actorId = (req as any).user?.id;
    const actorRole = (req as any).user?.role;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, message: "Invalid room ID" });
    }

    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    if (room.housekeepingStatus !== HousekeepingRoomStatus.WAITING_FOR_RELEASE) {
      return res.status(400).json({
        success: false,
        message: `Room is in ${room.housekeepingStatus} — it must be WAITING_FOR_RELEASE before manual release`,
      });
    }

    const updated = await transitionHousekeepingStatus(id as string, HousekeepingRoomStatus.CLEAN, {
      req,
      action: "room.manual_released",
      sellStatus: SellStatus.SELLABLE,
      releasedBy: actorId as string,
      metadata: { notes, releasedByRole: actorRole },
    });

    // Mark the active housekeeping task as complete
    await HousekeepingTask.findOneAndUpdate(
      { room: id, status: HousekeepingStatus.WAITING_FOR_RELEASE },
      {
        status: HousekeepingStatus.CLEAN,
        releasedAt: new Date(),
        releasedBy: actorId,
      }
    );

    return res.json({
      success: true,
      message: `Room ${room.roomNumber} manually released — now CLEAN and SELLABLE`,
      data: updated,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/rooms/:id/set-sell-status
// Block / unblock a room or mark OOO / OOS.
// ─────────────────────────────────────────────────────────────────────────────

export const updateRoomSellStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sellStatus, reason } = req.body;

    if (!Object.values(SellStatus).includes(sellStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sellStatus. Must be one of: ${Object.values(SellStatus).join(", ")}`,
      });
    }

    const room = await setSellStatus(id as string, sellStatus as SellStatus, {
      req,
      action: "room.sell_status_updated",
      reason,
    });

    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    return res.json({
      success: true,
      message: `Room ${room.roomNumber} sell status updated to ${sellStatus}`,
      data: room,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/rooms/:id/assign-booking
// Assigns a specific room to a confirmed booking.
// ─────────────────────────────────────────────────────────────────────────────

export const assignRoomToBooking = async (req: Request, res: Response) => {
  try {
    const { id: roomId } = req.params;
    const { bookingId } = req.body;
    const actorId = (req as any).user?.id;

    if (!mongoose.Types.ObjectId.isValid(roomId as string) || !mongoose.Types.ObjectId.isValid(bookingId as string)) {
      return res.status(400).json({ success: false, message: "Invalid room or booking ID" });
    }

    const [room, booking] = await Promise.all([
      Room.findById(roomId),
      Booking.findById(bookingId),
    ]);

    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (room.sellStatus !== SellStatus.SELLABLE) {
      return res.status(400).json({
        success: false,
        message: `Room ${room.roomNumber} is ${room.sellStatus} — cannot assign`,
      });
    }

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Booking is ${booking.status} — can only assign rooms to PENDING or CONFIRMED bookings`,
      });
    }

    const prevRoom = booking.assignedRoom?.toString();
    const strRoomId = Array.isArray(roomId) ? roomId[0] : roomId;
    booking.assignedRoom = new mongoose.Types.ObjectId(strRoomId as string);
    await booking.save();

    // Record booking event
    await BookingEvent.create({
      booking: bookingId,
      eventType: prevRoom ? BookingEventType.ROOM_CHANGED : BookingEventType.ROOM_ASSIGNED,
      description: prevRoom
        ? `Room changed to ${room.roomNumber}`
        : `Room ${room.roomNumber} assigned`,
      performedBy: actorId,
      performedByRole: (req as any).user?.role,
      performedAt: new Date(),
      previousValue: prevRoom ? { roomId: prevRoom } : undefined,
      newValue: { roomId: roomId as string },
      roomId: roomId as string,
    });

    await createAuditLog({
      req,
      action: "booking.room_assigned",
      resourceType: "Booking",
      resourceId: bookingId,
      metadata: {
        bookingReference: booking.bookingReference,
        roomId,
        roomNumber: room.roomNumber,
        previousRoom: prevRoom,
      },
    });

    return res.json({
      success: true,
      message: `Room ${room.roomNumber} assigned to booking ${booking.bookingReference}`,
      data: { roomId, bookingId, roomNumber: room.roomNumber },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/rooms/availability
// Enhanced availability: accounts for sellStatus, maintenance, and inventory.
// ─────────────────────────────────────────────────────────────────────────────

export const getRoomAvailability = async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut, categoryId } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "checkIn and checkOut are required" });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    const roomFilter: Record<string, any> = {
      sellStatus: SellStatus.SELLABLE,
    };
    if (categoryId) roomFilter.category = categoryId as string;

    const sellableRooms = await Room.find(roomFilter)
      .populate("category", "name slug basePrice")
      .lean();

    const conflictingBookings = await Booking.find({
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
      assignedRoom: { $in: sellableRooms.map((r) => r._id) as mongoose.Types.ObjectId[] },
    }).select("assignedRoom").lean();

    const bookedRoomIds = new Set(conflictingBookings.map((b) => b.assignedRoom?.toString()));

    const available = sellableRooms.filter((r) => !bookedRoomIds.has(r._id.toString()));
    const unavailable = sellableRooms.filter((r) => bookedRoomIds.has(r._id.toString()));

    return res.json({
      success: true,
      data: {
        available,
        unavailable,
        totalSellable: sellableRooms.length,
        totalAvailable: available.length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
