import mongoose, { Document, Schema } from "mongoose";

/**
 * BusinessDate — the hotel's current operational date.
 *
 * The hotel business date is NOT the same as the calendar date. A hotel that
 * runs night audit at 2am on Sep 15 is still operating on Sep 14's business
 * date until the audit closes and advances to Sep 15.
 *
 * This is a SINGLETON — only one document should exist with isCurrentDate=true.
 * Night audit closes the current date and opens the next.
 *
 * CRITICAL: Closed business dates are immutable. Any financial correction to a
 * closed date must go through a controlled adjustment workflow (not a direct
 * write to the closed date's records).
 */
export enum BusinessDateState {
  OPEN = "OPEN",       // current operational day
  AUDITING = "AUDITING", // night audit is in progress (transitional)
  CLOSED = "CLOSED",   // night audit completed, date is locked
}

export interface IBusinessDate extends Document {
  date: Date;           // the hotel business date (midnight UTC)
  state: BusinessDateState;
  isCurrentDate: boolean; // true for exactly one document at any time

  openedAt: Date;
  openedBy?: mongoose.Types.ObjectId;

  auditStartedAt?: Date;
  auditStartedBy?: mongoose.Types.ObjectId;

  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;

  // Night audit summary (populated when CLOSED)
  auditSummary?: {
    roomChargesPosted: number;
    roomChargesAmount: number;
    noShowsProcessed: number;
    arrivalsCount: number;
    departuresCount: number;
    inHouseCount: number;
    totalRevenue: number;
    totalTax: number;
    totalCollection: number;
    totalRefunds: number;
    totalAdvances: number;
    totalAdvanceAdjustments: number;
    openFoliosCount: number;
    exceptions: string[];
  };

  notes?: string;
}

const BusinessDateSchema = new Schema<IBusinessDate>(
  {
    date: { type: Date, required: true },
    state: {
      type: String,
      enum: Object.values(BusinessDateState),
      default: BusinessDateState.OPEN,
    },
    isCurrentDate: { type: Boolean, default: false },
    openedAt: { type: Date, required: true, default: Date.now },
    openedBy: { type: Schema.Types.ObjectId, ref: "User" },
    auditStartedAt: { type: Date },
    auditStartedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    auditSummary: {
      roomChargesPosted: { type: Number },
      roomChargesAmount: { type: Number },
      noShowsProcessed: { type: Number },
      arrivalsCount: { type: Number },
      departuresCount: { type: Number },
      inHouseCount: { type: Number },
      totalRevenue: { type: Number },
      totalTax: { type: Number },
      totalCollection: { type: Number },
      totalRefunds: { type: Number },
      totalAdvances: { type: Number },
      totalAdvanceAdjustments: { type: Number },
      openFoliosCount: { type: Number },
      exceptions: [{ type: String }],
    },
    notes: { type: String },
  },
  { timestamps: true }
);

// Ensures only one OPEN date at a time — a database-level guarantee rather
// than application-level hope. This MUST be a partial index scoped to
// isCurrentDate: true, not `sparse`: sparse only exempts documents where
// the field is entirely missing, but every document here has an explicit
// boolean (default: false), so a plain unique+sparse index also uniquely
// constrains the value `false` across the whole collection — meaning the
// SECOND business date ever closed (isCurrentDate set to false) collides
// with the first, and every Night Audit after that permanently fails with
// a duplicate-key error. Reproduced live: night audit worked once, then
// failed on every subsequent run with E11000 on `{ isCurrentDate: false }`.
BusinessDateSchema.index(
  { isCurrentDate: 1 },
  { unique: true, partialFilterExpression: { isCurrentDate: true } }
);
BusinessDateSchema.index({ date: 1 });
BusinessDateSchema.index({ state: 1 });

export const BusinessDate = (mongoose.models.BusinessDate as mongoose.Model<IBusinessDate>) || mongoose.model<IBusinessDate>("BusinessDate", BusinessDateSchema);
