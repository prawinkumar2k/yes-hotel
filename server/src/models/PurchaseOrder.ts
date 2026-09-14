import mongoose, { Schema, Document } from "mongoose";

export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface IPurchaseOrderItem {
  item: mongoose.Types.ObjectId;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity: number;
}

export interface IPurchaseOrder extends Document {
  poNumber: string;
  vendor: mongoose.Types.ObjectId;
  vendorName: string;
  items: IPurchaseOrderItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  issuedDate: Date;
  expectedDeliveryDate?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  receivedQuantity: { type: Number, default: 0, min: 0 },
});

const PurchaseOrderSchema: Schema = new Schema(
  {
    poNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    vendorName: { type: String, required: true },
    items: [PurchaseOrderItemSchema],
    totalAmount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: Object.values(PurchaseOrderStatus), default: PurchaseOrderStatus.DRAFT },
    issuedDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const PurchaseOrder = (mongoose.models.PurchaseOrder as mongoose.Model<IPurchaseOrder>) || mongoose.model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);
