import mongoose, { Document, Schema } from "mongoose";

export enum BookingIdempotencyStatus {
  IN_PROGRESS = "IN_PROGRESS",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  CONFLICT = "CONFLICT",
}

export interface IBookingIdempotency extends Document {
  key: string;
  requestHash: string;
  status: BookingIdempotencyStatus;
  bookingId?: mongoose.Types.ObjectId;
  bookingReference?: string;
  responseData?: Record<string, any>;
  errorMessage?: string;
}

const BookingIdempotencySchema = new Schema<IBookingIdempotency>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    requestHash: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(BookingIdempotencyStatus),
      required: true,
      default: BookingIdempotencyStatus.IN_PROGRESS,
    },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    bookingReference: { type: String },
    responseData: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

BookingIdempotencySchema.index({ status: 1, createdAt: -1 });

export const BookingIdempotency = mongoose.model<IBookingIdempotency>("BookingIdempotency", BookingIdempotencySchema);
