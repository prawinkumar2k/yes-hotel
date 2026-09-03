import { Request, Response } from "express";
import { z } from "zod";
import { RoomCategory } from "../models/RoomCategory";
import { Booking, BookingStatus } from "../models/Booking";
import { createAuditLog } from "../services/audit.service";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  shortDescription: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  basePrice: z.number().min(0),
  capacity: z.object({
    adults: z.number().min(1),
    children: z.number().min(0),
  }),
  bedType: z.string().optional(),
  amenities: z.array(z.string()),
  images: z.array(z.string()),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
  featured: z.boolean().default(false),
});

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await RoomCategory.find().sort({ displayOrder: 1, createdAt: -1 });
    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await RoomCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    return res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const data = categorySchema.parse(req.body);
    
    // Check slug uniqueness
    const existing = await RoomCategory.findOne({ slug: data.slug });
    if (existing) {
      return res.status(400).json({ success: false, message: "Category slug already exists" });
    }

    const category = await RoomCategory.create(data);

    await createAuditLog({
      req,
      action: "room_category.created",
      resourceType: "RoomCategory",
      resourceId: category._id.toString(),
      metadata: { name: category.name, slug: category.slug },
    });

    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    
    if (data.slug) {
      const existing = await RoomCategory.findOne({ slug: data.slug, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: "Category slug already exists" });
      }
    }

    const category = await RoomCategory.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    await createAuditLog({
      req,
      action: "room_category.updated",
      resourceType: "RoomCategory",
      resourceId: category._id.toString(),
      metadata: { name: category.name },
    });

    return res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const activeBookings = await Booking.exists({
      roomCategory: req.params.id,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }
    });

    if (activeBookings) {
      // Soft deactivate
      const category = await RoomCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

      await createAuditLog({
        req,
        action: "room_category.deactivated",
        resourceType: "RoomCategory",
        resourceId: req.params.id,
        metadata: { reason: "has active bookings" },
      });

      return res.status(200).json({
        success: true,
        message: "Category has active bookings. Soft deactivated instead.",
        data: category
      });
    }

    const category = await RoomCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    await createAuditLog({
      req,
      action: "room_category.deleted",
      resourceType: "RoomCategory",
      resourceId: req.params.id,
      metadata: { name: category.name },
    });

    return res.status(200).json({ success: true, message: "Category deleted physically." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
