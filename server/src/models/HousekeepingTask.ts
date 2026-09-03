import mongoose, { Document, Schema } from "mongoose";

export enum HousekeepingStatus {
  DIRTY = "DIRTY",
  ASSIGNED = "ASSIGNED",
  CLEANING = "CLEANING",
  CLEAN = "CLEAN",
  INSPECTED = "INSPECTED",
}

export enum HousekeepingPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export interface IHousekeepingTask extends Document {
  room: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  status: HousekeepingStatus;
  priority: HousekeepingPriority;
  notes?: string;
  completedAt?: Date;
}

const HousekeepingTaskSchema = new Schema<IHousekeepingTask>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: Object.values(HousekeepingStatus), default: HousekeepingStatus.DIRTY },
    priority: { type: String, enum: Object.values(HousekeepingPriority), default: HousekeepingPriority.NORMAL },
    notes: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const HousekeepingTask = mongoose.model<IHousekeepingTask>("HousekeepingTask", HousekeepingTaskSchema);
