import { Request, Response } from "express";
import { RatePlan, MealPlanType } from "../models/RatePlan";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/rate-plans
 */
export const getRatePlans = async (_req: Request, res: Response) => {
  try {
    let plans = await RatePlan.find().sort({ code: 1 }).lean();

    // Seed default rate plans if none exist
    if (plans.length === 0) {
      await RatePlan.insertMany([
        { name: "Best Available Rate (BAR)", code: "BAR", mealPlan: MealPlanType.EP, multiplier: 1.0, cancellationPolicy: "Free cancellation up to 24h before check-in" },
        { name: "Bed & Breakfast Plan (CP)", code: "CP", mealPlan: MealPlanType.CP, multiplier: 1.12, cancellationPolicy: "Free cancellation up to 24h before check-in" },
        { name: "Half Board Meal Plan (MAP)", code: "MAP", mealPlan: MealPlanType.MAP, multiplier: 1.25, cancellationPolicy: "Non-refundable" },
        { name: "Corporate Discount Rate", code: "CORP", mealPlan: MealPlanType.CP, multiplier: 0.85, cancellationPolicy: "Flexible corporate policy" },
      ]);
      plans = await RatePlan.find().sort({ code: 1 }).lean();
    }

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
