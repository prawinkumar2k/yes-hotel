import mongoose, { Document, Schema } from "mongoose";

/**
 * A guest's request to change a booking (dates or guests). The request goes to Reception,
 * who checks rate and availability, applies the change with the normal booking tools and
 * records the decision. The booking itself is never changed by the guest directly.
 */
export enum ChangeRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  WITHDRAWN = "WITHDRAWN",
}

export interface IBookingChangeRequest extends Document {
  propertyId?: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  current: { checkInDate: Date; checkOutDate: Date; adults: number; children: number };
  requested: { checkInDate?: Date; checkOutDate?: Date; adults?: number; children?: number };
  note?: string;
  status: ChangeRequestStatus;
  handledBy?: mongoose.Types.ObjectId;
  handledAt?: Date;
  responseNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StaySchema = { checkInDate: Date, checkOutDate: Date, adults: Number, children: Number };

const BookingChangeRequestSchema = new Schema<IBookingChangeRequest>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    current: { type: new Schema(StaySchema, { _id: false }), required: true },
    requested: { type: new Schema(StaySchema, { _id: false }), required: true },
    note: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: Object.values(ChangeRequestStatus), default: ChangeRequestStatus.PENDING },
    handledBy: { type: Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },
    responseNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// One open request per booking.
BookingChangeRequestSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { status: ChangeRequestStatus.PENDING }, name: "one_pending_change_per_booking" },
);
BookingChangeRequestSchema.index({ customer: 1, createdAt: -1 });
BookingChangeRequestSchema.index({ status: 1, createdAt: -1 });

export const BookingChangeRequest =
  (mongoose.models.BookingChangeRequest as mongoose.Model<IBookingChangeRequest>) ||
  mongoose.model<IBookingChangeRequest>("BookingChangeRequest", BookingChangeRequestSchema);
