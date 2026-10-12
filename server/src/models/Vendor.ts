import mongoose, { Document, Schema } from "mongoose";

export interface IVendor extends Document {
  vendorCode: string;
  name: string;
  gstin?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  paymentTerms: string;
  rating: number;
  isActive: boolean;
  notes?: string;
}

const VendorSchema = new Schema<IVendor>(
  {
    vendorCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    gstin: { type: String },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    paymentTerms: { type: String, default: "Net 30" },
    rating: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Vendor = (mongoose.models.Vendor as mongoose.Model<IVendor>) || mongoose.model<IVendor>("Vendor", VendorSchema);
