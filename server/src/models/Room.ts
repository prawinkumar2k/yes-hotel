import mongoose, { Document, Schema } from "mongoose";

export enum RoomStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  OCCUPIED = "OCCUPIED",
  CLEANING = "CLEANING",
  MAINTENANCE = "MAINTENANCE",
  OUT_OF_SERVICE = "OUT_OF_SERVICE",
}

export interface IRoom extends Document {
  roomNumber: string;
  category: mongoose.Types.ObjectId;
  floor: string;
  status: RoomStatus;
  maintenanceNotes?: string;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomNumber: { type: String, required: true, unique: true },
    category: { type: Schema.Types.ObjectId, ref: "RoomCategory", required: true },
    floor: { type: String, required: true },
    status: { type: String, enum: Object.values(RoomStatus), default: RoomStatus.AVAILABLE },
    maintenanceNotes: { type: String },
  },
  { timestamps: true }
);

export const Room = mongoose.model<IRoom>("Room", RoomSchema);
