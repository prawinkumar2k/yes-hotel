import { z } from "zod";

/**
 * Fail-fast environment validation. In production, a missing required
 * variable must stop the server from starting at all — silently running
 * with an undefined MONGODB_URI or CLIENT_URL produces confusing runtime
 * failures much later instead of one clear error at boot.
 *
 * This intentionally does NOT validate JWT_ACCESS_SECRET here — that has
 * its own dedicated fail-fast check in server/src/config/jwt.ts, whose
 * production branch is statically compiled into the build (verified by
 * inspecting the built bundle), which is a stronger guarantee than a
 * runtime env check alone.
 */
const baseSchema = z.object({
  PORT: z.string().optional(),
  // Optional at the schema level — connectDB() already has a sensible
  // localhost default for dev/test. Production requiring an explicit value
  // is enforced separately below, since a production deployment silently
  // falling back to a localhost Mongo URI would be a real footgun.
  MONGODB_URI: z.string().optional(),
  CLIENT_URL: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
});

export function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";

  const result = baseSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  if (isProduction) {
    const missing: string[] = [];
    if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");
    if (!process.env.CLIENT_URL) missing.push("CLIENT_URL");
    // Razorpay/Cloudinary/Email are feature-gated rather than hard-required
    // in production — the app already fails safely when they're absent
    // (payment demo-fallback stays available but self-disables once real
    // Razorpay creds exist, per confirmDemoBooking; gallery uploads and
    // email sends fail with a clear error rather than faking success). Only
    // flag them as a loud warning, not a hard boot failure, since a hotel
    // could legitimately launch web-only before wiring every integration.
    // If Razorpay is configured at all, the webhook secret is not optional:
    // without it, POST /api/webhooks/razorpay fails closed on every request
    // (by design — see webhook.controller.ts), which silently breaks payment
    // reconciliation for a hotel that thinks it has webhooks live. Catch
    // that misconfiguration at boot instead of discovering it when a guest's
    // browser closes mid-checkout and the payment never gets confirmed.
    if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_WEBHOOK_SECRET) {
      missing.push("RAZORPAY_WEBHOOK_SECRET (required because RAZORPAY_KEY_ID is set)");
    }
    if (missing.length > 0) {
      console.error(`❌ Missing required production environment variables: ${missing.join(", ")}`);
      process.exit(1);
    }
    const softMissing = ["RAZORPAY_KEY_ID", "CLOUDINARY_CLOUD_NAME", "EMAIL_USER"].filter(
      (k) => !process.env[k]
    );
    if (softMissing.length > 0) {
      console.warn(
        `⚠️  Production is starting without: ${softMissing.join(", ")}. ` +
          "Related features will run in their documented fallback/disabled mode, not fake success."
      );
    }
  }
}
