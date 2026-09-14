import mongoose, { Document, Schema } from "mongoose";

export enum CashierShiftStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  RECONCILED = "RECONCILED",
}

export interface ICashierShift extends Document {
  shiftNumber: string;
  cashier: mongoose.Types.ObjectId;
  openedAt: Date;
  closedAt?: Date;
  openingFloat: number;
  expectedCash: number;
  expectedUpi: number;
  expectedCard: number;
  actualCashCounted?: number;
  cashVariance?: number;
  notes?: string;
  status: CashierShiftStatus;
}

const CashierShiftSchema = new Schema<ICashierShift>(
  {
    shiftNumber: { type: String, required: true, unique: true },
    cashier: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    openingFloat: { type: Number, required: true, min: 0 },
    expectedCash: { type: Number, default: 0 },
    expectedUpi: { type: Number, default: 0 },
    expectedCard: { type: Number, default: 0 },
    actualCashCounted: { type: Number },
    cashVariance: { type: Number },
    notes: { type: String },
    status: {
      type: String,
      enum: Object.values(CashierShiftStatus),
      default: CashierShiftStatus.OPEN,
    },
  },
  { timestamps: true }
);

export const CashierShift = (mongoose.models.CashierShift as mongoose.Model<ICashierShift>) || mongoose.model<ICashierShift>("CashierShift", CashierShiftSchema);
