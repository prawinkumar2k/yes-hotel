import mongoose, { Document, Schema } from "mongoose";

export enum SeoPageType {
  LOCALITY = "LOCALITY",
  HOSPITAL = "HOSPITAL",
  IT_PARK = "IT_PARK",
  TRANSIT = "TRANSIT",
  COLLEGE = "COLLEGE",
  ATTRACTION = "ATTRACTION",
  INDUSTRIAL = "INDUSTRIAL",
}

export enum SeoVerificationStatus {
  VERIFIED = "VERIFIED",
  PENDING = "PENDING",
  REJECTED = "REJECTED",
}

export interface ISeoLandingPage extends Document {
  slug: string;
  targetLocality: string;
  destinationName: string;
  pageType: SeoPageType;
  distanceKm: number;
  distanceRouteDetails: string;
  travelTimeMinutes: {
    car: number;
    metro?: number;
    walking?: number;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  metaTitle: string;
  metaDescription: string;
  h1: string;
  h2Subheading: string;
  targetKeywords: string[];
  overviewContent: string;
  stayHighlights: string[];
  nearbyAttractions: {
    name: string;
    distanceKm: number;
    category: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
  verificationStatus: SeoVerificationStatus;
  verificationSource: string;
  verificationDate: Date;
  isPublished: boolean;
  canonicalUrl: string;
  schemaType: string;
  analytics: {
    views: number;
    bookingStarts: number;
    completedBookings: number;
    revenueAttributed: number;
  };
  auditScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeoLandingPageSchema = new Schema<ISeoLandingPage>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    targetLocality: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    destinationName: {
      type: String,
      required: true,
      trim: true,
    },
    pageType: {
      type: String,
      enum: Object.values(SeoPageType),
      default: SeoPageType.LOCALITY,
      index: true,
    },
    distanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    distanceRouteDetails: {
      type: String,
      required: true,
    },
    travelTimeMinutes: {
      car: { type: Number, required: true },
      metro: { type: Number },
      walking: { type: Number },
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    metaTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 70,
    },
    metaDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 175,
    },
    h1: {
      type: String,
      required: true,
      trim: true,
    },
    h2Subheading: {
      type: String,
      required: true,
      trim: true,
    },
    targetKeywords: [{ type: String, trim: true }],
    overviewContent: {
      type: String,
      required: true,
    },
    stayHighlights: [{ type: String }],
    nearbyAttractions: [
      {
        name: { type: String, required: true },
        distanceKm: { type: Number, required: true },
        category: { type: String, required: true },
      },
    ],
    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],
    verificationStatus: {
      type: String,
      enum: Object.values(SeoVerificationStatus),
      default: SeoVerificationStatus.VERIFIED,
      index: true,
    },
    verificationSource: {
      type: String,
      required: true,
      default: "YES HOTELS Operations & Bengaluru Metro Rail / Google Maps Ground Truth",
    },
    verificationDate: {
      type: Date,
      default: Date.now,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    canonicalUrl: {
      type: String,
      required: true,
    },
    schemaType: {
      type: String,
      default: "Hotel",
    },
    analytics: {
      views: { type: Number, default: 0 },
      bookingStarts: { type: Number, default: 0 },
      completedBookings: { type: Number, default: 0 },
      revenueAttributed: { type: Number, default: 0 },
    },
    auditScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound index for fast sitemap & crawler queries
SeoLandingPageSchema.index({ isPublished: 1, verificationStatus: 1 });

export const SeoLandingPage =
  (mongoose.models.SeoLandingPage as mongoose.Model<ISeoLandingPage>) ||
  mongoose.model<ISeoLandingPage>("SeoLandingPage", SeoLandingPageSchema);
