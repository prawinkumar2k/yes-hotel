import mongoose, { Document, Schema } from "mongoose";

export interface IWebsiteContent extends Document {
  key: string;
  title?: string;
  subtitle?: string;
  description?: string;
  images: string[];
  metadata?: any;
  isPublished: boolean;
}

const WebsiteContentSchema = new Schema<IWebsiteContent>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String },
    subtitle: { type: String },
    description: { type: String },
    images: [{ type: String }],
    metadata: { type: Schema.Types.Mixed },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const WebsiteContent = mongoose.model<IWebsiteContent>("WebsiteContent", WebsiteContentSchema);
