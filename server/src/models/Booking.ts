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

// ── REGISTRATION CARD ENUMS ──

/**
 * Hotel meal plans as used on the physical Guest Registration Card.
 * Do NOT rename these — the terminology comes directly from the client.
 */
export enum MealPlan {
  EP  = "EP",   // European Plan — room only, no meals
  CP  = "CP",   // Continental Plan — room + breakfast
  MAP = "MAP",  // Modified American Plan — room + breakfast + dinner
  AP  = "AP",   // American Plan — room + all meals
}

/**
 * Identification document types accepted at reception.
 */
export enum IdDocumentType {
  AADHAAR          = "AADHAAR",
  DRIVING_LICENSE  = "DRIVING_LICENSE",
  PASSPORT         = "PASSPORT",
  VOTER_ID         = "VOTER_ID",
  GOVERNMENT_ID    = "GOVERNMENT_ID",
  OTHER            = "OTHER",
}

/**
 * Status of the physical / digital registration card.
 */
export enum RegistrationStatus {
  DRAFT      = "DRAFT",     // being filled
  COMPLETED  = "COMPLETED", // all fields entered
  CONFIRMED  = "CONFIRMED", // guest / receptionist confirmed
  PRINTED    = "PRINTED",   // physical card printed
}

/**
 * Whether the guest has signed the registration card.
 */
export enum SignatureStatus {
  NOT_COLLECTED = "NOT_COLLECTED",
  DIGITAL       = "DIGITAL",
  PHYSICAL      = "PHYSICAL",
  WAIVED        = "WAIVED",
}

export interface IBooking extends Document {
  propertyId: mongoose.Types.ObjectId;
  bookingReference: string;

  /**
   * Human-readable bill number shown on the physical registration card.
   * Format: BILL-YYYY-NNNNNN (e.g. BILL-2026-000267).
   * Generated on walk-in registration; may be null for online bookings
   * that did not go through the front-desk registration flow.
   */
  billNumber?: string;

  customer?: mongoose.Types.ObjectId; // Optional for guest checkout
  guestDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    // KYC — stored encrypted in production; here as-is for structural completeness
    idType?: string;         // e.g. "AADHAAR", "PASSPORT", "DRIVING_LICENSE"
    idNumber?: string;
    idProofImages?: string[]; // Array of document URLs
    nationality?: string;
    emergencyPhone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    dateOfBirth?: Date;
    gender?: string;
    // ── Registration Card Section B extras ──
    organization?: string;
    designation?: string;
    purposeOfVisit?: string;
    age?: number;            // filled by receptionist if DOB not known
    gstin?: string;
    vehicleNumber?: string;
    proceedingTo?: string;
  };

  /**
   * Foreign guest passport + visa data (Section C of registration card).
   * Populated only when guestDetails.nationality indicates a non-Indian guest.
   */
  foreignGuestDetails?: {
    passportNumber?: string;
    passportIssueDate?: Date;
    passportIssuePlace?: string;
    passportExpiryDate?: Date;
    visaNumber?: string;
    visaDate?: Date;
    visaExpiryDate?: Date;
    visaIssuePlace?: string;
    visaIssuedBy?: string;
  };

  // ── STAY INFORMATION (Section D) ──
  arrivalTime?: string;         // e.g. "14:30"
  departureTime?: string;       // e.g. "11:00"
  mealPlan?: MealPlan;          // EP / CP / MAP / AP
  extraPersonsNoBed: number;    // number of extra persons without bed
  extraPersonsWithBed: number;  // number of extra persons with bed
  extraChildrenNoBed: number;   // number of extra children (3-12) without bed
  extraChildrenWithBed: number; // number of extra children (3-12) with bed
  kidsUnder3: number;           // number of kids under 3 (free)
  ratePerNight?: number;        // final agreed rate per night (for registration snapshot)

  // ── BILLING INFORMATION (Section E) ──
  /**
   * How the guest intends to settle the bill.
   * Must come from PaymentChannel records — not hardcoded on the frontend.
   */
  billingInstruction?: string;  // PaymentChannel code (e.g. "CASH", "UPI")

  // ── REGISTRATION STATUS ──
  registrationStatus: RegistrationStatus;
  signatureStatus: SignatureStatus;
  signatureCollectedAt?: Date;
  signatureCollectedBy?: mongoose.Types.ObjectId;

  // ── PROPERTY ──
  property?: mongoose.Types.ObjectId;

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

  // ── BOOKING SOURCE / TYPE ──
  source: BookingSource;
  bookingType: BookingType;
  stayType: "NIGHTLY" | "HOURLY";
  hours?: number;
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
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    bookingReference: { type: String, required: true, unique: true },

    // ── REGISTRATION CARD: Section A ──
    billNumber: { type: String, unique: true, sparse: true },

    customer: { type: Schema.Types.ObjectId, ref: "User" },
    guestDetails: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      idType: { type: String },
      idNumber: { type: String },
      idProofImages: [{ type: String }],
      nationality: { type: String },
      emergencyPhone: { type: String },
      address: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      dateOfBirth: { type: Date },
      gender: { type: String },
      // ── Registration Card Section B extras ──
      organization: { type: String },
      designation: { type: String },
      purposeOfVisit: { type: String },
      age: { type: Number },
      gstin: { type: String },
      vehicleNumber: { type: String },
      proceedingTo: { type: String },
    },

    // ── REGISTRATION CARD: Section C (Foreign Guests) ──
    foreignGuestDetails: {
      passportNumber: { type: String },
      passportIssueDate: { type: Date },
      passportIssuePlace: { type: String },
      passportExpiryDate: { type: Date },
      visaNumber: { type: String },
      visaDate: { type: Date },
      visaExpiryDate: { type: Date },
      visaIssuePlace: { type: String },
      visaIssuedBy: { type: String },
    },

    // ── REGISTRATION CARD: Section D (Stay Information) ──
    arrivalTime: { type: String },
    departureTime: { type: String },
    mealPlan: { type: String, enum: Object.values(MealPlan) },
    extraPersonsNoBed: { type: Number, default: 0 },
    extraPersonsWithBed: { type: Number, default: 0 },
    extraChildrenNoBed: { type: Number, default: 0 },
    extraChildrenWithBed: { type: Number, default: 0 },
    kidsUnder3: { type: Number, default: 0 },
    ratePerNight: { type: Number },

    // ── REGISTRATION CARD: Section E (Billing) ──
    billingInstruction: { type: String },

    // ── REGISTRATION STATUS ──
    registrationStatus: {
      type: String,
      enum: Object.values(RegistrationStatus),
      default: RegistrationStatus.DRAFT,
    },
    signatureStatus: {
      type: String,
      enum: Object.values(SignatureStatus),
      default: SignatureStatus.NOT_COLLECTED,
    },
    signatureCollectedAt: { type: Date },
    signatureCollectedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // ── PROPERTY ──
    property: { type: Schema.Types.ObjectId, ref: "Property" },

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

    // ── BOOKING SOURCE / TYPE ──
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
    stayType: { type: String, enum: ["NIGHTLY", "HOURLY"], default: "NIGHTLY" },
    hours: { type: Number },
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
BookingSchema.index({ status: 1, checkInDate: 1, checkOutDate: 1 });
BookingSchema.index({ customer: 1, createdAt: -1 });
BookingSchema.index({ roomCategory: 1 });

// ── INDEXES ──
BookingSchema.index({ checkInDate: 1, status: 1 });
BookingSchema.index({ checkOutDate: 1, status: 1 });
BookingSchema.index({ assignedRoom: 1, status: 1 }, { sparse: true });
BookingSchema.index({ source: 1, createdAt: -1 });
BookingSchema.index({ isVipGuest: 1, checkInDate: 1 }, { sparse: true });
// Bill number lookup (registration card search)
BookingSchema.index({ billNumber: 1 }, { sparse: true });
// Guest search by phone number
BookingSchema.index({ "guestDetails.phone": 1 });
// Property-level queries
BookingSchema.index({ property: 1, checkInDate: 1 }, { sparse: true });
// Registration status reporting
BookingSchema.index({ registrationStatus: 1, checkInDate: -1 }, { sparse: true });

export const Booking = (mongoose.models.Booking as mongoose.Model<IBooking>) || mongoose.model<IBooking>("Booking", BookingSchema);
