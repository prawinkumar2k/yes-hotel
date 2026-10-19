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
  /**
   * Effective-dated GST rules (services/tax.service.ts). Empty = the built-in defaults
   * (accommodation ≤ ₹7,500/night 5%, above 18% from 22 Sep 2025; food 5%; services 18%).
   */
  gstRules?: Array<{
    category: "ROOM" | "FOOD" | "SERVICE";
    effectiveFrom: string;
    effectiveTo?: string | null;
    bands: Array<{ upTo: number | null; rate: number }>;
  }>;
  /** @deprecated Not used for tax. GST comes from gstRules / taxService. */
  gstPercentage: number;
  /** @deprecated Not used for tax. */
  cgstPercentage: number;
  /** @deprecated Not used for tax. */
  sgstPercentage: number;
  /** @deprecated Not used for tax (hotel supplies are intra-state: CGST + SGST). */
  igstPercentage: number;
  taxInclusiveRates: boolean; // if true, room rates are tax-inclusive
  onlineBookingOpen?: boolean; // website bookings are accepted only when this is true (anything else = on hold)

  // Invoice settings
  invoicePrefix: string;    // e.g. "INV"
  advancePrefix: string;    // e.g. "ADV"
  cashVarianceThreshold?: number; // ₹; a cashier-shift variance above this needs manager acceptance
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

    phone: { type: String, required: true, default: "+91 87698 28787" },
    // Optional: shown on the website only when the hotel saves a real address.
    email: { type: String, default: "" },
    address: { type: String, required: true, default: "2nd Floor, Building No. 51 / A51, Khata No. 749, Hosur Main Road, Hosa Road Junction, Parappana Agrahara, Begur, Electronic City, Bengaluru, Karnataka 560100" },
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

    // ── TAX ── (gstRules drive taxService; the percentage fields are deprecated)
    gstRules: [
      {
        _id: false,
        category: { type: String, enum: ["ROOM", "FOOD", "SERVICE"], required: true },
        effectiveFrom: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
        effectiveTo: { type: String, default: null },
        bands: [{ _id: false, upTo: { type: Number, default: null }, rate: { type: Number, required: true, min: 0, max: 40 } }],
      },
    ],
    gstPercentage: { type: Number, required: true, default: 5 },  // deprecated
    cgstPercentage: { type: Number, required: true, default: 2.5 },
    sgstPercentage: { type: Number, required: true, default: 2.5 },
    igstPercentage: { type: Number, required: true, default: 5 },
    taxInclusiveRates: { type: Boolean, default: false },
    onlineBookingOpen: { type: Boolean, default: false },

    // ── INVOICE ──
    invoicePrefix: { type: String, default: "INV" },
    advancePrefix: { type: String, default: "ADV" },
    cashVarianceThreshold: { type: Number, default: 100, min: 0 },
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
