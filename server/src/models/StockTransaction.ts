import mongoose, { Schema, Document } from "mongoose";

export enum TransactionType {
  GRN = "GRN", // Goods Receipt Note
  ISSUE = "ISSUE", // Stock issued to department
  TRANSFER = "TRANSFER", // Store to store transfer
  WASTAGE = "WASTAGE", // Spoiled / damaged
  ADJUSTMENT = "ADJUSTMENT", // Audit correction
  RETURN = "RETURN", // Vendor return
}

export interface IStockTransaction extends Document {
  transactionNumber: string;
  type: TransactionType;
  item: mongoose.Types.ObjectId;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  fromStore?: string;
  toStore?: string;
  referenceNumber?: string; // PO Number, KOT Number, Invoice Number
  performedBy: mongoose.Types.ObjectId | string;
  notes?: string;
  createdAt: Date;
}

const StockTransactionSchema: Schema = new Schema(
  {
    transactionNumber: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    item: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, required: true, default: 0 },
    totalValue: { type: Number, required: true, default: 0 },
    fromStore: { type: String },
    toStore: { type: String },
    referenceNumber: { type: String },
    performedBy: { type: Schema.Types.Mixed, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const StockTransaction = (mongoose.models.StockTransaction as mongoose.Model<IStockTransaction>) || mongoose.model<IStockTransaction>("StockTransaction", StockTransactionSchema);
