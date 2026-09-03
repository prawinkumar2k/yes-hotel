import mongoose, { Document, Schema } from "mongoose";

export enum PricingType {
  BASE = "BASE",
  WEEKEND = "WEEKEND",
  SEASONAL = "SEASONAL",
  SPECIAL = "SPECIAL",
  PROMO = "PROMO",
}

export interface IPricingRule extends Document {
  name: string;
  roomCategory: mongoose.Types.ObjectId;
  type: PricingType;
  startDate?: Date;
  endDate?: Date;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  price: number;
  priority: number;
  isActive: boolean;
}

const PricingRuleSchema = new Schema<IPricingRule>(
  {
    name: { type: String, required: true },
    roomCategory: { type: Schema.Types.ObjectId, ref: "RoomCategory", required: true },
    type: { type: String, enum: Object.values(PricingType), required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    price: { type: Number, required: true },
    priority: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PricingRule = mongoose.model<IPricingRule>("PricingRule", PricingRuleSchema);
