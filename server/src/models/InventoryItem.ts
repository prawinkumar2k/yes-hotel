import mongoose, { Schema, Document } from "mongoose";

export enum ItemCategory {
  FOOD_INGREDIENT = "FOOD_INGREDIENT",
  BEVERAGE = "BEVERAGE",
  LINEN = "LINEN",
  CLEANING_SUPPLY = "CLEANING_SUPPLY",
  GUEST_AMENITY = "GUEST_AMENITY",
  MAINTENANCE_PARTS = "MAINTENANCE_PARTS",
  MISCELLANEOUS = "MISCELLANEOUS",
}

export interface IInventoryItem extends Document {
  itemCode: string;
  name: string;
  category: ItemCategory;
  unit: string; // e.g. "kg", "litres", "pieces", "packs"
  minStockLevel: number;
  currentStock: number;
  reorderQuantity: number;
  unitCost: number;
  storeLocation: string; // e.g. "Main Store", "Kitchen", "Housekeeping"
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema: Schema = new Schema(
  {
    itemCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: Object.values(ItemCategory), default: ItemCategory.FOOD_INGREDIENT },
    unit: { type: String, required: true, default: "pcs" },
    minStockLevel: { type: Number, required: true, default: 10 },
    currentStock: { type: Number, required: true, default: 0 },
    reorderQuantity: { type: Number, required: true, default: 50 },
    unitCost: { type: Number, required: true, default: 0 },
    storeLocation: { type: String, default: "Main Store" },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const InventoryItem = mongoose.model<IInventoryItem>("InventoryItem", InventoryItemSchema);
