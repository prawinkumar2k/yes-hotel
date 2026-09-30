import mongoose, { Document, Schema } from "mongoose";

export interface IRole extends Document {
  name: string;
  key: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Role = (mongoose.models.Role as mongoose.Model<IRole>) || mongoose.model<IRole>("Role", RoleSchema);
