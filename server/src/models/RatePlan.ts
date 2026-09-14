import mongoose, { Document, Schema } from "mongoose";

export enum MealPlanType {
  EP = "EP", // European Plan (Room only)
  CP = "CP", // Continental Plan (Room + Breakfast)
  MAP = "MAP", // Modified American Plan (Room + Breakfast + Lunch or Dinner)
  AP = "AP", // American Plan (All Meals included)
}

export interface IRatePlan extends Document {
  name: string;
  code: string;
  mealPlan: MealPlanType;
  cancellationPolicy: string;
  multiplier: number; // e.g. 1.0 for BAR, 0.85 for Corporate 15% off
  isActive: boolean;
  notes?: string;
}

const RatePlanSchema = new Schema<IRatePlan>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    mealPlan: { type: String, enum: Object.values(MealPlanType), default: MealPlanType.CP },
    cancellationPolicy: { type: String, default: "Free cancellation up to 24h before check-in" },
    multiplier: { type: Number, required: true, default: 1.0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const RatePlan = (mongoose.models.RatePlan as mongoose.Model<IRatePlan>) || mongoose.model<IRatePlan>("RatePlan", RatePlanSchema);
