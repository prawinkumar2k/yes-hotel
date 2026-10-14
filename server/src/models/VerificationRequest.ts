import mongoose, { Document, Schema } from "mongoose";

/**
 * Reception verification queue: completed work that must be checked.
 *
 *  - Created automatically when the original task is completed (never before), so the
 *    reviewer always verifies finished work.
 *  - PENDING → APPROVED (verified) | REJECTED (returned to `returnQueue` with a reason).
 *  - When the returned work is corrected, a new PENDING attempt is created and linked
 *    through `resubmissionOf` (the rejected one keeps its history).
 */
export enum VerificationType {
  ROOM_RELEASE = "ROOM_RELEASE",
  SHIFT_VARIANCE = "SHIFT_VARIANCE",
  REFUND = "REFUND",
  TARIFF_BELOW_DEFAULT = "TARIFF_BELOW_DEFAULT",
  FOLIO_VOID = "FOLIO_VOID",
  CANCEL_WITH_ADVANCE = "CANCEL_WITH_ADVANCE",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export type ReturnQueue = "HOUSEKEEPING" | "FRONT_DESK" | "CASHIER";

export interface IVerificationHistory {
  at: Date;
  by?: mongoose.Types.ObjectId;
  role?: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "RESUBMITTED";
  note?: string;
}

export interface IVerificationRequest extends Document {
  propertyId?: mongoose.Types.ObjectId;
  type: VerificationType;
  status: VerificationStatus;
  /** What is being verified; at most one PENDING request per subject. */
  subjectKey: string;
  returnQueue: ReturnQueue;
  booking?: mongoose.Types.ObjectId;
  folio?: mongoose.Types.ObjectId;
  room?: mongoose.Types.ObjectId;
  amount?: number;
  summary: string;
  /** Facts the reviewer needs (guest, room, booking reference, before/after values…). */
  details?: Record<string, any>;
  /** Who completed the original task, and their note. */
  submittedBy?: mongoose.Types.ObjectId;
  submittedRole?: string;
  submittedNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  resubmissionOf?: mongoose.Types.ObjectId;
  /** Set on a REJECTED request once its correction has been resubmitted. */
  resubmittedAs?: mongoose.Types.ObjectId;
  attempt: number;
  history: IVerificationHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema<IVerificationHistory>(
  {
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    role: { type: String },
    action: { type: String, required: true },
    note: { type: String },
  },
  { _id: false },
);

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    type: { type: String, enum: Object.values(VerificationType), required: true },
    status: { type: String, enum: Object.values(VerificationStatus), required: true, default: VerificationStatus.PENDING },
    subjectKey: { type: String, required: true },
    returnQueue: { type: String, enum: ["HOUSEKEEPING", "FRONT_DESK", "CASHIER"], required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    folio: { type: Schema.Types.ObjectId, ref: "Folio" },
    room: { type: Schema.Types.ObjectId, ref: "Room" },
    amount: { type: Number },
    summary: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedRole: { type: String },
    submittedNote: { type: String, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
    resubmissionOf: { type: Schema.Types.ObjectId, ref: "VerificationRequest" },
    resubmittedAs: { type: Schema.Types.ObjectId, ref: "VerificationRequest" },
    attempt: { type: Number, default: 1 },
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true },
);

// One PENDING request per subject: the same completed work is never queued twice.
VerificationRequestSchema.index(
  { subjectKey: 1 },
  { unique: true, partialFilterExpression: { status: VerificationStatus.PENDING }, name: "one_pending_per_subject" },
);
VerificationRequestSchema.index({ status: 1, createdAt: -1 });
VerificationRequestSchema.index({ returnQueue: 1, status: 1 });
VerificationRequestSchema.index({ booking: 1 });

export const VerificationRequest =
  (mongoose.models.VerificationRequest as mongoose.Model<IVerificationRequest>) ||
  mongoose.model<IVerificationRequest>("VerificationRequest", VerificationRequestSchema);
