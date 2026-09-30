import mongoose, { Document, Schema } from "mongoose";

export interface IPageResource extends Document {
  key: string;
  name: string;
  module: string;
  description?: string;
  route?: string;
  icon?: string;
  parentKey?: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  sensitive: boolean;
  propertyScoped: boolean;
  actions: string[]; // e.g. VIEW, CREATE, EDIT, DELETE, EXPORT
}

const PageResourceSchema = new Schema<IPageResource>(
  {
    key: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    module: { type: String, required: true },
    description: { type: String },
    route: { type: String },
    icon: { type: String },
    parentKey: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    sensitive: { type: Boolean, default: false },
    propertyScoped: { type: Boolean, default: true },
    actions: [{ type: String, uppercase: true }],
  },
  { timestamps: true }
);

export const PageResource = (mongoose.models.PageResource as mongoose.Model<IPageResource>) || mongoose.model<IPageResource>("PageResource", PageResourceSchema);
