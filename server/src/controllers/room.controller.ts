import { Request, Response } from "express";
import { RoomCategory } from "../models/RoomCategory";
import { Room } from "../models/Room";
import { createAuditLog } from "../services/audit.service";

// Get all room categories (Public)
export const getRoomCategories = async (req: Request, res: Response) => {
  try {
    const categories = await RoomCategory.find({ isActive: true });
    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single room category by slug (Public)
export const getRoomCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const category = await RoomCategory.findOne({ slug: req.params.slug, isActive: true });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    return res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all physical rooms (Admin/Manager protected)
export const getRooms = async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if ((req as any).propertyId) {
      query.propertyId = (req as any).propertyId;
    }
    const rooms = await Room.find(query).populate("category", "name slug").sort({ sortOrder: 1, floor_number: 1, roomNumber: 1 });
    // Status fields come from the room-status snapshot (same truth as every board).
    const { withDerivedState } = await import("../services/room-status.service");
    return res.status(200).json({ success: true, data: await withDerivedState(rooms, undefined, { propertyId: (req as any).propertyId }) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

import { z } from "zod";
import { HousekeepingRoomStatus, OccupancyStatus, SellStatus, RoomStatus } from "../models/Room";
import { Booking } from "../models/Booking";

const roomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  category: z.string().min(1, "Category is required"),
  floor: z.string().min(1, "Floor is required"),
  floor_number: z.number().optional(),
  wing: z.string().optional(),
  building: z.string().optional(),
  bedType: z.string().optional(),
  maxOccupancy: z.number().optional(),
  squareFootage: z.number().optional(),
  viewType: z.string().optional(),
  isAccessible: z.boolean().default(false),
  isConnecting: z.boolean().default(false),
  isSmokingAllowed: z.boolean().default(false),
  sortOrder: z.number().default(0),
  notes: z.string().optional(),
  status: z.enum([RoomStatus.AVAILABLE, RoomStatus.OUT_OF_SERVICE, RoomStatus.OUT_OF_ORDER, RoomStatus.MAINTENANCE]).default(RoomStatus.AVAILABLE),
});

export const createRoom = async (req: Request, res: Response) => {
  try {
    const data = roomSchema.parse(req.body);
    const propertyId = (req as any).propertyId;

    const existing = await Room.findOne({ propertyId, roomNumber: data.roomNumber });
    if (existing) {
      return res.status(400).json({ success: false, message: "Room number already exists in this property" });
    }

    const room = await Room.create({
      ...data,
      propertyId,
      sellStatus: data.status === RoomStatus.AVAILABLE ? SellStatus.SELLABLE : (data.status === RoomStatus.OUT_OF_ORDER ? SellStatus.OUT_OF_ORDER : SellStatus.OUT_OF_SERVICE),
    });

    await createAuditLog({
      req,
      action: "room.created",
      resourceType: "Room",
      resourceId: room._id.toString(),
      metadata: { roomNumber: room.roomNumber, category: room.category },
    });

    return res.status(201).json({ success: true, data: room });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoom = async (req: Request, res: Response) => {
  try {
    const data = roomSchema.partial().parse(req.body);
    const propertyId = (req as any).propertyId;

    if (data.roomNumber) {
      const existing = await Room.findOne({ propertyId, roomNumber: data.roomNumber, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Room number already exists" });
    }

    // Protect operational state: don't let standard update override occupancy/hk/sell unless handled carefully
    // Only map the basic legacy status to sellStatus if it is provided
    let updateData: any = { ...data };
    if (data.status) {
      if (data.status === RoomStatus.AVAILABLE) updateData.sellStatus = SellStatus.SELLABLE;
      else if (data.status === RoomStatus.OUT_OF_ORDER) updateData.sellStatus = SellStatus.OUT_OF_ORDER;
      else if (data.status === RoomStatus.OUT_OF_SERVICE) updateData.sellStatus = SellStatus.OUT_OF_SERVICE;
      else if (data.status === RoomStatus.MAINTENANCE) updateData.sellStatus = SellStatus.OUT_OF_ORDER;
      // Note: we do not allow forcing OCCUPIED or RESERVED via this endpoint.
    }

    const room = await Room.findByIdAndUpdate(req.params.id, updateData, { returnDocument: "after" }).populate("category", "name slug");
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    await createAuditLog({
      req,
      action: "room.updated",
      resourceType: "Room",
      resourceId: room._id.toString(),
      metadata: { roomNumber: room.roomNumber },
    });

    return res.status(200).json({ success: true, data: room });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    // SAFE DELETE CHECK: Is it in use?
    if (room.occupancyStatus !== OccupancyStatus.VACANT) {
      return res.status(400).json({ success: false, message: "Cannot delete room: Currently occupied or arriving/departing." });
    }
    
    // Are there any bookings referencing this physical room? (Even historical)
    const bookingsCount = await Booking.countDocuments({ "assignedRooms.roomId": req.params.id });
    
    if (bookingsCount > 0) {
      // Deactivate instead
      room.status = RoomStatus.OUT_OF_ORDER;
      room.sellStatus = SellStatus.OUT_OF_ORDER;
      room.notes = (room.notes || "") + " [DEACTIVATED/ARCHIVED]";
      await room.save();
      
      await createAuditLog({ req, action: "room.deactivated", resourceType: "Room", resourceId: req.params.id, metadata: { reason: "has historical bookings" } });
      return res.status(200).json({ success: true, message: "Room has historical bookings. Changed to Out of Order (Archived).", data: room });
    }

    await Room.findByIdAndDelete(req.params.id);
    await createAuditLog({ req, action: "room.deleted", resourceType: "Room", resourceId: req.params.id, metadata: { roomNumber: room.roomNumber } });
    
    return res.status(200).json({ success: true, message: "Room permanently deleted." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update physical room status
export const updateRoomStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    let sellStatus = SellStatus.SELLABLE;
    if (status === RoomStatus.OUT_OF_ORDER) sellStatus = SellStatus.OUT_OF_ORDER;
    else if (status === RoomStatus.OUT_OF_SERVICE) sellStatus = SellStatus.OUT_OF_SERVICE;
    else if (status === RoomStatus.MAINTENANCE) sellStatus = SellStatus.OUT_OF_ORDER;
    
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { status, sellStatus },
      { returnDocument: "after" }
    ).populate("category", "name slug");
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    await createAuditLog({
      req,
      action: "room.status_changed",
      resourceType: "Room",
      resourceId: room._id.toString(),
      metadata: {
        roomNumber: room.roomNumber,
        status: room.status,
      },
    });

    return res.status(200).json({ success: true, data: room });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

