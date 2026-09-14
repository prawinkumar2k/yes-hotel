import mongoose, { Document, Schema } from "mongoose";

export enum BookingStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
}

/**
 * Where this booking originated. Never trust the client to set this — the
 * booking source is set by the server based on context (API key, user role,
 * admin vs customer portal).
 */
export enum BookingSource {
  DIRECT_WEBSITE = "DIRECT_WEBSITE",
  WALK_IN = "WALK_IN",
  PHONE = "PHONE",
  OTA = "OTA",              // Booking.com, Expedia, MakeMyTrip etc.
  CORPORATE = "CORPORATE",
  GROUP = "GROUP",
  TRAVEL_AGENT = "TRAVEL_AGENT",
  GOVERNMENT = "GOVERNMENT",
  STAFF = "STAFF",
  COMPLIMENTARY = "COMPLIMENTARY",
  HOUSE_USE = "HOUSE_USE",
  ADMIN = "ADMIN",          // created directly from the admin panel
}

export enum BookingType {
  INDIVIDUAL = "INDIVIDUAL",
  GROUP = "GROUP",
  CORPORATE = "CORPORATE",
  WALK_IN = "WALK_IN",
  TENTATIVE = "TENTATIVE",
  WAITLIST = "WAITLIST",
  HOUSE_USE = "HOUSE_USE",
  COMPLIMENTARY = "COMPLIMENTARY",
}

export interface IBooking extends Document {
  bookingReference: string;
  customer?: mongoose.Types.ObjectId; // Optional for guest checkout
  guestDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    // KYC — stored encrypted in production; here as-is for structural completeness
    idType?: string;         // e.g. "AADHAAR", "PASSPORT", "DRIVING_LICENSE"
    idNumber?: string;
    nationality?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    dateOfBirth?: Date;
    gender?: string;
  };
  roomCategory: mongoose.Types.ObjectId;
  assignedRoom?: mongoose.Types.ObjectId;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  status: BookingStatus;
  totalAmount: number;
  taxAmount: number;
  cgstAmount: number;       // CGST component of taxAmount
  sgstAmount: number;       // SGST component of taxAmount
  paidAmount: number;
  paymentStatus: PaymentStatus;
  specialRequests?: string;
  appliedCoupon?: string;
  discountAmount: number;
  couponRedeemed: boolean;

  // ── NEW FIELDS ──
  source: BookingSource;
  bookingType: BookingType;
  ratePlan?: string;          // rate plan name: "BAR", "CORPORATE", "SEASONAL" etc.
  rateOverrideAmount?: number; // if rate was manually overridden
  rateOverrideReason?: string;
  rateOverrideApprovedBy?: mongoose.Types.ObjectId;

  folio?: mongoose.Types.ObjectId;  // created on check-in

  // Corporate / Group
  company?: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  travelAgent?: string;
  otaName?: string;          // if source=OTA, which OTA
  otaConfirmationNumber?: string;

  // Operational flags
  isVipGuest: boolean;
  vipNotes?: string;
  internalNotes?: string;    // staff-only notes
  guestNotes?: string;       // notes visible to guest

  // No-show / Cancellation
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  cancellationPenalty?: number;
  noShowAt?: Date;
  noShowProcessedBy?: mongoose.Types.ObjectId;

  // Check-in
  checkedInAt?: Date;
  checkedInBy?: mongoose.Types.ObjectId;

  // Check-out
  checkedOutAt?: Date;
  checkedOutBy?: mongoose.Types.ObjectId;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingReference: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    guestDetails: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      idType: { type: String },
      idNumber: { type: String },
      nationality: { type: String },
      address: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      dateOfBirth: { type: Date },
      gender: { type: String },
    },
    roomCategory: { type: Schema.Types.ObjectId, ref: "RoomCategory", required: true },
    assignedRoom: { type: Schema.Types.ObjectId, ref: "Room" },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    adults: { type: Number, required: true, default: 1 },
    children: { type: Number, required: true, default: 0 },
    status: { type: String, enum: Object.values(BookingStatus), default: BookingStatus.PENDING },
    totalAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.UNPAID },
    specialRequests: { type: String },
    appliedCoupon: { type: String },
    discountAmount: { type: Number, default: 0 },
    couponRedeemed: { type: Boolean, default: false },

    // ── NEW ──
    source: {
      type: String,
      enum: Object.values(BookingSource),
      default: BookingSource.DIRECT_WEBSITE,
    },
    bookingType: {
      type: String,
      enum: Object.values(BookingType),
      default: BookingType.INDIVIDUAL,
    },
    ratePlan: { type: String },
    rateOverrideAmount: { type: Number },
    rateOverrideReason: { type: String },
    rateOverrideApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },

    folio: { type: Schema.Types.ObjectId, ref: "Folio" },

    company: { type: Schema.Types.ObjectId, ref: "Company" },
    groupId: { type: Schema.Types.ObjectId },
    travelAgent: { type: String },
    otaName: { type: String },
    otaConfirmationNumber: { type: String },

    isVipGuest: { type: Boolean, default: false },
    vipNotes: { type: String },
    internalNotes: { type: String },
    guestNotes: { type: String },

    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String },
    cancellationPenalty: { type: Number, default: 0 },
    noShowAt: { type: Date },
    noShowProcessedBy: { type: Schema.Types.ObjectId, ref: "User" },

    checkedInAt: { type: Date },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User" },
    checkedOutAt: { type: Date },
    checkedOutBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ── EXISTING INDEXES (preserved) ──
// Supports checkAvailability
BookingSchema.index({ status: 1, checkInDate: 1, checkOutDate: 1 });
// Customer dashboard
BookingSchema.index({ customer: 1, createdAt: -1 });
// Admin/reporting by category
BookingSchema.index({ roomCategory: 1 });

// ── NEW INDEXES ──
// Front desk: today's arrivals/departures
BookingSchema.index({ checkInDate: 1, status: 1 });
BookingSchema.index({ checkOutDate: 1, status: 1 });
// Assigned room lookup
BookingSchema.index({ assignedRoom: 1, status: 1 }, { sparse: true });
// Source reporting
BookingSchema.index({ source: 1, createdAt: -1 });
// VIP alerts
BookingSchema.index({ isVipGuest: 1, checkInDate: 1 }, { sparse: true });

export const Booking = mongoose.model<IBooking>("Booking", BookingSchema);
