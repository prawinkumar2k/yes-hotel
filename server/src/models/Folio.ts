import mongoose, { Document, Schema } from "mongoose";

/**
 * Folio — a live, append-only financial ledger for a guest stay.
 *
 * Every booking check-in creates exactly one Folio. All room charges,
 * additional charges, discounts, taxes, advance adjustments, and payments
 * are recorded as FolioLine entries — never by mutating existing entries.
 * Corrections create reversal lines.
 *
 * FINANCIAL INVARIANT (must hold at all times):
 *   BALANCE = SUM(debit lines) - SUM(credit lines)
 *   where debit lines = charges + taxes
 *         credit lines = payments + advance_adjustments + discounts + reversals
 */
export enum FolioStatus {
  OPEN = "OPEN",         // guest is in-house
  FINALIZED = "FINALIZED", // checkout initiated, awaiting settlement
  SETTLED = "SETTLED",   // fully paid / zero balance
  CLOSED = "CLOSED",     // archived after checkout
  VOIDED = "VOIDED",     // cancelled before checkout (e.g. no-show)
}

export interface IFolio extends Document {
  booking: mongoose.Types.ObjectId;
  guest: mongoose.Types.ObjectId;     // Guest document (CRM)
  room: mongoose.Types.ObjectId;
  checkInDate: Date;
  checkOutDate: Date;
  status: FolioStatus;

  // Running totals (recomputed on each line insertion — never trusted as source of truth,
  // always recomputed from FolioLine for reports/invariant checks)
  totalCharges: number;      // sum of ROOM_CHARGE + ADDON + EXTRA_PERSON etc.
  totalDiscounts: number;    // sum of DISCOUNT lines
  totalTax: number;          // sum of TAX lines
  totalPaid: number;         // sum of PAYMENT lines
  totalAdvanceAdjusted: number; // sum of ADVANCE_ADJUSTMENT lines
  balance: number;           // totalCharges + totalTax - totalDiscounts - totalPaid - totalAdvanceAdjusted

  // Tax breakdown
  cgst: number;
  sgst: number;
  igst: number;

  // Folio notes and special instructions
  notes?: string;
  invoiceNumber?: string;
  invoiceGeneratedAt?: Date;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
}

const FolioSchema = new Schema<IFolio>(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    guest: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(FolioStatus),
      default: FolioStatus.OPEN,
    },
    totalCharges: { type: Number, default: 0, min: 0 },
    totalDiscounts: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    totalAdvanceAdjusted: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },
    cgst: { type: Number, default: 0, min: 0 },
    sgst: { type: Number, default: 0, min: 0 },
    igst: { type: Number, default: 0, min: 0 },
    notes: { type: String },
    invoiceNumber: { type: String },
    invoiceGeneratedAt: { type: Date },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

FolioSchema.index({ status: 1, booking: 1 });
FolioSchema.index({ invoiceNumber: 1 }, { sparse: true, unique: true });

export const Folio = mongoose.model<IFolio>("Folio", FolioSchema);
