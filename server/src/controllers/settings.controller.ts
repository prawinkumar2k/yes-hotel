import { Request, Response } from "express";
import { HotelSettings } from "../models/HotelSettings";
import { z } from "zod";
import { createAuditLog } from "../services/audit.service";

const settingsSchema = z.object({
  hotelName: z.string().min(2),
  logoUrl: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().min(5),
  email: z.string().email(),
  address: z.string().min(5),
  googleMapsUrl: z.string().optional(),
  whatsappNumber: z.string().optional(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  currency: z.string().min(1),
  gstPercentage: z.number().min(0),
  cancellationPolicy: z.string().min(10),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
});

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await HotelSettings.findOne();
    if (!settings) {
      // Create defaults if not exists
      settings = new HotelSettings({ updatedBy: req.path.includes('/public') ? null : (req as any).user?.id });
      if (!req.path.includes('/public') && (req as any).user) {
        await settings.save();
      }
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const data = settingsSchema.parse(req.body);
    
    let settings = await HotelSettings.findOne();
    if (settings) {
      Object.assign(settings, data);
      settings.updatedBy = (req as any).user.id;
      await settings.save();
    } else {
      settings = new HotelSettings({ ...data, updatedBy: (req as any).user.id });
      await settings.save();
    }
    
    await createAuditLog({
      req,
      action: "settings.updated",
      resourceType: "HotelSettings",
      resourceId: settings._id.toString(),
    });

    return res.status(200).json({ success: true, data: settings, message: "Settings updated successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
