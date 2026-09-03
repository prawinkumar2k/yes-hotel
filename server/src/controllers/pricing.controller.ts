import { Request, Response } from "express";
import { z } from "zod";
import { PricingRule, PricingType } from "../models/PricingRule";
import { createAuditLog } from "../services/audit.service";

const pricingSchema = z.object({
  name: z.string().min(1),
  roomCategory: z.string().min(1),
  type: z.nativeEnum(PricingType),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  price: z.number().min(0),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
});

export const getPricingRules = async (req: Request, res: Response) => {
  try {
    const rules = await PricingRule.find().populate("roomCategory", "name").sort({ priority: -1, createdAt: -1 });
    return res.status(200).json({ success: true, data: rules });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createPricingRule = async (req: Request, res: Response) => {
  try {
    const data = pricingSchema.parse(req.body);
    const rule = await PricingRule.create({
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
    });

    await createAuditLog({
      req,
      action: "pricing_rule.created",
      resourceType: "PricingRule",
      resourceId: rule._id.toString(),
      metadata: { name: rule.name, type: rule.type, price: rule.price },
    });

    return res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePricingRule = async (req: Request, res: Response) => {
  try {
    const data = pricingSchema.partial().parse(req.body);
    const payload = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
    };
    const rule = await PricingRule.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    await createAuditLog({
      req,
      action: "pricing_rule.updated",
      resourceType: "PricingRule",
      resourceId: rule._id.toString(),
      metadata: { name: rule.name, price: rule.price },
    });

    return res.status(200).json({ success: true, data: rule });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePricingRule = async (req: Request, res: Response) => {
  try {
    const rule = await PricingRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });

    await createAuditLog({
      req,
      action: "pricing_rule.deleted",
      resourceType: "PricingRule",
      resourceId: req.params.id,
      metadata: { name: rule.name },
    });

    return res.status(200).json({ success: true, message: "Rule deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
