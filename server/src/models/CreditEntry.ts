import mongoose, { Schema, Document } from "mongoose";

/** Money a guest owes the hotel and will pay later: left on credit at registration or at the billing desk. */
export interface ICreditEntry extends Document {
  propertyId: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  folio?: mongoose.Types.ObjectId;
  guestName: string;
  phone?: string;
  roomNumber?: string;
  amount: number;
  collectedTotal: number;
  status: "OPEN" | "SETTLED";
  note?: string;
  createdBy?: mongoose.Types.ObjectId;
  collections: { amount: number; method: string; reference?: string; at: Date; by?: mongoose.Types.ObjectId; payment?: mongoose.Types.ObjectId }[];
  createdAt: Date;
  updatedAt: Date;
}

const CreditEntrySchema = new Schema<ICreditEntry>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    folio: { type: Schema.Types.ObjectId, ref: "Folio" },
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    roomNumber: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    collectedTotal: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["OPEN", "SETTLED"], default: "OPEN" },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    collections: [
      {
        amount: { type: Number, required: true },
        method: { type: String, required: true },
        reference: { type: String },
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: "User" },
        payment: { type: Schema.Types.ObjectId, ref: "Payment" },
      },
    ],
  },
  { timestamps: true },
);
CreditEntrySchema.index({ propertyId: 1, status: 1, createdAt: -1 });
CreditEntrySchema.index({ booking: 1 });

export const CreditEntry = (mongoose.models.CreditEntry as mongoose.Model<ICreditEntry>) || mongoose.model<ICreditEntry>("CreditEntry", CreditEntrySchema);
