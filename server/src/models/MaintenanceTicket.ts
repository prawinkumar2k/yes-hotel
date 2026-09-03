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
  room: mongoose.Types.ObjectId;
  issueTitle: string;
  description?: string;
  priority: MaintenancePriority;
  assignedTo?: mongoose.Types.ObjectId;
  status: MaintenanceStatus;
  resolvedAt?: Date;
  /**
   * The room's status at the moment this ticket forced it into MAINTENANCE.
   * Without capturing this, resolving a ticket had to guess what to restore
   * the room to — and always guessed AVAILABLE, which is wrong whenever the
   * ticket was filed against a room that was actually OCCUPIED (a guest
   * reporting an issue mid-stay is a normal, real scenario): the room would
   * be marked available for a new booking while a guest was still in it.
   */
  roomStatusBeforeTicket?: RoomStatus;
}

const MaintenanceTicketSchema = new Schema<IMaintenanceTicket>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    issueTitle: { type: String, required: true },
    description: { type: String },
    priority: { type: String, enum: Object.values(MaintenancePriority), default: MaintenancePriority.MEDIUM },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: Object.values(MaintenanceStatus), default: MaintenanceStatus.OPEN },
    resolvedAt: { type: Date },
    roomStatusBeforeTicket: { type: String, enum: Object.values(RoomStatus) },
  },
  { timestamps: true }
);

export const MaintenanceTicket = mongoose.model<IMaintenanceTicket>("MaintenanceTicket", MaintenanceTicketSchema);
