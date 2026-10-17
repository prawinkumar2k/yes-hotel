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

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");
const optionalUrl = z.union([z.literal(""), z.string().regex(/^\/\S*$/), z.string().url("Enter a full URL (https://…) or a site path (/…)")]).optional();
const money = (label: string) => z.number({ message: `${label} must be a number` }).finite().min(0, `${label} cannot be negative`);

const settingsSchema = z.object({
  hotelName: z.string().min(2),
  logoUrl: optionalUrl,
  tagline: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 7, "Phone must contain at least 7 digits"),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  address: z.string().min(5),
  googleMapsUrl: optionalUrl,
  whatsappNumber: z.string().optional(),
  checkInTime: HHMM,
  checkOutTime: HHMM,
  currency: z.string().trim().length(3, "Currency is a 3-letter code (e.g. INR)").toUpperCase(),
  /** @deprecated accepted for older clients, ignored for tax */
  gstPercentage: z.number().min(0).optional(),
  /** Effective-dated GST rules; an empty array restores the built-in defaults. */
  gstRules: z.array(gstRuleSchema).optional(),
  /** The hotel's GSTIN, printed on invoices: 15 characters, e.g. 29ABCDE1234F1Z5 (empty = not set). */
  gstNumber: z.union([
    z.literal(""),
    z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5"),
  ]).optional(),
  /** Room prices include GST: the rate is what the guest pays and the GST is inside it. */
  taxInclusiveRates: z.boolean().optional(),
  cancellationPolicy: z.string().min(10),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
  extraPersonRate: money("Extra person rate").optional(),
  extraBedRate: money("Extra bed rate").optional(),
  /** Used when a room type has no hourly price: flat fee for early check-in / late check-out. */
  earlyCheckInFee: money("Early check-in fee").optional(),
  lateCheckOutFee: money("Late check-out fee").optional(),
  childRateNoBed: money("Child rate (no bed)").optional(),
  childRateWithBed: money("Child rate (with bed)").optional(),
  mealPlanRates: z.object({
    EP: money("EP rate"),
    CP: money("CP rate"),
    MAP: money("MAP rate"),
    AP: money("AP rate"),
    RO: money("RO rate"),
    BB: money("BB rate"),
  }).optional(),
  cashVarianceThreshold: money("Cash variance threshold").optional(),
});

/** What anyone may see (website, chatbot, booking pages): guest-facing details only, no internal settings. */
const PUBLIC_SETTING_FIELDS = [
  "hotelName", "logoUrl", "tagline", "description", "phone", "email", "address", "googleMapsUrl", "whatsappNumber",
  "checkInTime", "checkOutTime", "earlyCheckInFee", "lateCheckOutFee", "extraPersonRate", "extraBedRate",
  "childRateNoBed", "childRateWithBed", "mealPlanRates", "currency", "currencySymbol", "cgstPercentage", "sgstPercentage",
  "igstPercentage", "taxInclusiveRates", "gstNumber", "cancellationPolicy", "cancellationFreeHours",
  "cancellationPenaltyPercentage", "instagramUrl", "facebookUrl", "youtubeUrl", "metaTitle", "metaDescription", "ogImageUrl",
] as const;

export function publicSettingsView(settings: any) {
  const s = settings?.toObject ? settings.toObject() : settings ?? {};
  return Object.fromEntries(PUBLIC_SETTING_FIELDS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
}

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
    if (req.path.includes("/public")) return res.status(200).json({ success: true, data: publicSettingsView(settings) });
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
