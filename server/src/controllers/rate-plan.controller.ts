import { Request, Response } from "express";
import { RatePlan, MealPlanType } from "../models/RatePlan";
import { createAuditLog } from "../services/audit.service";
import { calculateDynamicBookingTotals } from "../services/pricing.service";


/**
 * GET /api/rate-plans
 */
export const getRatePlans = async (_req: Request, res: Response) => {
  try {
    const plans = await RatePlan.find().sort({ code: 1 }).lean();

    return res.json({ success: true, data: plans });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/rate-plans
 */
export const createRatePlan = async (req: Request, res: Response) => {
  try {
    const { name, code, mealPlan, multiplier, cancellationPolicy, notes } = req.body;

    if (!name || !code || !multiplier) {
      return res.status(400).json({ success: false, message: "name, code, and multiplier are required" });
    }

    const plan = await RatePlan.create({
      name,
      code: code.toUpperCase(),
      mealPlan: mealPlan || MealPlanType.CP,
      multiplier: Number(multiplier),
      cancellationPolicy,
      notes,
    });

    await createAuditLog({
      req,
      action: "rate_plan.created",
      resourceType: "RatePlan",
      resourceId: plan._id.toString(),
      metadata: { code: plan.code, multiplier: plan.multiplier },
    });

    return res.json({ success: true, message: "Rate plan created", data: plan });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/rate-plans/:id
 */
export const updateRatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await RatePlan.findByIdAndUpdate(id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: "Rate plan not found" });

    return res.json({ success: true, message: "Rate plan updated", data: plan });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/rate-plans/evaluate-rate
 * Evaluates dynamic pricing, role discount caps, meal plan multipliers, and GST breakdown.
 */
export const evaluateRatePreview = async (req: Request, res: Response) => {
  try {
    const { basePrice, nights = 1, ratePlanCode = "BAR", occupancyPct = 0, requestedDiscountAmount = 0 } = req.body;
    const userRole = (req as any).user?.role || "RECEPTIONIST";

    if (!basePrice || Number(basePrice) <= 0) {
      return res.status(400).json({ success: false, message: "Valid basePrice is required" });
    }

    const plan = await RatePlan.findOne({ code: ratePlanCode.toUpperCase(), isActive: true });
    const multiplier = plan ? plan.multiplier : 1.0;

    const pricing = calculateDynamicBookingTotals({
      basePrice: Number(basePrice),
      nights: Number(nights),
      ratePlanMultiplier: multiplier,
      occupancyPct: Number(occupancyPct),
      requestedDiscountAmount: Number(requestedDiscountAmount),
      userRole,
    });

    return res.json({
      success: true,
      data: {
        ratePlan: plan || { name: "Standard BAR", code: "BAR", multiplier: 1.0 },
        pricing,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

