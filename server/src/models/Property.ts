import mongoose, { Document, Schema } from "mongoose";

export interface IProperty extends Document {
  name: string;
  code: string;             // Short unique code, e.g. "YES-HYD"
  legalName?: string;
  gstin?: string;
  pan?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  starRating?: number;
  totalRooms: number;
  timezone: string;
  currency: string;
  isActive: boolean;
  isHeadOffice: boolean;
}

const PropertySchema = new Schema<IProperty>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    legalName: { type: String },
    gstin: { type: String },
    pan: { type: String },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    website: { type: String },
    starRating: { type: Number, min: 1, max: 5 },
    totalRooms: { type: Number, default: 0 },
    timezone: { type: String, default: "Asia/Kolkata" },
    currency: { type: String, default: "INR" },
    isActive: { type: Boolean, default: true },
    isHeadOffice: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Property = mongoose.model<IProperty>("Property", PropertySchema);
