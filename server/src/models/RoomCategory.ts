import mongoose, { Document, Schema } from "mongoose";

export interface IRoomCategory extends Document {
  slug: string;
  name: string;
  shortDescription?: string;
  description: string;
  basePrice: number;
  hourlyPrice?: number;
  /** Tariff when one adult has the room (0 = same as basePrice). */
  singleOccupancyPrice?: number;
  /** Extra person / bed / child rates for this category (0 = the hotel-wide rate in Settings). */
  extraPersonRate?: number;
  extraBedRate?: number;
  childRateNoBed?: number;
  childRateWithBed?: number;
  /** Day use: flat price by occupancy, up to dayUseMaxHours. dayUseAllowed false = no day use for this category. */
  dayUseAllowed?: boolean;
  dayUseSinglePrice?: number;
  dayUseDoublePrice?: number;
  dayUseMaxHours?: number;
  capacity: {
    adults: number;
    children: number;
  };
  size?: number;
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
    hourlyPrice: { type: Number, default: 0 },
    singleOccupancyPrice: { type: Number, default: 0 },
    extraPersonRate: { type: Number, default: 0 },
    extraBedRate: { type: Number, default: 0 },
    childRateNoBed: { type: Number, default: 0 },
    childRateWithBed: { type: Number, default: 0 },
    dayUseAllowed: { type: Boolean, default: true },
    dayUseSinglePrice: { type: Number, default: 0 },
    dayUseDoublePrice: { type: Number, default: 0 },
    dayUseMaxHours: { type: Number, default: 12 },
    capacity: {
      adults: { type: Number, required: true, default: 2 },
      children: { type: Number, required: true, default: 0 },
    },
    size: { type: Number },
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

export const RoomCategory = (mongoose.models.RoomCategory as mongoose.Model<IRoomCategory>) || mongoose.model<IRoomCategory>("RoomCategory", RoomCategorySchema);
