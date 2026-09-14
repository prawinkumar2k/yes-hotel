import mongoose, { Document, Schema } from "mongoose";

export interface ICorporateAccount extends Document {
  companyName: string;
  companyCode: string;
  gstNumber: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  creditLimit: number;
  currentOutstanding: number;
  discountPercentage: number;
  isActive: boolean;
  notes?: string;
}

const CorporateAccountSchema = new Schema<ICorporateAccount>(
  {
    companyName: { type: String, required: true },
    companyCode: { type: String, required: true, unique: true },
    gstNumber: { type: String, required: true },
    contactPerson: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    creditLimit: { type: Number, required: true, default: 100000 },
    currentOutstanding: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 15 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const CorporateAccount = (mongoose.models.CorporateAccount as mongoose.Model<ICorporateAccount>) || mongoose.model<ICorporateAccount>("CorporateAccount", CorporateAccountSchema);
