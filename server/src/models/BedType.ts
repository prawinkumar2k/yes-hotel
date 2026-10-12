import mongoose, { Document, Schema } from "mongoose";

export interface IBedType extends Document {
  name: string;
  code: string;
  description?: string;
  capacity: number; // e.g., 1 for single, 2 for double/king
  isActive: boolean;
  displayOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const BedTypeSchema = new Schema<IBedType>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    capacity: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const BedType = (mongoose.models.BedType as mongoose.Model<IBedType>) || mongoose.model<IBedType>("BedType", BedTypeSchema);
