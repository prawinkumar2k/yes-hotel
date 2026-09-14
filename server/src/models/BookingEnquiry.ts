import mongoose, { Document, Schema } from "mongoose";

export enum BookingEnquiryStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  CLOSED = "CLOSED",
}

export interface IBookingEnquiry extends Document {
  guestName: string;
  email?: string;
  phone: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  childAges: number[];
  rooms: number;
  roomType: string;
  roomCategoryId?: string;
  pricePerNight?: number;
  roomSubtotal?: number;
  status: BookingEnquiryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BookingEnquirySchema = new Schema<IBookingEnquiry>(
  {
    guestName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, required: true, min: 0 },
    childAges: { type: [Number], default: [] },
    rooms: { type: Number, required: true, min: 1 },
    roomType: { type: String, required: true, trim: true, maxlength: 120 },
    roomCategoryId: { type: String, trim: true },
    pricePerNight: { type: Number, min: 0 },
    roomSubtotal: { type: Number, min: 0 },
    status: { type: String, enum: Object.values(BookingEnquiryStatus), default: BookingEnquiryStatus.NEW },
  },
  { timestamps: true },
);

export const BookingEnquiry = (mongoose.models.BookingEnquiry as mongoose.Model<IBookingEnquiry>) || mongoose.model<IBookingEnquiry>("BookingEnquiry", BookingEnquirySchema);