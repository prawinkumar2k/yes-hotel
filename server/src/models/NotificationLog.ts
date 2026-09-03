import mongoose, { Document, Schema } from "mongoose";

export enum NotificationType {
  BOOKING_CONFIRMATION = "BOOKING_CONFIRMATION",
  BOOKING_CANCELLATION = "BOOKING_CANCELLATION",
  PAYMENT_CONFIRMATION = "PAYMENT_CONFIRMATION",
  REFUND_UPDATE = "REFUND_UPDATE",
}

export enum NotificationStatus {
  // No real email provider is configured — the notification was recorded
  // and logged to the server console, but nothing was actually delivered.
  LOGGED_ONLY = "LOGGED_ONLY",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface INotificationLog extends Document {
  type: NotificationType;
  recipientEmail: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  bookingId?: mongoose.Types.ObjectId;
  errorMessage?: string;
  createdAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    type: { type: String, enum: Object.values(NotificationType), required: true },
    recipientEmail: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: Object.values(NotificationStatus), required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    errorMessage: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationLogSchema.index({ recipientEmail: 1, createdAt: -1 });
NotificationLogSchema.index({ bookingId: 1 });

export const NotificationLog = mongoose.model<INotificationLog>("NotificationLog", NotificationLogSchema);
