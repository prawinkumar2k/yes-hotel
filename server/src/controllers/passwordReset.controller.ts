import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { hashPassword } from "../utils/auth";
import { revokeAllRefreshTokensForUser } from "../services/refreshToken.service";

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({
  token: z.string().min(1),
  userId: z.string().min(1),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const { email } = parsed.data;
    const user = await User.findOne({ email });

    // IMPORTANT: Always return 200 to prevent account enumeration
    const successMsg = "If an account with that email exists, a password reset link has been sent.";

    if (!user) return res.status(200).json({ success: true, message: successMsg });

    // Invalidate old tokens for this user
    await PasswordResetToken.deleteMany({ userId: user._id });

    // Generate a secure random token
    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(plainToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt, used: false });

    // Build reset URL
    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/reset-password?token=${plainToken}&uid=${user._id}`;

    // In DEVELOPMENT: log the reset URL to the console (safe)
    if (process.env.NODE_ENV !== "production") {
      console.log("\n⚠️  [DEV MODE] Password Reset Link:");
      console.log(`   ${resetUrl}`);
      console.log(`   Expires: ${expiresAt.toISOString()}\n`);
    }

    // TODO: In PRODUCTION, send via email (Nodemailer / SendGrid)
    // await sendPasswordResetEmail(user.email, resetUrl);

    return res.status(200).json({ success: true, message: successMsg });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.issues });
    }

    const { token, userId, password } = parsed.data;

    // Find the most recent unused token for this user
    const record = await PasswordResetToken.findOne({
      userId,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired. Please request a new one." });
    }

    // Verify the token against the hash
    const isValid = await bcrypt.compare(token, record.tokenHash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired." });
    }

    // Mark token as used (one-time use)
    record.used = true;
    await record.save();

    // Update user password
    const passwordHash = await hashPassword(password);
    await User.findByIdAndUpdate(userId, { passwordHash });

    // A password reset means the account owner is regaining control after
    // a real or suspected compromise — every existing session (refresh
    // token) must stop working, not just the compromised credential.
    await revokeAllRefreshTokensForUser(userId);

    return res.status(200).json({ success: true, message: "Password reset successful. You can now log in with your new password." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
