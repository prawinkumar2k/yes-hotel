import mongoose, { Document, Schema } from "mongoose";

export enum PaymentChannelType {
  CASH = "CASH",
  CARD = "CARD",
  UPI = "UPI",
  GATEWAY = "GATEWAY",
  BANK_TRANSFER = "BANK_TRANSFER",
  OTA_CREDIT = "OTA_CREDIT",
  CORPORATE_CREDIT = "CORPORATE_CREDIT",
  OTHER = "OTHER",
}

export interface IPaymentChannel extends Document {
  propertyId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  type: PaymentChannelType;
  provider?: string;
  settlementMode: "IMMEDIATE" | "T+1" | "T+2" | "T+3" | "END_OF_MONTH" | "CREDIT";
  commissionPercentage: number;
  fixedFee: number;
  taxOnFee: number;
  bankAccount?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const PaymentChannelSchema = new Schema<IPaymentChannel>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: Object.values(PaymentChannelType), required: true },
    provider: { type: String }, // e.g. "Razorpay", "HDFC"
    settlementMode: {
      type: String,
      enum: ["IMMEDIATE", "T+1", "T+2", "T+3", "END_OF_MONTH", "CREDIT"],
      default: "IMMEDIATE",
    },
    commissionPercentage: { type: Number, default: 0 },
    fixedFee: { type: Number, default: 0 },
    taxOnFee: { type: Number, default: 0 }, // percentage
    bankAccount: { type: String },
    description: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const PaymentChannel = (mongoose.models.PaymentChannel as mongoose.Model<IPaymentChannel>) || mongoose.model<IPaymentChannel>("PaymentChannel", PaymentChannelSchema);
