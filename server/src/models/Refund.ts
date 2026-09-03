import mongoose, { Document, Schema } from "mongoose";

export enum RefundStatus {
  REQUESTED = "REQUESTED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface IRefund extends Document {
  booking: mongoose.Types.ObjectId;
  payment: mongoose.Types.ObjectId;
  amount: number;
  reason: string;
  status: RefundStatus;
  razorpayRefundId?: string;
  initiatedBy: mongoose.Types.ObjectId;
}

const RefundSchema = new Schema<IRefund>(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: Object.values(RefundStatus), default: RefundStatus.REQUESTED },
    razorpayRefundId: { type: String },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

RefundSchema.index({ payment: 1 });
RefundSchema.index({ status: 1, createdAt: -1 });

export const Refund = mongoose.model<IRefund>("Refund", RefundSchema);
