import mongoose, { Document, Schema } from "mongoose";
import { propertyScoped } from "./plugins/propertyScoped";

export interface IGuest extends Document {
  propertyId: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  notes?: string;
  emergencyPhone?: string;
  organization?: string;
  designation?: string;
  gstin?: string;
  vehicleNumber?: string;
  /** ID proofs and other papers added in the directory (photos / PDFs), kept with the guest. */
  documents?: { _id: mongoose.Types.ObjectId; kind: string; label?: string; image: string; at: Date; by?: mongoose.Types.ObjectId }[];
  totalBookings: number;
  totalSpend: number;
  firstStay?: Date;
  lastStay?: Date;
  isVip: boolean;
  isBlocked: boolean;
  loyaltyPoints: number;
  loyaltyTier: "MEMBER" | "SILVER" | "GOLD" | "PLATINUM";
}

const GuestSchema = new Schema<IGuest>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    alternatePhone: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    nationality: { type: String },
    idType: { type: String },
    idNumber: { type: String },
    notes: { type: String },
    emergencyPhone: { type: String },
    organization: { type: String },
    designation: { type: String },
    gstin: { type: String },
    vehicleNumber: { type: String },
    documents: [
      {
        kind: { type: String, enum: ["ID_FRONT", "ID_BACK", "PHOTO", "OTHER"], default: "OTHER" },
        label: { type: String },
        image: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    totalBookings: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    firstStay: { type: Date },
    lastStay: { type: Date },
    isVip: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    loyaltyPoints: { type: Number, default: 0 },
    loyaltyTier: { type: String, enum: ["MEMBER", "SILVER", "GOLD", "PLATINUM"], default: "MEMBER" },
  },
  { timestamps: true }
);

// Indexes for searching
GuestSchema.index({ fullName: "text", email: "text", phone: "text" });

// Staff views filter on propertyId; see plugins/propertyScoped.ts.
GuestSchema.plugin(propertyScoped);

export const Guest = (mongoose.models.Guest as mongoose.Model<IGuest>) || mongoose.model<IGuest>("Guest", GuestSchema);
