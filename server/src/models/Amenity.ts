import mongoose, { Document, Schema } from "mongoose";

export interface IAmenity extends Document {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  displayOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const AmenitySchema = new Schema<IAmenity>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    icon: { type: String }, // Can be a lucide-react icon name or an image URL
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Amenity = (mongoose.models.Amenity as mongoose.Model<IAmenity>) || mongoose.model<IAmenity>("Amenity", AmenitySchema);
