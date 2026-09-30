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

  // Booking Policies
  checkInTime: string;   // e.g. "14:00"
  checkOutTime: string;  // e.g. "11:00"
  earlyCheckInFee?: number;
  lateCheckOutFee?: number;
  maxOccupancyBuffer?: number;  // e.g. 5 = allow 5% overbooking (0 = strict)

  // Occupancy Charges
  extraPersonRate: number; // For extra person without extra bed
  extraBedRate: number;    // For extra person with extra bed
  childRateNoBed: number;  // For extra child (3-12) without extra bed
  childRateWithBed: number; // For extra child (3-12) with extra bed

  // Meal Plan Rates (per person per night)
  mealPlanRates: {
    EP: number; // European Plan (Room Only)
    CP: number; // Continental Plan (Breakfast)
    MAP: number; // Modified American Plan (Half Board)
    AP: number; // American Plan (Full Board)
    RO: number; // Room Only
    BB: number; // Bed & Breakfast
  };

  // Currency
  currency: string;         // e.g. "INR"
  currencySymbol: string;   // e.g. "₹"

  // Tax Configuration
  /** @deprecated Use cgstPercentage + sgstPercentage instead */
  gstPercentage: number;    // kept for backward compat — equals cgstPercentage + sgstPercentage
  cgstPercentage: number;   // CGST rate (default 2.5)
  sgstPercentage: number;   // SGST rate (default 2.5)
  igstPercentage: number;   // IGST rate — applies for interstate guests (default 5)
  taxInclusiveRates: boolean; // if true, room rates are tax-inclusive

  // Invoice settings
  invoicePrefix: string;    // e.g. "INV"
  advancePrefix: string;    // e.g. "ADV"
  receiptPrefix: string;    // e.g. "RCP"
  gstNumber?: string;       // Hotel's GSTIN
  panNumber?: string;
  invoiceFooterText?: string;

  // Cancellation Policy
  cancellationPolicy: string;
  cancellationFreeHours: number; // hours before check-in for free cancellation (default 48)
  cancellationPenaltyPercentage: number; // % of total charged as penalty (default 100)

  // Night Audit
  businessDateEnabled: boolean; // if false, calendar date = business date
  nightAuditTime: string;      // e.g. "02:00" — when auto-audit runs if enabled
  allowBackdatedCorrections: boolean; // if true, managers can correct closed-date transactions

  // Housekeeping
  requireInspectionBeforeRelease: boolean; // if false, CLEAN after cleaning_completed directly
  requireManualReleaseAfterInspection: boolean; // if false, room auto-releases on passed inspection

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

    phone: { type: String, required: true, default: "+91 9876543210" },
    email: { type: String, required: true, default: "contact@yeshotels.com" },
    address: { type: String, required: true, default: "123 Hotel Avenue, City" },
    googleMapsUrl: { type: String },
    whatsappNumber: { type: String },

    checkInTime: { type: String, required: true, default: "14:00" },
    checkOutTime: { type: String, required: true, default: "11:00" },
    earlyCheckInFee: { type: Number, default: 0 },
    lateCheckOutFee: { type: Number, default: 0 },
    maxOccupancyBuffer: { type: Number, default: 0 },

    extraPersonRate: { type: Number, default: 800 },
    extraBedRate: { type: Number, default: 1200 },
    childRateNoBed: { type: Number, default: 400 },
    childRateWithBed: { type: Number, default: 600 },

    mealPlanRates: {
      EP: { type: Number, default: 0 },
      CP: { type: Number, default: 500 },
      MAP: { type: Number, default: 1000 },
      AP: { type: Number, default: 1500 },
      RO: { type: Number, default: 0 },
      BB: { type: Number, default: 500 },
    },

    currency: { type: String, required: true, default: "INR" },
    currencySymbol: { type: String, required: true, default: "₹" },

    // ── TAX ──
    gstPercentage: { type: Number, required: true, default: 5 },  // backward compat
    cgstPercentage: { type: Number, required: true, default: 2.5 },
    sgstPercentage: { type: Number, required: true, default: 2.5 },
    igstPercentage: { type: Number, required: true, default: 5 },
    taxInclusiveRates: { type: Boolean, default: false },

    // ── INVOICE ──
    invoicePrefix: { type: String, default: "INV" },
    advancePrefix: { type: String, default: "ADV" },
    receiptPrefix: { type: String, default: "RCP" },
    gstNumber: { type: String },
    panNumber: { type: String },
    invoiceFooterText: { type: String },

    // ── CANCELLATION ──
    cancellationPolicy: { type: String, required: true, default: "Free cancellation up to 48 hours before check-in." },
    cancellationFreeHours: { type: Number, default: 48 },
    cancellationPenaltyPercentage: { type: Number, default: 100 },

    // ── NIGHT AUDIT ──
    businessDateEnabled: { type: Boolean, default: false },
    nightAuditTime: { type: String, default: "02:00" },
    allowBackdatedCorrections: { type: Boolean, default: false },

    // ── HOUSEKEEPING ──
    requireInspectionBeforeRelease: { type: Boolean, default: true },
    requireManualReleaseAfterInspection: { type: Boolean, default: true },

    // ── SOCIAL ──
    instagramUrl: { type: String },
    facebookUrl: { type: String },
    youtubeUrl: { type: String },

    // ── SEO ──
    metaTitle: { type: String },
    metaDescription: { type: String },
    ogImageUrl: { type: String },

    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const HotelSettings = (mongoose.models.HotelSettings as mongoose.Model<IHotelSettings>) || mongoose.model<IHotelSettings>("HotelSettings", HotelSettingsSchema);
