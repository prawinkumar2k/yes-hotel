import mongoose, { Document, Schema } from "mongoose";

export interface IComplaint extends Document {
  guestId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  roomNumber?: string;
  department: "HOUSEKEEPING" | "MAINTENANCE" | "FRONT_DESK" | "F_AND_B" | "OTHER";
  issue: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  reportedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  slaBreachTime: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    roomNumber: { type: String },
    department: {
      type: String,
      enum: ["HOUSEKEEPING", "MAINTENANCE", "FRONT_DESK", "F_AND_B", "OTHER"],
      required: true,
    },
    issue: { type: String, required: true },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      default: "OPEN",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    reportedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
    slaBreachTime: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Complaint = (mongoose.models.Complaint as mongoose.Model<IComplaint>) || mongoose.model<IComplaint>("Complaint", ComplaintSchema);
