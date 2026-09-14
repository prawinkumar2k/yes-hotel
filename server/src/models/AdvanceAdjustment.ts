import mongoose, { Document, Schema } from "mongoose";

/**
 * AdvanceAdjustment — a single application of an advance balance to a folio.
 *
 * Records are immutable. Reversals create a new record with type=REVERSAL
 * pointing back at the original.
 *
 * Each adjustment:
 * 1. Decrements AdvancePayment.remainingBalance (atomically)
 * 2. Creates a FolioLine of type ADVANCE_ADJUSTMENT (credit)
 * 3. Creates this record for the audit chain
 */
export enum AdvanceAdjustmentType {
  ADJUSTMENT = "ADJUSTMENT",   // normal application to folio
  REFUND = "REFUND",           // cash refund of remaining advance
  TRANSFER = "TRANSFER",       // move to a different folio/booking
  REVERSAL = "REVERSAL",       // undo a previous adjustment
}

export enum AdvanceAdjustmentStatus {
  COMPLETED = "COMPLETED",
  REVERSED = "REVERSED",   // this adjustment was later reversed
  FAILED = "FAILED",
}

export interface IAdvanceAdjustment extends Document {
  advancePayment: mongoose.Types.ObjectId;
  folio?: mongoose.Types.ObjectId;          // the folio receiving the credit
  booking?: mongoose.Types.ObjectId;
  folioLine?: mongoose.Types.ObjectId;      // the FolioLine created by this adjustment
  type: AdvanceAdjustmentType;
  status: AdvanceAdjustmentStatus;
  amount: number;                           // always positive

  // For REVERSAL type
  reversedAdjustmentId?: mongoose.Types.ObjectId;

  // For TRANSFER type
  targetAdvancePaymentId?: mongoose.Types.ObjectId;

  performedBy: mongoose.Types.ObjectId;
  performedAt: Date;
  reason?: string;
  notes?: string;
}

const AdvanceAdjustmentSchema = new Schema<IAdvanceAdjustment>(
  {
    advancePayment: { type: Schema.Types.ObjectId, ref: "AdvancePayment", required: true, index: true },
    folio: { type: Schema.Types.ObjectId, ref: "Folio" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    folioLine: { type: Schema.Types.ObjectId, ref: "FolioLine" },
    type: { type: String, enum: Object.values(AdvanceAdjustmentType), required: true },
    status: {
      type: String,
      enum: Object.values(AdvanceAdjustmentStatus),
      default: AdvanceAdjustmentStatus.COMPLETED,
    },
    amount: { type: Number, required: true, min: 0 },
    reversedAdjustmentId: { type: Schema.Types.ObjectId, ref: "AdvanceAdjustment" },
    targetAdvancePaymentId: { type: Schema.Types.ObjectId, ref: "AdvancePayment" },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    performedAt: { type: Date, required: true, default: Date.now },
    reason: { type: String },
    notes: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // immutable once created
  }
);

AdvanceAdjustmentSchema.index({ booking: 1, type: 1 });
AdvanceAdjustmentSchema.index({ folio: 1 });

export const AdvanceAdjustment = mongoose.model<IAdvanceAdjustment>("AdvanceAdjustment", AdvanceAdjustmentSchema);
