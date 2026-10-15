import mongoose, { Document, Schema } from "mongoose";

/**
 * One-time sign-in code emailed to a guest. Only a hash of the code is stored. A code lives
 * 10 minutes (TTL index removes it), allows 5 wrong tries, and can be used once.
 */
export interface ILoginOtp extends Document {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date;
  ip?: string;
  createdAt: Date;
}

const LoginOtpSchema = new Schema<ILoginOtp>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

LoginOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginOtp =
  (mongoose.models.LoginOtp as mongoose.Model<ILoginOtp>) || mongoose.model<ILoginOtp>("LoginOtp", LoginOtpSchema);
