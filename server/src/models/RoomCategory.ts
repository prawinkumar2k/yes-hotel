import mongoose, { Document, Schema } from "mongoose";

export interface IRoomCategory extends Document {
  slug: string;
  name: string;
  shortDescription?: string;
  description: string;
  basePrice: number;
  capacity: {
    adults: number;
    children: number;
  };
  bedType?: string;
  amenities: string[];
  images: string[];
  model3dUrl?: string;
  isActive: boolean;
  displayOrder?: number;
  featured?: boolean;
}

const RoomCategorySchema = new Schema<IRoomCategory>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortDescription: { type: String },
    description: { type: String, required: true },
    basePrice: { type: Number, required: true },
    capacity: {
      adults: { type: Number, required: true, default: 2 },
      children: { type: Number, required: true, default: 0 },
    },
    bedType: { type: String },
    amenities: [{ type: String }],
    images: [{ type: String }],
    model3dUrl: { type: String },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RoomCategory = mongoose.model<IRoomCategory>("RoomCategory", RoomCategorySchema);
