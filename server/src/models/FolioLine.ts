import mongoose, { Document, Schema } from "mongoose";

/**
 * FolioLine — a single immutable transaction line on a Folio.
 *
 * Rules:
 * - Lines are NEVER updated or deleted once created.
 * - Corrections create a reversal line (negative amount, lineType=REVERSAL)
 *   followed by a corrected line.
 * - Every line records who posted it and when.
 *
 * Debit lines (increase balance): ROOM_CHARGE, EXTRA_PERSON, EXTRA_BED,
 *   EARLY_CHECK_IN, LATE_CHECK_OUT, LAUNDRY, MINIBAR, RESTAURANT, ADDON, TAX
 *
 * Credit lines (decrease balance): PAYMENT, ADVANCE_ADJUSTMENT,
 *   DISCOUNT, REFUND, REVERSAL, COMPLIMENTARY
 */
export enum FolioLineType {
  // ── DEBIT (charges) ──
  ROOM_CHARGE = "ROOM_CHARGE",
  EXTRA_PERSON = "EXTRA_PERSON",
  EXTRA_BED = "EXTRA_BED",
  EARLY_CHECK_IN = "EARLY_CHECK_IN",
  LATE_CHECK_OUT = "LATE_CHECK_OUT",
  LAUNDRY = "LAUNDRY",
  MINIBAR = "MINIBAR",
  RESTAURANT = "RESTAURANT",
  SPA = "SPA",
  TRANSPORT = "TRANSPORT",
  ADDON = "ADDON",
  // ── TAX ──
  TAX_CGST = "TAX_CGST",
  TAX_SGST = "TAX_SGST",
  TAX_IGST = "TAX_IGST",
  // ── CREDIT ──
  DISCOUNT = "DISCOUNT",
  PAYMENT = "PAYMENT",
  ADVANCE_ADJUSTMENT = "ADVANCE_ADJUSTMENT",
  REFUND = "REFUND",
  COMPLIMENTARY = "COMPLIMENTARY",
  REVERSAL = "REVERSAL",
}

export enum FolioLineDirection {
  DEBIT = "DEBIT",   // increases balance owed
  CREDIT = "CREDIT", // decreases balance owed
}

// Map each line type to its direction — used by the service layer for
// automatic balance computation without letting the caller specify direction.
export const LINE_TYPE_DIRECTION: Record<FolioLineType, FolioLineDirection> = {
  [FolioLineType.ROOM_CHARGE]: FolioLineDirection.DEBIT,
  [FolioLineType.EXTRA_PERSON]: FolioLineDirection.DEBIT,
  [FolioLineType.EXTRA_BED]: FolioLineDirection.DEBIT,
  [FolioLineType.EARLY_CHECK_IN]: FolioLineDirection.DEBIT,
  [FolioLineType.LATE_CHECK_OUT]: FolioLineDirection.DEBIT,
  [FolioLineType.LAUNDRY]: FolioLineDirection.DEBIT,
  [FolioLineType.MINIBAR]: FolioLineDirection.DEBIT,
  [FolioLineType.RESTAURANT]: FolioLineDirection.DEBIT,
  [FolioLineType.SPA]: FolioLineDirection.DEBIT,
  [FolioLineType.TRANSPORT]: FolioLineDirection.DEBIT,
  [FolioLineType.ADDON]: FolioLineDirection.DEBIT,
  [FolioLineType.TAX_CGST]: FolioLineDirection.DEBIT,
  [FolioLineType.TAX_SGST]: FolioLineDirection.DEBIT,
  [FolioLineType.TAX_IGST]: FolioLineDirection.DEBIT,
  [FolioLineType.DISCOUNT]: FolioLineDirection.CREDIT,
  [FolioLineType.PAYMENT]: FolioLineDirection.CREDIT,
  [FolioLineType.ADVANCE_ADJUSTMENT]: FolioLineDirection.CREDIT,
  [FolioLineType.REFUND]: FolioLineDirection.CREDIT,
  [FolioLineType.COMPLIMENTARY]: FolioLineDirection.CREDIT,
  [FolioLineType.REVERSAL]: FolioLineDirection.CREDIT,
};

export interface IFolioLine extends Document {
  folio: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;  // denormalized for reporting queries
  lineType: FolioLineType;
  direction: FolioLineDirection;
  description: string;
  amount: number;          // always positive; direction determines debit/credit
  quantity?: number;
  unitPrice?: number;
  date: Date;              // the business date this charge applies to
  postedAt: Date;          // when this line was actually created in the system
  postedBy: mongoose.Types.ObjectId;

  // Optional links
  advancePaymentId?: mongoose.Types.ObjectId;  // if ADVANCE_ADJUSTMENT
  paymentId?: mongoose.Types.ObjectId;          // if PAYMENT
  refundId?: mongoose.Types.ObjectId;           // if REFUND
  reversedLineId?: mongoose.Types.ObjectId;     // if REVERSAL — points to the line being reversed

  // Night audit
  businessDate?: Date;    // hotel business date when posted

  notes?: string;
}

const FolioLineSchema = new Schema<IFolioLine>(
  {
    folio: { type: Schema.Types.ObjectId, ref: "Folio", required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    lineType: { type: String, enum: Object.values(FolioLineType), required: true },
    direction: { type: String, enum: Object.values(FolioLineDirection), required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number },
    date: { type: Date, required: true },
    postedAt: { type: Date, required: true, default: Date.now },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    advancePaymentId: { type: Schema.Types.ObjectId, ref: "AdvancePayment" },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    refundId: { type: Schema.Types.ObjectId, ref: "Refund" },
    reversedLineId: { type: Schema.Types.ObjectId, ref: "FolioLine" },
    businessDate: { type: Date },
    notes: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // immutable — no updatedAt
  }
);

// Reporting: all lines for a folio ordered by posting time
FolioLineSchema.index({ folio: 1, postedAt: 1 });
// Night audit: find all ROOM_CHARGE lines posted on a given business date
FolioLineSchema.index({ businessDate: 1, lineType: 1 });
// GST reporting
FolioLineSchema.index({ booking: 1, lineType: 1 });

// ── INDEXES ──
FolioLineSchema.index({ folio: 1, createdAt: -1 });
// Phase 24/26 Analytics & Night Audit indexes
FolioLineSchema.index({ direction: 1, createdAt: -1 });
FolioLineSchema.index({ lineType: 1, direction: 1, createdAt: -1 });
FolioLineSchema.index({ businessDate: 1, lineType: 1 });

export const FolioLine = mongoose.model<IFolioLine>("FolioLine", FolioLineSchema);
