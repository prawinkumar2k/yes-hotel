import mongoose, { Document, Schema } from "mongoose";

export interface IGuest extends Document {
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
  totalBookings: number;
  totalSpend: number;
  firstStay?: Date;
  lastStay?: Date;
  isVip: boolean;
  isBlocked: boolean;
}

const GuestSchema = new Schema<IGuest>(
  {
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
    totalBookings: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    firstStay: { type: Date },
    lastStay: { type: Date },
    isVip: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for searching
GuestSchema.index({ fullName: "text", email: "text", phone: "text" });

export const Guest = mongoose.model<IGuest>("Guest", GuestSchema);
