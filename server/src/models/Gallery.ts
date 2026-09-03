import mongoose, { Document, Schema } from "mongoose";

export enum GalleryCategory {
  HOTEL = "HOTEL",
  ROOMS = "ROOMS",
  DINING = "DINING",
  EXTERIOR = "EXTERIOR",
  EXPERIENCE = "EXPERIENCE",
  EVENTS = "EVENTS"
}

export interface IGallery extends Document {
  title: string;
  description?: string;
  imageUrl: string;
  // Only present for images uploaded through the Cloudinary flow — an image
  // seeded or sourced from a stable external URL legitimately has none, and
  // the delete handler already treats a missing value as "skip Cloudinary
  // cleanup" rather than assuming every image has a Cloudinary asset.
  cloudinaryPublicId?: string;
  category: GalleryCategory;
  altText: string;
  featured: boolean;
  published: boolean;
  displayOrder: number;
}

const GallerySchema = new Schema<IGallery>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String },
    category: { type: String, enum: Object.values(GalleryCategory), required: true },
    altText: { type: String, required: true },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Gallery = mongoose.model<IGallery>("Gallery", GallerySchema);
