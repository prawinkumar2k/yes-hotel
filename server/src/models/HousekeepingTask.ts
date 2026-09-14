import mongoose, { Document, Schema } from "mongoose";

/**
 * Extended housekeeping status lifecycle:
 *
 * DIRTY → ASSIGNED → CLEANING → CLEANING_COMPLETED → INSPECTION →
 * INSPECTION_FAILED → (re-assigned for re-clean, or MAINTENANCE)
 * INSPECTION → INSPECTED → WAITING_FOR_RELEASE → [MANUAL RELEASE] → CLEAN
 *
 * CRITICAL: CLEANING_COMPLETED does NOT mean sellable.
 * INSPECTED does NOT mean sellable.
 * Only CLEAN (after authorized manual release) makes the room sellable.
 *
 * DND and REFUSED_SERVICE are lateral states that don't block the flow,
 * but they skip the normal cleaning trigger.
 */
export enum HousekeepingStatus {
  // ── LEGACY (preserved for existing code) ──
  DIRTY = "DIRTY",
  ASSIGNED = "ASSIGNED",
  CLEANING = "CLEANING",
  CLEAN = "CLEAN",
  INSPECTED = "INSPECTED",

  // ── NEW ──
  CLEANING_COMPLETED = "CLEANING_COMPLETED", // housekeeper done, pending supervisor inspection
  INSPECTION = "INSPECTION",                 // supervisor actively inspecting
  INSPECTION_FAILED = "INSPECTION_FAILED",   // inspection failed — re-clean required
  WAITING_FOR_RELEASE = "WAITING_FOR_RELEASE", // inspected, awaiting authorized release
  DND = "DND",                               // Do Not Disturb — skip service
  REFUSED_SERVICE = "REFUSED_SERVICE",       // guest declined service
}

export enum HousekeepingPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum HousekeepingTaskType {
  CHECKOUT_CLEAN = "CHECKOUT_CLEAN",   // after guest checkout
  STAYOVER_CLEAN = "STAYOVER_CLEAN",   // daily service for in-house guest
  DEEP_CLEAN = "DEEP_CLEAN",
  TURNDOWN = "TURNDOWN",
  INSPECTION = "INSPECTION",
  TOUCH_UP = "TOUCH_UP",               // quick tidy after inspection failure
}

export interface IHousekeepingTask extends Document {
  room: mongoose.Types.ObjectId;
  booking?: mongoose.Types.ObjectId;   // the booking that triggered this task
  taskType: HousekeepingTaskType;
  assignedTo?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  status: HousekeepingStatus;
  priority: HousekeepingPriority;
  notes?: string;

  // Timestamps for each lifecycle step
  startedAt?: Date;
  completedAt?: Date;
  inspectionStartedAt?: Date;
  inspectedAt?: Date;
  releasedAt?: Date;
  releasedBy?: mongoose.Types.ObjectId;

  // Inspection link
  inspectionResultId?: mongoose.Types.ObjectId;

  // Issue reporting during cleaning
  reportedIssues?: {
    type: "DAMAGE" | "MISSING" | "MAINTENANCE" | "LOST_AND_FOUND" | "OTHER";
    description: string;
    reportedAt: Date;
    maintenanceTicketId?: mongoose.Types.ObjectId;
  }[];

  // Guest amenities delivered
  amenitiesDelivered?: string[];

  // Turnaround time tracking
  turnaroundMinutes?: number; // completedAt - assignedAt
}

const HousekeepingTaskSchema = new Schema<IHousekeepingTask>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    taskType: {
      type: String,
      enum: Object.values(HousekeepingTaskType),
      default: HousekeepingTaskType.CHECKOUT_CLEAN,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(HousekeepingStatus),
      default: HousekeepingStatus.DIRTY,
    },
    priority: {
      type: String,
      enum: Object.values(HousekeepingPriority),
      default: HousekeepingPriority.NORMAL,
    },
    notes: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    inspectionStartedAt: { type: Date },
    inspectedAt: { type: Date },
    releasedAt: { type: Date },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User" },
    inspectionResultId: { type: Schema.Types.ObjectId, ref: "InspectionResult" },
    reportedIssues: [
      {
        type: {
          type: String,
          enum: ["DAMAGE", "MISSING", "MAINTENANCE", "LOST_AND_FOUND", "OTHER"],
          required: true,
        },
        description: { type: String, required: true },
        reportedAt: { type: Date, default: Date.now },
        maintenanceTicketId: { type: Schema.Types.ObjectId, ref: "MaintenanceTicket" },
        _id: false,
      },
    ],
    amenitiesDelivered: [{ type: String }],
    turnaroundMinutes: { type: Number },
  },
  { timestamps: true }
);

// Housekeeping dashboard
HousekeepingTaskSchema.index({ status: 1, priority: -1, createdAt: 1 });
// My rooms (housekeeper view)
HousekeepingTaskSchema.index({ assignedTo: 1, status: 1 });
// Room history
HousekeepingTaskSchema.index({ room: 1, createdAt: -1 });

export const HousekeepingTask = mongoose.model<IHousekeepingTask>("HousekeepingTask", HousekeepingTaskSchema);
