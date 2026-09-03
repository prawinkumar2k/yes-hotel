import mongoose, { Document, Schema } from "mongoose";

export enum BookingStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
}

export interface IBooking extends Document {
  bookingReference: string;
  customer?: mongoose.Types.ObjectId; // Optional for guest checkout
  guestDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
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
  paidAmount: number;
  paymentStatus: PaymentStatus;
  specialRequests?: string;
  appliedCoupon?: string;
  discountAmount: number;
  couponRedeemed: boolean;
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
    paidAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.UNPAID },
    specialRequests: { type: String },
    appliedCoupon: { type: String },
    discountAmount: { type: Number, default: 0 },
    couponRedeemed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Supports checkAvailability — the highest-traffic query in the app (every
// search-page load), which filters by status and overlapping date range.
BookingSchema.index({ status: 1, checkInDate: 1, checkOutDate: 1 });
// Supports the customer dashboard (getMyBookings/getMyBookingById).
BookingSchema.index({ customer: 1, createdAt: -1 });
// Supports admin/reporting queries filtered or grouped by category.
BookingSchema.index({ roomCategory: 1 });

export const Booking = mongoose.model<IBooking>("Booking", BookingSchema);
