import mongoose, { Schema, Document } from "mongoose";

export enum BanquetStatus {
  INQUIRY = "INQUIRY",
  QUOTATION_SENT = "QUOTATION_SENT",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface IBanquetBooking extends Document {
  bookingNumber: string;
  eventName: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  hallName: string; // e.g. "Grand Ball Room", "Emerald Convention Hall"
  eventDate: Date;
  startTime: string;
  endTime: string;
  expectedPax: number;
  menuPackage: string; // e.g. "Royal Wedding Buffet", "Corporate Seminar CP"
  ratePerPax: number;
  totalEstimatedAmount: number;
  advancePaid: number;
  folioId?: mongoose.Types.ObjectId;
  status: BanquetStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BanquetBookingSchema: Schema = new Schema(
  {
    bookingNumber: { type: String, required: true, unique: true, uppercase: true },
    eventName: { type: String, required: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    clientPhone: { type: String, required: true, trim: true },
    clientEmail: { type: String, trim: true },
    hallName: { type: String, required: true, default: "Grand Ball Room" },
    eventDate: { type: Date, required: true },
    startTime: { type: String, default: "10:00 AM" },
    endTime: { type: String, default: "10:00 PM" },
    expectedPax: { type: Number, required: true, default: 50 },
    menuPackage: { type: String, default: "Standard Buffet" },
    ratePerPax: { type: Number, required: true, default: 1000 },
    totalEstimatedAmount: { type: Number, required: true, default: 50000 },
    advancePaid: { type: Number, default: 0 },
    folioId: { type: Schema.Types.ObjectId, ref: "Folio" },
    status: { type: String, enum: Object.values(BanquetStatus), default: BanquetStatus.INQUIRY },
    notes: { type: String },
  },
  { timestamps: true }
);

export const BanquetBooking = (mongoose.models.BanquetBooking as mongoose.Model<IBanquetBooking>) || mongoose.model<IBanquetBooking>("BanquetBooking", BanquetBookingSchema);
