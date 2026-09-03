import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { connectDB } from "./src/config/database";
import { validateEnv } from "./src/config/env";
import { installUnscopedWriteGuard } from "./src/config/mongoose-safety";
import { requestContext, requestLogger } from "./src/middleware/requestContext.middleware";
import { errorHandler } from "./src/middleware/errorHandler.middleware";
import { logger } from "./src/services/logger.service";
import { ensureJobWorkerStarted } from "./src/services/job-queue.service";
import { registerNotificationJobHandlers } from "./src/jobs/notificationRetry.job";
import { handleDemo } from "./routes/demo";
import authRoutes from "./src/routes/auth.routes";
import roomRoutes from "./src/routes/room.routes";
import bookingRoutes from "./src/routes/booking.routes";
import adminRoutes from "./src/routes/admin.routes";
import paymentRoutes from "./src/routes/payment.routes";
import contactRoutes from "./src/routes/contact.routes";
import reviewRoutes from "./src/routes/review.routes";
import faqRoutes from "./src/routes/faq.routes";
import testimonialRoutes from "./src/routes/testimonial.routes";
import contentRoutes from "./src/routes/content.routes";
import guestRoutes from "./src/routes/guest.routes";
import refundRoutes from "./src/routes/refund.routes";
import couponRoutes from "./src/routes/coupon.routes";
import staffRoutes from "./src/routes/staff.routes";
import galleryRoutes from "./src/routes/gallery.routes";
import settingsRoutes from "./src/routes/settings.routes";
import publicRoutes from "./src/routes/public.routes";
import auditLogRoutes from "./src/routes/auditLog.routes";
import webhookRoutes from "./src/routes/webhook.routes";
import sitemapRoutes from "./src/routes/sitemap.routes";
import { getJwtSecret } from "./src/config/jwt";

// Guards against createServer() being called more than once in the same
// process (Vite's dev middleware plugin, or repeated test imports) from
// stacking duplicate process-level listeners.
let processHandlersInstalled = false;

export function createServer() {
  // Fail fast: invalid/missing configuration should stop the server at
  // boot, not surface as a confusing failure on the first real request.
  validateEnv();
  getJwtSecret();
  installUnscopedWriteGuard();

  const app = express();

  // Correlation id + structured request logging — first in the chain so
  // every response (including ones rejected by rate limiting or CORS) gets
  // an X-Request-Id header and a log line, not just successful API calls.
  app.use(requestContext);
  app.use(requestLogger);

  // A crash outside any request (a stray unhandled promise rejection, a
  // programming error in a fire-and-forget .catch()-less call) previously
  // had no structured record at all — Node would print a raw stack trace to
  // stderr with no way to correlate it to anything. Logged, not swallowed;
  // deliberately does NOT call process.exit() here, since many of these are
  // recoverable (e.g. a notification send failing) and killing the whole
  // server over one is a worse outcome than logging and continuing.
  if (!processHandlersInstalled) {
    processHandlersInstalled = true;
    process.on("unhandledRejection", (reason: any) => {
      logger.error("unhandled_rejection", { message: reason?.message ?? String(reason), stack: reason?.stack });
    });
    process.on("uncaughtException", (err: Error) => {
      logger.error("uncaught_exception", { message: err.message, stack: err.stack });
    });
  }

  // Connect to Database
  connectDB();

  // Durable (MongoDB-backed) background job worker — currently used for
  // notification-email retry with exponential backoff. See
  // job-queue.service.ts for why this is Mongo-backed rather than an
  // in-memory queue.
  registerNotificationJobHandlers();
  ensureJobWorkerStarted();

  // Security Middleware
  const isProduction = process.env.NODE_ENV === "production";

  // Content-Security-Policy — audited against the app's actual external
  // dependencies (see index.html, PaymentPage.tsx, and the Gallery/About/Hero
  // components): the Razorpay checkout script + its iframe/XHR endpoints,
  // Cloudinary-hosted images, the Unsplash fallback images used when no CMS
  // content/gallery upload exists yet, and Google Fonts.
  //
  // Development gets a looser script-src/connect-src because the Express app
  // runs as Vite dev-server middleware in dev (vite.config.ts) — Vite's own
  // client and @vitejs/plugin-react's Fast Refresh preamble inject a small
  // inline <script type="module"> and rely on eval-based HMR, and the HMR
  // client needs a ws:// connection back to the dev server. None of that
  // exists in the production bundle (verified: dist/server/node-build.mjs
  // serves the prebuilt dist/spa assets with no Vite runtime involved), so
  // production does not need 'unsafe-inline'/'unsafe-eval' for scripts.
  const RAZORPAY_ORIGINS = ["https://checkout.razorpay.com", "https://api.razorpay.com", "https://lumberjack.razorpay.com"];
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction
          ? ["'self'", ...RAZORPAY_ORIGINS]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...RAZORPAY_ORIGINS],
        // Inline `style="..."` attributes are load-bearing for this app —
        // Framer Motion and Radix UI both set element styles directly
        // (animation transforms, positioning), not via injected stylesheets.
        // That's a materially lower-risk relaxation than allowing inline
        // *scripts*, and is the standard accepted tradeoff for this stack.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.unsplash.com"],
        connectSrc: isProduction
          ? ["'self'", ...RAZORPAY_ORIGINS]
          : ["'self'", ...RAZORPAY_ORIGINS, "ws:", "wss:"],
        frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // COOP/OAC only need to be off in dev (they warn on non-HTTPS
    // localhost); a real production deployment is served over HTTPS and
    // should have them on.
    crossOriginOpenerPolicy: isProduction ? undefined : false,
    originAgentCluster: isProduction ? undefined : false,
  }));
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:8080",
      credentials: true,
    })
  );
  
  // Rate limiting — differentiated: auth/payment-verification endpoints are
  // realistic brute-force/abuse targets and get a much stricter budget than
  // general operational API traffic.
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // 100 was found to be too strict during real testing — a single active
    // admin dashboard session (stats + bookings + guests + payments, each
    // with React Query refetches) can plausibly exceed that in normal use,
    // and a shared IP (hotel wifi, corporate NAT) makes it worse. The
    // endpoints that actually need a tight budget (login, register,
    // password reset, refresh, payment verification) already have their
    // own dedicated stricter limiter below.
    max: 300,
    message: "Too many requests from this IP, please try again after 15 minutes",
  });
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many attempts from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", generalLimiter);
  app.use("/api/auth/login", strictLimiter);
  app.use("/api/auth/register", strictLimiter);
  app.use("/api/auth/forgot-password", strictLimiter);
  app.use("/api/auth/reset-password", strictLimiter);
  app.use("/api/payments/verify", strictLimiter);
  app.use("/api/auth/refresh", strictLimiter);

  // Razorpay webhook signature verification needs the exact raw request
  // bytes — must be captured BEFORE express.json() parses (and thereby
  // discards) the original body. Mounted ahead of the generic JSON parser,
  // scoped to only this path; body-parser's later json() middleware sees
  // req._body already set and skips re-parsing, leaving the raw Buffer in
  // req.body for the webhook route to verify against.
  app.use("/api/webhooks/razorpay", express.raw({ type: "*/*", limit: "1mb" }));

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Dynamic sitemap — registered before the SPA static-file middleware
  // (added later, in node-build.ts, for the production entrypoint), so it
  // takes precedence over any same-named static file.
  app.use(sitemapRoutes);

  // Health & readiness — never leak connection strings, secrets, or stack
  // traces. Liveness only reports the process is up; readiness additionally
  // checks the one dependency that actually matters for serving traffic.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.get("/api/ready", (_req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) {
      return res.status(503).json({ status: "not ready", database: "disconnected" });
    }
    res.status(200).json({ status: "ready", database: "connected" });
  });

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/rooms", roomRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/faqs", faqRoutes);
  app.use("/api/testimonials", testimonialRoutes);
  app.use("/api/content", contentRoutes);
  app.use("/api/guests", guestRoutes);
  app.use("/api/refunds", refundRoutes);
  app.use("/api/coupons", couponRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/gallery", galleryRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/audit-logs", auditLogRoutes);
  app.use("/api/webhooks", webhookRoutes);

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Must be registered LAST — Express only routes to a 4-arg middleware as
  // an error handler, and only for errors from routes registered before it.
  app.use(errorHandler);

  return app;
}
