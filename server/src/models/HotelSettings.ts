import mongoose, { Document, Schema } from "mongoose";

export interface IHotelSettings extends Document {
  // General
  hotelName: string;
  logoUrl?: string;
  tagline?: string;
  description?: string;
  
  // Contact
  phone: string;
  email: string;
  address: string;
  googleMapsUrl?: string;
  whatsappNumber?: string;
  
  // Booking
  checkInTime: string; // e.g. "14:00"
  checkOutTime: string; // e.g. "11:00"
  currency: string; // e.g. "INR"
  gstPercentage: number; // e.g. 18
  cancellationPolicy: string;
  
  // Social
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  
  updatedBy: mongoose.Types.ObjectId;
}

const HotelSettingsSchema = new Schema<IHotelSettings>(
  {
    hotelName: { type: String, required: true, default: "YES Hotels" },
    logoUrl: { type: String },
    tagline: { type: String },
    description: { type: String },
    
    phone: { type: String, required: true, default: "+1 234 567 890" },
    email: { type: String, required: true, default: "contact@yeshotels.com" },
    address: { type: String, required: true, default: "123 Hotel Avenue, City" },
    googleMapsUrl: { type: String },
    whatsappNumber: { type: String },
    
    checkInTime: { type: String, required: true, default: "14:00" },
    checkOutTime: { type: String, required: true, default: "11:00" },
    currency: { type: String, required: true, default: "INR" },
    gstPercentage: { type: Number, required: true, default: 18 },
    cancellationPolicy: { type: String, required: true, default: "Free cancellation up to 48 hours before check-in." },
    
    instagramUrl: { type: String },
    facebookUrl: { type: String },
    youtubeUrl: { type: String },
    
    metaTitle: { type: String },
    metaDescription: { type: String },
    ogImageUrl: { type: String },
    
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const HotelSettings = mongoose.model<IHotelSettings>("HotelSettings", HotelSettingsSchema);
