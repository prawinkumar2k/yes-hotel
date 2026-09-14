import mongoose, { Document, Schema } from "mongoose";

/**
 * MenuItem — the authoritative restaurant/POS catalog. POS order creation
 * must always re-price and re-validate against this collection server-side;
 * it must never trust a client-sent name/price for a menu item (the same
 * "never trust client-sent tax" principle already applied to GST elsewhere
 * in this codebase — see folio.service.ts calculateTaxBreakdown).
 */
export enum MenuItemCategory {
  BEVERAGE = "BEVERAGE",
  STARTER = "STARTER",
  MAIN_COURSE = "MAIN_COURSE",
  BREAD = "BREAD",
  RICE_BIRYANI = "RICE_BIRYANI",
  DESSERT = "DESSERT",
  SNACK = "SNACK",
  OTHER = "OTHER",
}

export enum FoodType {
  VEG = "VEG",
  NON_VEG = "NON_VEG",
  EGG = "EGG",
  VEGAN = "VEGAN",
}

export interface IMenuItemModifier {
  name: string;
  priceDelta: number;
}

export interface IMenuItem extends Document {
  name: string;
  sku: string;
  category: MenuItemCategory;
  description?: string;
  price: number;
  taxRatePercent: number; // e.g. 5 for 5% restaurant GST — stored per-item so rates can differ by category later
  foodType: FoodType;
  isAvailable: boolean; // 86'd today (kitchen out of stock) without disabling the item entirely
  isActive: boolean; // soft-delete — disabled items are hidden from POS but historical orders keep their snapshot
  kdsStation?: string; // e.g. "GRILL", "BEVERAGE", "TANDOOR" — routes the KOT to the right kitchen display
  modifiers: IMenuItemModifier[];
  imageUrl?: string;
  displayOrder: number;
}

const MenuItemModifierSchema = new Schema<IMenuItemModifier>(
  {
    name: { type: String, required: true },
    priceDelta: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, enum: Object.values(MenuItemCategory), required: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, required: true, default: 5, min: 0, max: 100 },
    foodType: { type: String, enum: Object.values(FoodType), default: FoodType.VEG },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    kdsStation: { type: String },
    modifiers: { type: [MenuItemModifierSchema], default: [] },
    imageUrl: { type: String },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MenuItemSchema.index({ category: 1, displayOrder: 1 });
MenuItemSchema.index({ isActive: 1, isAvailable: 1 });

export const MenuItem = (mongoose.models.MenuItem as mongoose.Model<IMenuItem>) || mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);
