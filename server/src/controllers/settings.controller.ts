import { Request, Response } from "express";
import { HotelSettings } from "../models/HotelSettings";
import { z } from "zod";
import { createAuditLog } from "../services/audit.service";
import { DEFAULT_GST_RULES, validateGstRules } from "../services/tax.service";

const gstRuleSchema = z.object({
  category: z.enum(["ROOM", "FOOD", "SERVICE"]),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveFrom must be YYYY-MM-DD"),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  bands: z.array(z.object({ upTo: z.number().positive().nullable(), rate: z.number().min(0).max(40) })).min(1),
});

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
  /** @deprecated accepted for older clients, ignored for tax */
  gstPercentage: z.number().min(0).optional(),
  /** Effective-dated GST rules; an empty array restores the built-in defaults. */
  gstRules: z.array(gstRuleSchema).optional(),
  cancellationPolicy: z.string().min(10),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
  extraPersonRate: z.number().min(0).optional(),
  extraBedRate: z.number().min(0).optional(),
  childRateNoBed: z.number().min(0).optional(),
  childRateWithBed: z.number().min(0).optional(),
  mealPlanRates: z.object({
    EP: z.number().min(0),
    CP: z.number().min(0),
    MAP: z.number().min(0),
    AP: z.number().min(0),
    RO: z.number().min(0),
    BB: z.number().min(0),
  }).optional(),
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
    // effectiveGstRules: what taxService is applying right now (custom rules, or the defaults).
    const custom = (settings as any).gstRules?.length ? (settings as any).toObject().gstRules : null;
    return res.status(200).json({
      success: true,
      data: { ...settings.toObject(), effectiveGstRules: custom ?? DEFAULT_GST_RULES, gstRulesSource: custom ? "SETTINGS" : "DEFAULT" },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { gstPercentage: _deprecatedGst, ...data } = settingsSchema.parse(req.body);
    if (data.gstRules?.length) {
      try {
        validateGstRules(data.gstRules as any);
      } catch (e: any) {
        return res.status(400).json({ success: false, message: `Invalid GST rules: ${e.message}` });
      }
    }
    const before = await HotelSettings.findOne().lean();

    let settings = await HotelSettings.findOne();
    if (settings) {
      Object.assign(settings, data);
      settings.updatedBy = (req as any).user.id;
      await settings.save();
    } else {
      settings = new HotelSettings({
        ...data,
        updatedBy: (req as any).user.id
      });
      await settings.save();
    }

    await createAuditLog({
      req,
      action: "settings.updated",
      resourceType: "HotelSettings",
      resourceId: settings._id.toString(),
      metadata: data.gstRules ? { gstRulesBefore: (before as any)?.gstRules ?? [], gstRulesAfter: data.gstRules } : undefined,
    });

    return res.status(200).json({ success: true, data: settings, message: "Settings updated successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
