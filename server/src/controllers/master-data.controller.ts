import { Request, Response } from "express";
import { z } from "zod";
import { Floor } from "../models/Floor";
import { Amenity } from "../models/Amenity";
import { BedType } from "../models/BedType";
import { RoomView } from "../models/RoomView";
import { Room } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { createAuditLog } from "../services/audit.service";
import mongoose from "mongoose";

// --- FLOORS ---

const floorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  floorNumber: z.number(),
  code: z.string().min(1, "Code is required"),
  building: z.string().optional(),
  wing: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const getFloors = async (req: Request, res: Response) => {
  try {
    const propertyId = (req as any).propertyId;
    const floors = await Floor.find({ propertyId }).sort({ floorNumber: 1, name: 1 });
    return res.status(200).json({ success: true, data: floors });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createFloor = async (req: Request, res: Response) => {
  try {
    const data = floorSchema.parse(req.body);
    const propertyId = (req as any).propertyId;

    // Check code uniqueness
    const existingCode = await Floor.findOne({ propertyId, code: data.code });
    if (existingCode) return res.status(400).json({ success: false, message: "Floor code already exists" });

    // Check floorNumber uniqueness within building
    const existingNum = await Floor.findOne({ propertyId, building: data.building, floorNumber: data.floorNumber });
    if (existingNum) return res.status(400).json({ success: false, message: "Floor number already exists in this building" });

    const floor = await Floor.create({
      ...data,
      propertyId,
      createdBy: (req as any).user._id,
      updatedBy: (req as any).user._id,
    });

    await createAuditLog({
      req,
      action: "floor.created",
      resourceType: "Floor",
      resourceId: floor._id.toString(),
      metadata: { name: floor.name, code: floor.code },
    });

    return res.status(201).json({ success: true, data: floor });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFloor = async (req: Request, res: Response) => {
  try {
    const data = floorSchema.partial().parse(req.body);
    const propertyId = (req as any).propertyId;
    
    if (data.code) {
      const existing = await Floor.findOne({ propertyId, code: data.code, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Floor code already exists" });
    }

    if (data.floorNumber !== undefined || data.building !== undefined) {
       const target = await Floor.findById(req.params.id);
       if(!target) return res.status(404).json({ success: false, message: "Floor not found" });
       
       const checkNum = data.floorNumber !== undefined ? data.floorNumber : target.floorNumber;
       const checkBldg = data.building !== undefined ? data.building : target.building;
       
       const existingNum = await Floor.findOne({ propertyId, building: checkBldg, floorNumber: checkNum, _id: { $ne: req.params.id } });
       if (existingNum) return res.status(400).json({ success: false, message: "Floor number already exists in this building" });
    }

    const floor = await Floor.findByIdAndUpdate(
      req.params.id,
      { ...data, updatedBy: (req as any).user._id },
      { returnDocument: "after" }
    );
    if (!floor) return res.status(404).json({ success: false, message: "Floor not found" });

    await createAuditLog({
      req,
      action: "floor.updated",
      resourceType: "Floor",
      resourceId: floor._id.toString(),
      metadata: { name: floor.name },
    });

    return res.status(200).json({ success: true, data: floor });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFloor = async (req: Request, res: Response) => {
  try {
    const floor = await Floor.findById(req.params.id);
    if (!floor) return res.status(404).json({ success: false, message: "Floor not found" });

    // Check dependencies (Rooms)
    // Floor in Room model is a string (room.floor), we need to check if any room matches floor.floorNumber or floor.name
    const roomsCount = await Room.countDocuments({ 
        propertyId: (req as any).propertyId, 
        $or: [ { floor: String(floor.floorNumber) }, { floor: floor.name } ] 
    });

    if (roomsCount > 0) {
      // Soft deactivate
      const updated = await Floor.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: "after" });
      await createAuditLog({ req, action: "floor.deactivated", resourceType: "Floor", resourceId: req.params.id, metadata: { reason: "has dependent rooms" } });
      return res.status(200).json({ success: true, message: "Floor has rooms assigned. Soft deactivated instead.", data: updated });
    }

    await Floor.findByIdAndDelete(req.params.id);
    await createAuditLog({ req, action: "floor.deleted", resourceType: "Floor", resourceId: req.params.id, metadata: { name: floor.name } });
    return res.status(200).json({ success: true, message: "Floor deleted physically." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- AMENITIES ---

const amenitySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

export const getAmenities = async (req: Request, res: Response) => {
  try {
    const amenities = await Amenity.find().sort({ displayOrder: 1, name: 1 });
    return res.status(200).json({ success: true, data: amenities });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAmenity = async (req: Request, res: Response) => {
  try {
    const data = amenitySchema.parse(req.body);
    const existing = await Amenity.findOne({ code: data.code.toUpperCase() });
    if (existing) return res.status(400).json({ success: false, message: "Code already exists" });

    const amenity = await Amenity.create({ ...data, createdBy: (req as any).user._id, updatedBy: (req as any).user._id });
    await createAuditLog({ req, action: "amenity.created", resourceType: "Amenity", resourceId: amenity._id.toString(), metadata: { name: amenity.name } });
    return res.status(201).json({ success: true, data: amenity });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAmenity = async (req: Request, res: Response) => {
  try {
    const data = amenitySchema.partial().parse(req.body);
    if (data.code) {
      const existing = await Amenity.findOne({ code: data.code.toUpperCase(), _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Code already exists" });
    }
    const amenity = await Amenity.findByIdAndUpdate(req.params.id, { ...data, updatedBy: (req as any).user._id }, { returnDocument: "after" });
    if (!amenity) return res.status(404).json({ success: false, message: "Not found" });
    await createAuditLog({ req, action: "amenity.updated", resourceType: "Amenity", resourceId: amenity._id.toString(), metadata: { name: amenity.name } });
    return res.status(200).json({ success: true, data: amenity });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAmenity = async (req: Request, res: Response) => {
  try {
    const amenity = await Amenity.findById(req.params.id);
    if (!amenity) return res.status(404).json({ success: false, message: "Not found" });

    // RoomCategory currently stores amenities as string[] (names). Check if any category uses this.
    const categoriesCount = await RoomCategory.countDocuments({ amenities: amenity.name });
    
    if (categoriesCount > 0) {
      const updated = await Amenity.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: "after" });
      await createAuditLog({ req, action: "amenity.deactivated", resourceType: "Amenity", resourceId: req.params.id, metadata: { reason: "used in categories" } });
      return res.status(200).json({ success: true, message: "Amenity in use. Soft deactivated.", data: updated });
    }

    await Amenity.findByIdAndDelete(req.params.id);
    await createAuditLog({ req, action: "amenity.deleted", resourceType: "Amenity", resourceId: req.params.id, metadata: { name: amenity.name } });
    return res.status(200).json({ success: true, message: "Deleted physically." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- BED TYPES ---

const bedTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().min(1),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

export const getBedTypes = async (req: Request, res: Response) => {
  try {
    const items = await BedType.find().sort({ displayOrder: 1, name: 1 });
    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createBedType = async (req: Request, res: Response) => {
  try {
    const data = bedTypeSchema.parse(req.body);
    const existing = await BedType.findOne({ code: data.code.toUpperCase() });
    if (existing) return res.status(400).json({ success: false, message: "Code already exists" });

    const item = await BedType.create({ ...data, createdBy: (req as any).user._id, updatedBy: (req as any).user._id });
    await createAuditLog({ req, action: "bed_type.created", resourceType: "BedType", resourceId: item._id.toString(), metadata: { name: item.name } });
    return res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBedType = async (req: Request, res: Response) => {
  try {
    const data = bedTypeSchema.partial().parse(req.body);
    if (data.code) {
      const existing = await BedType.findOne({ code: data.code.toUpperCase(), _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Code already exists" });
    }
    const item = await BedType.findByIdAndUpdate(req.params.id, { ...data, updatedBy: (req as any).user._id }, { returnDocument: "after" });
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    await createAuditLog({ req, action: "bed_type.updated", resourceType: "BedType", resourceId: item._id.toString(), metadata: { name: item.name } });
    return res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBedType = async (req: Request, res: Response) => {
  try {
    const item = await BedType.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    const catCount = await RoomCategory.countDocuments({ bedType: item.name });
    const roomCount = await Room.countDocuments({ bedType: item.name });
    
    if (catCount > 0 || roomCount > 0) {
      const updated = await BedType.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: "after" });
      await createAuditLog({ req, action: "bed_type.deactivated", resourceType: "BedType", resourceId: req.params.id, metadata: { reason: "used in rooms/categories" } });
      return res.status(200).json({ success: true, message: "In use. Soft deactivated.", data: updated });
    }

    await BedType.findByIdAndDelete(req.params.id);
    await createAuditLog({ req, action: "bed_type.deleted", resourceType: "BedType", resourceId: req.params.id, metadata: { name: item.name } });
    return res.status(200).json({ success: true, message: "Deleted physically." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- ROOM VIEWS ---

const roomViewSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

export const getRoomViews = async (req: Request, res: Response) => {
  try {
    const items = await RoomView.find().sort({ displayOrder: 1, name: 1 });
    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createRoomView = async (req: Request, res: Response) => {
  try {
    const data = roomViewSchema.parse(req.body);
    const existing = await RoomView.findOne({ code: data.code.toUpperCase() });
    if (existing) return res.status(400).json({ success: false, message: "Code already exists" });

    const item = await RoomView.create({ ...data, createdBy: (req as any).user._id, updatedBy: (req as any).user._id });
    await createAuditLog({ req, action: "room_view.created", resourceType: "RoomView", resourceId: item._id.toString(), metadata: { name: item.name } });
    return res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoomView = async (req: Request, res: Response) => {
  try {
    const data = roomViewSchema.partial().parse(req.body);
    if (data.code) {
      const existing = await RoomView.findOne({ code: data.code.toUpperCase(), _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Code already exists" });
    }
    const item = await RoomView.findByIdAndUpdate(req.params.id, { ...data, updatedBy: (req as any).user._id }, { returnDocument: "after" });
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    await createAuditLog({ req, action: "room_view.updated", resourceType: "RoomView", resourceId: item._id.toString(), metadata: { name: item.name } });
    return res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRoomView = async (req: Request, res: Response) => {
  try {
    const item = await RoomView.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    const roomCount = await Room.countDocuments({ viewType: item.name });
    
    if (roomCount > 0) {
      const updated = await RoomView.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: "after" });
      await createAuditLog({ req, action: "room_view.deactivated", resourceType: "RoomView", resourceId: req.params.id, metadata: { reason: "used in rooms" } });
      return res.status(200).json({ success: true, message: "In use. Soft deactivated.", data: updated });
    }

    await RoomView.findByIdAndDelete(req.params.id);
    await createAuditLog({ req, action: "room_view.deleted", resourceType: "RoomView", resourceId: req.params.id, metadata: { name: item.name } });
    return res.status(200).json({ success: true, message: "Deleted physically." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
