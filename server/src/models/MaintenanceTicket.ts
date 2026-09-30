import mongoose, { Document, Schema } from "mongoose";
import { RoomStatus } from "./Room";

export enum MaintenancePriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum MaintenanceStatus {
  OPEN = "OPEN",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export interface IMaintenanceTicket extends Document {
  propertyId: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  issueTitle: string;
  description?: string;
  priority: MaintenancePriority;
  assignedTo?: mongoose.Types.ObjectId;
  status: MaintenanceStatus;
  resolvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  roomStatusBeforeTicket?: RoomStatus;
}

const MaintenanceTicketSchema = new Schema<IMaintenanceTicket>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    issueTitle: { type: String, required: true },
    description: { type: String },
    priority: { type: String, enum: Object.values(MaintenancePriority), default: MaintenancePriority.MEDIUM },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: Object.values(MaintenanceStatus), default: MaintenanceStatus.OPEN },
    resolvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    roomStatusBeforeTicket: { type: String, enum: Object.values(RoomStatus) },
  },
  { timestamps: true }
);

export const MaintenanceTicket = (mongoose.models.MaintenanceTicket as mongoose.Model<IMaintenanceTicket>) || mongoose.model<IMaintenanceTicket>("MaintenanceTicket", MaintenanceTicketSchema);
