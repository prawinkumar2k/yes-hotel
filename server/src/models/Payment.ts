import mongoose, { Document, Schema } from "mongoose";

export enum PaymentMethod {
  RAZORPAY = "RAZORPAY",
  CARD = "CARD",
  CASH = "CASH",
  UPI = "UPI",
}

export enum PaymentTxStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
}

export interface IPayment extends Document {
  booking: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  method: PaymentMethod;
  transactionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: PaymentTxStatus;
  refundedAmount: number;
}

const PaymentSchema = new Schema<IPayment>(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "USD" },
    method: { type: String, enum: Object.values(PaymentMethod), required: true },
    transactionId: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    status: { type: String, enum: Object.values(PaymentTxStatus), default: PaymentTxStatus.PENDING },
    // The cumulative amount actually refunded so far. This is the field an
    // atomic compare-and-increment guards against a refund pushing the total
    // past the original payment amount, whether from a double-click, a
    // network retry, or two concurrent admin requests.
    refundedAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Sparse because CASH/demo payments have no razorpayPaymentId — but wherever
// it IS present, it must be unique. This is the database-level invariant
// that makes replayed/duplicate payment verification impossible to record
// twice, regardless of application-level races.
PaymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
// Supports getPaymentByBooking and refund lookups.
PaymentSchema.index({ booking: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
