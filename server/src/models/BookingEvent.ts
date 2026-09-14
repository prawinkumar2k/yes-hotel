import mongoose, { Document, Schema } from "mongoose";

/**
 * BookingEvent — an immutable audit/history event attached to a Booking.
 *
 * Every meaningful change to a reservation creates one of these records.
 * This is separate from the general AuditLog (which covers all system actions)
 * and gives the front desk a concise, booking-scoped timeline without needing
 * to filter a large audit table.
 *
 * Records are write-once (no updatedAt).
 */
export enum BookingEventType {
  CREATED = "CREATED",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
  ROOM_ASSIGNED = "ROOM_ASSIGNED",
  ROOM_CHANGED = "ROOM_CHANGED",
  ROOM_UPGRADED = "ROOM_UPGRADED",
  ROOM_DOWNGRADED = "ROOM_DOWNGRADED",
  DATES_EXTENDED = "DATES_EXTENDED",
  DATES_CHANGED = "DATES_CHANGED",
  GUEST_CHANGED = "GUEST_CHANGED",
  RATE_CHANGED = "RATE_CHANGED",
  RATE_PLAN_CHANGED = "RATE_PLAN_CHANGED",
  DISCOUNT_APPLIED = "DISCOUNT_APPLIED",
  DISCOUNT_REMOVED = "DISCOUNT_REMOVED",
  SPECIAL_REQUEST_ADDED = "SPECIAL_REQUEST_ADDED",
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
  ADVANCE_RECEIVED = "ADVANCE_RECEIVED",
  ADVANCE_ADJUSTED = "ADVANCE_ADJUSTED",
  FOLIO_CHARGE_POSTED = "FOLIO_CHARGE_POSTED",
  FOLIO_CLOSED = "FOLIO_CLOSED",
  INVOICE_GENERATED = "INVOICE_GENERATED",
  NOTE_ADDED = "NOTE_ADDED",
  VIP_FLAGGED = "VIP_FLAGGED",
  RESTORATION = "RESTORATION",   // re-confirmed after cancellation (policy-dependent)
}

export interface IBookingEvent extends Document {
  booking: mongoose.Types.ObjectId;
  eventType: BookingEventType;
  description: string;
  performedBy: mongoose.Types.ObjectId;  // User who triggered the event
  performedByRole: string;
  performedAt: Date;

  // For change events: what changed
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;

  // Links to related records
  roomId?: mongoose.Types.ObjectId;
  folioId?: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  advancePaymentId?: mongoose.Types.ObjectId;

  metadata?: Record<string, any>;
}

const BookingEventSchema = new Schema<IBookingEvent>(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    eventType: { type: String, enum: Object.values(BookingEventType), required: true },
    description: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    performedByRole: { type: String, required: true },
    performedAt: { type: Date, required: true, default: Date.now },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    folioId: { type: Schema.Types.ObjectId, ref: "Folio" },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    advancePaymentId: { type: Schema.Types.ObjectId, ref: "AdvancePayment" },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

BookingEventSchema.index({ booking: 1, performedAt: -1 });
BookingEventSchema.index({ eventType: 1, performedAt: -1 });

export const BookingEvent = (mongoose.models.BookingEvent as mongoose.Model<IBookingEvent>) || mongoose.model<IBookingEvent>("BookingEvent", BookingEventSchema);
