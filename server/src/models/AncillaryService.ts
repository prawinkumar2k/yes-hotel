import mongoose, { Schema, Document } from "mongoose";

export enum ServiceCategory {
  SPA = "SPA",
  TRANSPORT = "TRANSPORT",
  LAUNDRY = "LAUNDRY",
  MINIBAR = "MINIBAR",
  OTHER = "OTHER",
}

export interface IAncillaryService extends Document {
  serviceNumber: string;
  category: ServiceCategory;
  serviceName: string;
  roomNumber?: string;
  guestName: string;
  bookingId?: mongoose.Types.ObjectId;
  folioId?: mongoose.Types.ObjectId;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  isChargedToFolio: boolean;
  performedBy?: string; // therapist or driver name
  notes?: string;
  createdAt: Date;
}

const AncillaryServiceSchema: Schema = new Schema(
  {
    serviceNumber: { type: String, required: true, unique: true, uppercase: true },
    category: { type: String, enum: Object.values(ServiceCategory), required: true },
    serviceName: { type: String, required: true, trim: true },
    roomNumber: { type: String, trim: true },
    guestName: { type: String, required: true, trim: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    folioId: { type: Schema.Types.ObjectId, ref: "Folio" },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    isChargedToFolio: { type: Boolean, default: false },
    performedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

export const AncillaryService = (mongoose.models.AncillaryService as mongoose.Model<IAncillaryService>) || mongoose.model<IAncillaryService>("AncillaryService", AncillaryServiceSchema);
