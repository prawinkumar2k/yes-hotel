import mongoose, { Document, Schema } from "mongoose";

export enum BookingEnquiryStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  FOLLOW_UP = "FOLLOW_UP",
  QUOTATION_SENT = "QUOTATION_SENT",
  AWAITING_RESPONSE = "AWAITING_RESPONSE",
  CONVERTED = "CONVERTED",
  LOST = "LOST",
  CANCELLED = "CANCELLED",
}

export enum EnquirySource {
  WEBSITE = "WEBSITE",
  PHONE = "PHONE",
  EMAIL = "EMAIL",
  WALK_IN = "WALK_IN",
  REFERRAL = "REFERRAL",
  OTA = "OTA",
  CORPORATE = "CORPORATE",
  CHATBOT = "CHATBOT",
  OTHER = "OTHER",
}

export enum EnquiryType {
  INDIVIDUAL = "INDIVIDUAL",
  CORPORATE = "CORPORATE",
  GROUP = "GROUP",
  BANQUET = "BANQUET",
  EVENT = "EVENT",
}

export enum EnquiryPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export interface IFollowUp {
  date: Date;
  method: string;
  notes: string;
  conductedBy?: mongoose.Types.ObjectId;
  nextFollowUpDate?: Date;
  createdAt: Date;
}

export interface IBookingEnquiry extends Document {
  enquiryNumber: string;
  
  // Customer info
  guestName: string;
  email?: string;
  phone: string;
  company?: string;
  preferredContactMethod?: string;
  
  // Stay requirements
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  childAges: number[];
  rooms: number;
  roomType: string;
  roomCategoryId?: mongoose.Types.ObjectId;
  mealPlan?: string;
  expectedBudget?: number;
  
  // Pricing (from chatbot or estimated)
  pricePerNight?: number;
  roomSubtotal?: number;
  
  // Booking progress & funnel stage
  bookingStage?: string;
  /** Every stage the guest reached on the website / chatbot, oldest first. */
  stageHistory: { stage: string; at: Date; reason?: string }[];
  /** Last time the guest did something on the website / chatbot for this enquiry. */
  lastActivityAt?: Date;
  
  // Event/group fields
  enquiryType: EnquiryType;
  eventName?: string;
  eventDate?: Date;
  venueRequirements?: string;
  expectedAttendance?: number;
  cateringRequired?: boolean;
  specialRequirements?: string;
  
  // Tracking
  source: EnquirySource;
  assignedTo?: mongoose.Types.ObjectId;
  status: BookingEnquiryStatus;
  priority: EnquiryPriority;
  lostReason?: string;
  notes?: string;
  
  // Follow-up history
  followUps: IFollowUp[];
  nextFollowUpDate?: Date;
  
  // Quotation
  quotationAmount?: number;
  quotationSentAt?: Date;
  quotationValidUntil?: Date;
  quotationNotes?: string;
  
  // Conversion
  convertedToBookingId?: mongoose.Types.ObjectId;
  convertedAt?: Date;
  convertedBy?: mongoose.Types.ObjectId;
  
  // Metadata
  propertyId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>({
  date: { type: Date, required: true },
  method: { type: String, required: true },
  notes: { type: String, required: true },
  conductedBy: { type: Schema.Types.ObjectId, ref: "User" },
  nextFollowUpDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const BookingEnquirySchema = new Schema<IBookingEnquiry>(
  {
    enquiryNumber: { type: String, unique: true, sparse: true },
    
    // Customer
    guestName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    company: { type: String, trim: true, maxlength: 120 },
    preferredContactMethod: { type: String, enum: ["PHONE", "EMAIL", "WHATSAPP", "ANY"], default: "ANY" },
    
    // Stay
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, required: true, min: 0, default: 0 },
    childAges: { type: [Number], default: [] },
    rooms: { type: Number, required: true, min: 1 },
    roomType: { type: String, required: true, trim: true, maxlength: 120 },
    roomCategoryId: { type: Schema.Types.ObjectId, ref: "RoomCategory" },
    mealPlan: { type: String },
    expectedBudget: { type: Number, min: 0 },
    pricePerNight: { type: Number, min: 0 },
    roomSubtotal: { type: Number, min: 0 },
    
    // Funnel & booking stage
    bookingStage: {
      type: String,
      default: "CHATBOT_STARTED",
      trim: true,
    },
    stageHistory: {
      type: [{ _id: false, stage: { type: String, required: true }, at: { type: Date, required: true }, reason: { type: String, maxlength: 300 } }],
      default: [],
    },
    lastActivityAt: { type: Date },
    
    // Event/Group
    enquiryType: { type: String, enum: Object.values(EnquiryType), default: EnquiryType.INDIVIDUAL },
    eventName: { type: String, trim: true },
    eventDate: { type: Date },
    venueRequirements: { type: String },
    expectedAttendance: { type: Number, min: 0 },
    cateringRequired: { type: Boolean, default: false },
    specialRequirements: { type: String },
    
    // Tracking
    source: { type: String, enum: Object.values(EnquirySource), default: EnquirySource.CHATBOT },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: Object.values(BookingEnquiryStatus), default: BookingEnquiryStatus.NEW },
    priority: { type: String, enum: Object.values(EnquiryPriority), default: EnquiryPriority.MEDIUM },
    lostReason: { type: String },
    notes: { type: String },
    
    // Follow-ups
    followUps: { type: [FollowUpSchema], default: [] },
    nextFollowUpDate: { type: Date },
    
    // Quotation
    quotationAmount: { type: Number, min: 0 },
    quotationSentAt: { type: Date },
    quotationValidUntil: { type: Date },
    quotationNotes: { type: String },
    
    // Conversion
    convertedToBookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    convertedAt: { type: Date },
    convertedBy: { type: Schema.Types.ObjectId, ref: "User" },
    
    // Property
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
  },
  { timestamps: true },
);

// Indexes
BookingEnquirySchema.index({ status: 1, createdAt: -1 });
BookingEnquirySchema.index({ guestName: "text", email: "text", phone: "text" });
BookingEnquirySchema.index({ nextFollowUpDate: 1, status: 1 });
BookingEnquirySchema.index({ checkIn: 1, checkOut: 1 });

export const BookingEnquiry = (mongoose.models.BookingEnquiry as mongoose.Model<IBookingEnquiry>) || mongoose.model<IBookingEnquiry>("BookingEnquiry", BookingEnquirySchema);