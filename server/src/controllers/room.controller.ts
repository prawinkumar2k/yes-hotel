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
    const rooms = await Room.find().populate("category", "name slug");
    return res.status(200).json({ success: true, data: rooms });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update physical room status
export const updateRoomStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
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
