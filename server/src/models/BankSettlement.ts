import mongoose, { Document, Schema } from "mongoose";

export interface IBankSettlement extends Document {
  paymentChannelId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  advancePaymentId?: mongoose.Types.ObjectId;
  transactionId?: string; // e.g. Razorpay payment ID
  bookingId?: mongoose.Types.ObjectId;
  folioId?: mongoose.Types.ObjectId;
  grossAmount: number;
  commission: number;
  gatewayFee: number;
  taxOnFee: number;
  expectedSettlement: number; // gross - commission - gatewayFee - tax
  actualSettlement?: number;
  settlementDate?: Date;
  bankReference?: string;
  difference: number;
  status: "PENDING" | "PARTIAL" | "RECONCILED" | "MISMATCH" | "DISPUTED" | "CLOSED";
  reconciledBy?: mongoose.Types.ObjectId;
  reconciledAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BankSettlementSchema = new Schema<IBankSettlement>(
  {
    paymentChannelId: { type: Schema.Types.ObjectId, ref: "PaymentChannel", required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    advancePaymentId: { type: Schema.Types.ObjectId, ref: "AdvancePayment" },
    transactionId: { type: String },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    folioId: { type: Schema.Types.ObjectId, ref: "Folio" },
    grossAmount: { type: Number, required: true },
    commission: { type: Number, default: 0 },
    gatewayFee: { type: Number, default: 0 },
    taxOnFee: { type: Number, default: 0 },
    expectedSettlement: { type: Number, required: true },
    actualSettlement: { type: Number },
    settlementDate: { type: Date },
    bankReference: { type: String },
    difference: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "RECONCILED", "MISMATCH", "DISPUTED", "CLOSED"],
      default: "PENDING",
    },
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
    reconciledAt: { type: Date },
    remarks: { type: String },
  },
  { timestamps: true }
);

export const BankSettlement = (mongoose.models.BankSettlement as mongoose.Model<IBankSettlement>) || mongoose.model<IBankSettlement>("BankSettlement", BankSettlementSchema);
