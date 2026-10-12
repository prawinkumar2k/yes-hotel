import mongoose, { Document, Schema } from "mongoose";

export interface IFloor extends Document {
  propertyId: mongoose.Types.ObjectId;
  name: string;
  floorNumber: number;
  code: string;
  building?: string;
  wing?: string;
  description?: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const FloorSchema = new Schema<IFloor>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    name: { type: String, required: true },
    floorNumber: { type: Number, required: true },
    code: { type: String, required: true },
    building: { type: String },
    wing: { type: String },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Prevent duplicate floor codes within the same property
FloorSchema.index({ propertyId: 1, code: 1 }, { unique: true });
// Prevent duplicate floor numbers within the same property/building
FloorSchema.index({ propertyId: 1, building: 1, floorNumber: 1 }, { unique: true });

export const Floor = (mongoose.models.Floor as mongoose.Model<IFloor>) || mongoose.model<IFloor>("Floor", FloorSchema);
