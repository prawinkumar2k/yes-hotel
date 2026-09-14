import mongoose, { Document, Schema } from "mongoose";

/**
 * InspectionTemplate — a configurable checklist of items that must be
 * verified when a supervisor inspects a room after cleaning.
 *
 * One template can be the hotel default; specific room categories may have
 * their own templates (e.g., a suite has extra items).
 */
export interface IInspectionItem {
  itemCode: string;       // e.g. "BED_LINEN", "BATHROOM_CLEAN"
  label: string;          // human-readable: "Bed & Linen"
  category: string;       // "BED", "BATHROOM", "ELECTRONICS", "SAFETY", "CLEANLINESS"
  isMandatory: boolean;   // if true, a FAIL blocks room release
  sortOrder: number;
}

export interface IInspectionTemplate extends Document {
  name: string;
  description?: string;
  isDefault: boolean;     // hotel-wide default template
  roomCategories: mongoose.Types.ObjectId[]; // if empty, applies to all
  items: IInspectionItem[];
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const InspectionItemSchema = new Schema<IInspectionItem>(
  {
    itemCode: { type: String, required: true },
    label: { type: String, required: true },
    category: { type: String, required: true },
    isMandatory: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const InspectionTemplateSchema = new Schema<IInspectionTemplate>(
  {
    name: { type: String, required: true },
    description: { type: String },
    isDefault: { type: Boolean, default: false },
    roomCategories: [{ type: Schema.Types.ObjectId, ref: "RoomCategory" }],
    items: [InspectionItemSchema],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

InspectionTemplateSchema.index({ isDefault: 1 });

export const InspectionTemplate = mongoose.model<IInspectionTemplate>("InspectionTemplate", InspectionTemplateSchema);


/**
 * InspectionResult — a single completed room inspection, recording each
 * checklist item's result (PASS / FAIL / NA).
 *
 * A PASS result on all mandatory items allows the room to move to
 * WAITING_FOR_RELEASE. Any FAIL on a mandatory item blocks release.
 *
 * Records are immutable. A failed inspection that is later re-inspected
 * creates a NEW InspectionResult — it does not modify the failed one.
 */
export enum InspectionOutcome {
  PASS = "PASS",
  FAIL = "FAIL",
  NA = "NA",
}

export enum InspectionResultStatus {
  PASSED = "PASSED",
  FAILED = "FAILED",
  PARTIAL = "PARTIAL",  // some items FAIL but none are mandatory
}

export interface IInspectionLineResult {
  itemCode: string;
  label: string;
  isMandatory: boolean;
  outcome: InspectionOutcome;
  notes?: string;
}

export interface IInspectionResult extends Document {
  room: mongoose.Types.ObjectId;
  housekeepingTask?: mongoose.Types.ObjectId;
  template?: mongoose.Types.ObjectId;
  inspectedBy: mongoose.Types.ObjectId;
  inspectedAt: Date;
  status: InspectionResultStatus;

  items: IInspectionLineResult[];

  failedItems: string[];   // itemCodes that failed — for quick query/alert
  mandatoryFailed: boolean; // true if ANY mandatory item failed

  // If failed, what action was triggered
  triggeredReclean?: boolean;
  triggeredMaintenance?: boolean;
  maintenanceTicketId?: mongoose.Types.ObjectId;

  overallNotes?: string;
}

const InspectionLineResultSchema = new Schema<IInspectionLineResult>(
  {
    itemCode: { type: String, required: true },
    label: { type: String, required: true },
    isMandatory: { type: Boolean, required: true },
    outcome: { type: String, enum: Object.values(InspectionOutcome), required: true },
    notes: { type: String },
  },
  { _id: false }
);

const InspectionResultSchema = new Schema<IInspectionResult>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    housekeepingTask: { type: Schema.Types.ObjectId, ref: "HousekeepingTask" },
    template: { type: Schema.Types.ObjectId, ref: "InspectionTemplate" },
    inspectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inspectedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: Object.values(InspectionResultStatus), required: true },
    items: [InspectionLineResultSchema],
    failedItems: [{ type: String }],
    mandatoryFailed: { type: Boolean, default: false },
    triggeredReclean: { type: Boolean },
    triggeredMaintenance: { type: Boolean },
    maintenanceTicketId: { type: Schema.Types.ObjectId, ref: "MaintenanceTicket" },
    overallNotes: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

InspectionResultSchema.index({ room: 1, inspectedAt: -1 });
InspectionResultSchema.index({ housekeepingTask: 1 });

export const InspectionResult = mongoose.model<IInspectionResult>("InspectionResult", InspectionResultSchema);
