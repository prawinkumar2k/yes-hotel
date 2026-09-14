import mongoose, { Schema, Document } from "mongoose";

export interface IVendor extends Document {
  vendorCode: string;
  name: string;
  gstin?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  paymentTerms: string; // e.g. "Net 30", "COD", "Advance"
  rating: number; // 1-5 scale
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema: Schema = new Schema(
  {
    vendorCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    contactPerson: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String },
    paymentTerms: { type: String, default: "Net 30" },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Vendor = mongoose.model<IVendor>("Vendor", VendorSchema);
