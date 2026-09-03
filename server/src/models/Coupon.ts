import mongoose, { Document, Schema } from "mongoose";

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

export interface ICoupon extends Document {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minBookingAmount?: number;
  maxDiscount?: number;
  applicableRoomCategories?: mongoose.Types.ObjectId[];
  startDate: Date;
  expiryDate: Date;
  usageLimit?: number;
  perUserLimit?: number;
  timesUsed: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    discountType: { type: String, enum: Object.values(DiscountType), required: true },
    discountValue: { type: Number, required: true },
    minBookingAmount: { type: Number },
    maxDiscount: { type: Number },
    applicableRoomCategories: [{ type: Schema.Types.ObjectId, ref: "RoomCategory" }],
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number },
    perUserLimit: { type: Number, default: 1 },
    timesUsed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);
