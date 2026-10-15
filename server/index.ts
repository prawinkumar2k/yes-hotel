import "dotenv/config";
import express from "express"; // Force reload
import cors from "cors";
import { allowedOrigins } from "./src/config/origins";
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
import bookingEnquiryRoutes from "./src/routes/bookingEnquiry.routes";
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
import roomRackRoutes from "./src/routes/room-rack.routes";
import frontDeskRoutes from "./src/routes/front-desk.routes";
import advanceRoutes from "./src/routes/advance.routes";
import verificationRoutes from "./src/routes/verification.routes";
import { customerRouter, changeRequestRouter } from "./src/routes/customer.routes";
import chatRoutes from "./src/routes/chat.routes";
import receptionRoutes from "./src/routes/reception.routes";
import folioRoutes from "./src/routes/folio.routes";
import nightAuditRoutes from "./src/routes/night-audit.routes";
import reportsRoutes from "./src/routes/reports.routes";
import cashierShiftRoutes from "./src/routes/cashier-shift.routes";
import ratePlanRoutes from "./src/routes/rate-plan.routes";
import corporateAccountRoutes from "./src/routes/corporate-account.routes";
import groupBookingRoutes from "./src/routes/group-booking.routes";
import inspectionRoutes from "./src/routes/inspection.routes";

import accountingRoutes from "./src/routes/accounting.routes";
import banquetRoutes from "./src/routes/banquet.routes";
import ancillaryRoutes from "./src/routes/ancillary.routes";
import complaintRoutes from "./src/routes/complaint.routes";
import propertyRoutes from "./src/routes/property.routes";
import housekeepingRoutes from "./src/routes/housekeeping.routes";
import commandCenterRoutes from "./src/routes/command-center.routes";
import paymentChannelRoutes from "./src/routes/payment-channel.routes";
import taskApprovalRoutes from "./src/routes/task-approval.routes";
import walkInRegistrationRoutes from "./src/routes/walk-in-registration.routes";
import permissionRoutes from "./src/routes/permission.routes";
import posRoutes from "./src/routes/pos.routes";
import menuRoutes from "./src/routes/menu.routes";
import seoRoutes from "./src/routes/seo.routes";
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
  app.set("trust proxy", 1);

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
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.unsplash.com"],
        // The homepage hero background video (Hero.tsx) is hosted on
        // Pixabay's CDN. Without an explicit media-src, CSP falls back to
        // default-src 'self' and silently blocks the video (no console
        // error a typical user would notice — it just never plays).
        mediaSrc: ["'self'", "https://cdn.pixabay.com"],
        workerSrc: ["'self'", "blob:"],
        connectSrc: isProduction
          ? ["'self'", ...RAZORPAY_ORIGINS]
          : ["'self'", ...RAZORPAY_ORIGINS, "ws:", "wss:"],
        frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Helmet's CSP defaults include upgrade-insecure-requests, which
        // makes the browser rewrite every http:// subresource request
        // (Vite's client, main.tsx, favicon, ...) to https:// even when the
        // page itself was loaded over plain HTTP. The dev server only
        // speaks HTTP, so that upgrade fails outright
        // (net::ERR_SSL_PROTOCOL_ERROR) and the browser also blocks the
        // resulting scheme mismatch as an unsafe frame load. Only meaningful
        // once this app is actually served over HTTPS in production.
        upgradeInsecureRequests: (isProduction && process.env.UPGRADE_INSECURE_REQUESTS !== "false" && process.env.COOKIE_SECURE !== "false") ? [] : null,
      },
    },
    // COOP/OAC only need to be off in dev (they warn on non-HTTPS
    // localhost); a real production deployment is served over HTTPS and
    // should have them on.
    crossOriginOpenerPolicy: (isProduction && process.env.COOKIE_SECURE !== "false") ? undefined : false,
    originAgentCluster: (isProduction && process.env.COOKIE_SECURE !== "false") ? undefined : false,
  }));
  app.use(
    cors({
      origin: allowedOrigins(),
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
    //
    // In development the same localhost IP also carries every manual API
    // test/curl call plus several 30-45s polling queries across admin pages,
    // all sharing one 15-minute budget — 300 gets exhausted well within a
    // normal working session and starts 429ing real traffic.
    //
    // The same is true in production: every staff member at the hotel shares
    // the hotel's one internet connection (one IP), and each staff screen polls
    // badge counts every 30-60 s. 300 per 15 min locked the whole desk out in
    // testing, so production allows 3,000 — still far below any flood.
    max: Number(process.env.RATE_LIMIT_API_MAX) || (process.env.NODE_ENV === "production" ? 3000 : 5000),
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  });
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // Brute-force budget for credential and payment-verification endpoints.
    // Dev/test get a looser default so e2e suites that log in repeatedly do not trip it.
    max: Number(process.env.RATE_LIMIT_AUTH_MAX) || (process.env.NODE_ENV === "production" ? 10 : 200),
    // Only failed attempts count: a hotel's staff share one internet connection, and normal
    // sign-ins must never lock the desk out. Wrong-password guessing is still limited.
    skipSuccessfulRequests: true,
    message: { success: false, message: "Too many failed attempts from this connection. Please wait 15 minutes and try again." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Token refresh is legitimate background traffic (one per expiry per tab), so
  // it gets its own moderate budget instead of the credential-guessing one.
  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_REFRESH_MAX) || (process.env.NODE_ENV === "production" ? 60 : 1000),
    message: "Too many attempts from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", generalLimiter);
  app.use("/api/auth/login", strictLimiter);
  app.use("/api/auth/booking-login", strictLimiter);
  app.use("/api/auth/otp", strictLimiter);
  app.use("/api/auth/change-password", strictLimiter);
  app.use("/api/customer/bookings/link", strictLimiter);
  app.use("/api/customer/payments/verify", strictLimiter);
  app.use("/api/auth/register", strictLimiter);
  app.use("/api/auth/forgot-password", strictLimiter);
  app.use("/api/auth/reset-password", strictLimiter);
  app.use("/api/payments/verify", strictLimiter);
  app.use("/api/auth/refresh", refreshLimiter);

  // Razorpay webhook signature verification needs the exact raw request
  // bytes — must be captured BEFORE express.json() parses (and thereby
  // discards) the original body. Mounted ahead of the generic JSON parser,
  // scoped to only this path; body-parser's later json() middleware sees
  // req._body already set and skips re-parsing, leaving the raw Buffer in
  // req.body for the webhook route to verify against.
  app.use("/api/webhooks/razorpay", express.raw({ type: "*/*", limit: "1mb" }));

  // Body parsers
  // Photos are resized on the device (~150-400 KB each), so 10 MB covers several ID images.
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
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
  app.use("/api/booking-enquiry", bookingEnquiryRoutes);
  app.use("/api/booking-enquiries", bookingEnquiryRoutes);
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
  // ── NEW HMS ROUTES ──
  app.use("/api/room-rack", roomRackRoutes);
  app.use("/api/front-desk", frontDeskRoutes);
  // Walk-in Guest Registration workflow (Sections A–F of the physical registration card)
  app.use("/api/front-desk/registration", walkInRegistrationRoutes);
  app.use("/api/advances", advanceRoutes);
  app.use("/api/verifications", verificationRoutes);
  app.use("/api/customer", customerRouter);
  app.use("/api/chat", chatRoutes);
  app.use("/api/change-requests", changeRequestRouter);
  app.use("/api/reception", receptionRoutes);
  app.use("/api/folios", folioRoutes);
  app.use("/api/night-audit", nightAuditRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/cashier-shifts", cashierShiftRoutes);
  app.use("/api/rate-plans", ratePlanRoutes);
  app.use("/api/corporate-accounts", corporateAccountRoutes);
  app.use("/api/group-bookings", groupBookingRoutes);
  app.use("/api/inspections", inspectionRoutes);

  app.use("/api/accounting", accountingRoutes);
  app.use("/api/banquets", banquetRoutes);
  app.use("/api/ancillary", ancillaryRoutes);
  app.use("/api/complaints", complaintRoutes);
  app.use("/api/properties", propertyRoutes);
  app.use("/api/housekeeping", housekeepingRoutes);
  app.use("/api/dashboard/command-center", commandCenterRoutes);
  app.use("/api/payment-channels", paymentChannelRoutes);
  app.use("/api/task-approvals", taskApprovalRoutes);
  app.use("/api/permissions", permissionRoutes);
  app.use("/api/pos", posRoutes);
  app.use("/api/menu", menuRoutes);
  app.use("/api/seo", seoRoutes);


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
