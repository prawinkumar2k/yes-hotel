import mongoose, { Document, Schema } from "mongoose";

/**
 * AdvancePayment — a payment received before or at check-in, distinct from
 * a folio payment made at checkout.
 *
 * ADVANCE INVARIANT (must hold at all times):
 *   REMAINING = amount - totalAdjusted - totalRefunded + totalReversals
 *   REMAINING >= 0
 *
 * Advances are adjusted (applied to the folio) via AdvanceAdjustment records.
 * They are never modified in place — all changes are tracked through the
 * adjustment/refund/reversal chain.
 */
export enum AdvancePaymentStatus {
  RECEIVED = "RECEIVED",
  PARTIALLY_ADJUSTED = "PARTIALLY_ADJUSTED",
  FULLY_ADJUSTED = "FULLY_ADJUSTED",
  REFUNDED = "REFUNDED",         // fully refunded before adjustment
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  TRANSFERRED = "TRANSFERRED",   // moved to another reservation/guest
  EXPIRED = "EXPIRED",           // past expiry with no claim (rare)
  VOIDED = "VOIDED",             // cancelled by manager before use
}

export enum AdvancePaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  UPI = "UPI",
  BANK_TRANSFER = "BANK_TRANSFER",
  RAZORPAY = "RAZORPAY",
  CHEQUE = "CHEQUE",
  OTHER = "OTHER",
}

export interface IAdvancePayment extends Document {
  advanceNumber: string;       // human-readable ID, e.g. "ADV-2024-0001"
  booking?: mongoose.Types.ObjectId;
  guest: mongoose.Types.ObjectId;
  company?: mongoose.Types.ObjectId; // if corporate advance

  amount: number;              // total advance received
  totalAdjusted: number;       // sum of all adjustments applied so far
  totalRefunded: number;       // sum of refunds given
  remainingBalance: number;    // amount - totalAdjusted - totalRefunded

  method: AdvancePaymentMethod;
  referenceNumber?: string;    // cheque/transfer ref, Razorpay payment ID, etc.
  razorpayPaymentId?: string;

  status: AdvancePaymentStatus;
  receivedAt: Date;
  receivedBy: mongoose.Types.ObjectId; // cashier/receptionist
  purpose?: string;            // free text: "Booking deposit", "Event advance"
  expiresAt?: Date;            // optional: auto-expire unused advances

  notes?: string;
}

const AdvancePaymentSchema = new Schema<IAdvancePayment>(
  {
    advanceNumber: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", index: true },
    guest: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company" },

    amount: { type: Number, required: true, min: 0 },
    totalAdjusted: { type: Number, default: 0, min: 0 },
    totalRefunded: { type: Number, default: 0, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },

    method: { type: String, enum: Object.values(AdvancePaymentMethod), required: true },
    referenceNumber: { type: String },
    razorpayPaymentId: { type: String },

    status: {
      type: String,
      enum: Object.values(AdvancePaymentStatus),
      default: AdvancePaymentStatus.RECEIVED,
    },
    receivedAt: { type: Date, required: true, default: Date.now },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String },
    expiresAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

AdvancePaymentSchema.index({ guest: 1, status: 1 });
AdvancePaymentSchema.index({ status: 1, createdAt: -1 });
// Dashboard: today's advances
AdvancePaymentSchema.index({ receivedAt: -1 });

export const AdvancePayment = mongoose.model<IAdvancePayment>("AdvancePayment", AdvancePaymentSchema);
