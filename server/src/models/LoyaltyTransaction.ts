import mongoose, { Document, Schema } from "mongoose";

export interface ILoyaltyTransaction extends Document {
  guestId: mongoose.Types.ObjectId;
  folioId?: mongoose.Types.ObjectId;
  points: number;
  type: "EARN" | "REDEEM" | "ADJUSTMENT";
  description: string;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    folioId: { type: Schema.Types.ObjectId, ref: "Folio" },
    points: { type: Number, required: true },
    type: { type: String, enum: ["EARN", "REDEEM", "ADJUSTMENT"], required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

export const LoyaltyTransaction = mongoose.model<ILoyaltyTransaction>(
  "LoyaltyTransaction",
  LoyaltyTransactionSchema
);
