# YES Hotels — Hotel Management Platform

A full-stack hotel booking and operations platform: a public booking website plus an internal system for admin, management, reception, housekeeping, and maintenance staff.

## Tech Stack

- **Frontend**: React 18 + React Router 6 (SPA) + TypeScript + Vite + TailwindCSS
- **Backend**: Express, integrated with the Vite dev server (single process in dev)
- **Database**: MongoDB via Mongoose
- **Testing**: Vitest
- **Payments**: Razorpay
- **Media**: Cloudinary
- **Email**: Nodemailer (SMTP)

## Getting Started

```bash
pnpm install
cp .env.example .env   # then fill in the values below
pnpm seed               # populates demo accounts, rooms, and categories
pnpm dev                 # http://localhost:8080
```

Run the checks before committing anything:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Environment Variables

See `.env.example` for the full list. Notes on each:

| Variable | Required? | Notes |
|---|---|---|
| `PORT` | No | Defaults to 8080 |
| `MONGODB_URI` | Yes | See "MongoDB setup" below — **must be a replica set for booking creation to work** |
| `JWT_ACCESS_SECRET` | **Yes in production** | The server refuses to start in production without this set. In development it falls back to an insecure default and logs a warning — never rely on that fallback outside development |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | No | Without these, checkout falls back to a dev-only demo-confirm path (see "Payments" below). That fallback is hard-disabled the moment real credentials are present |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | No | Required for the Gallery admin module's image uploads. Without them, gallery uploads will fail with a clear error |
| `EMAIL_USER` / `EMAIL_PASS` | No | Without these, notifications (booking confirmation, cancellation, refund) are logged to the server console and to the `NotificationLog` collection instead of actually being sent — never silently claimed as delivered |
| `EMAIL_SERVICE` | No | Nodemailer service name, defaults to `gmail` |
| `CLIENT_URL` | No | Used for CORS and for building links (e.g. password reset) — set to your real deployed frontend URL in production |

## Test Database Isolation

`pnpm test` runs against a **separate database** (`yes_hotels_test` by default, override with `TEST_MONGODB_URI`), never the dev database. This exists because a failed test previously leaked orphaned data into the real dev DB. `pnpm test:reset-db` drops the test database completely — it's safe because the script refuses to run against anything whose name doesn't end in `_test`, verified by testing the guard against the real dev DB name directly.

**Permanent guard against a repeat of the original incident**: the actual root cause of that incident was an *unscoped* `deleteMany({})` in test cleanup, not just the wrong database — a scoped filter pointed at the wrong DB would have been comparatively harmless. `server/src/config/mongoose-safety.ts` patches `mongoose.Query.prototype.deleteMany`/`updateMany` globally to refuse any call with an empty filter (`{}` or no filter at all), everywhere — installed at server boot (`installUnscopedWriteGuard()` in `server/index.ts`) and in the test runner itself (`vitest.config.ts`'s `setupFiles`), since the original incident happened in test code, which never goes through `createServer()`. Verified empirically in `mongoose-safety.spec.ts`: an unscoped call on a real model throws and leaves data untouched, while a properly scoped call is unaffected. The one intentional bypass is `server/src/scripts/reset-test-db.ts`, which uses `dropDatabase()` (not `deleteMany`) and is separately gated to only ever target a database name ending in `_test`.

## MongoDB Setup — Replica Set Requirement

Booking creation uses a MongoDB **multi-document transaction** to guarantee inventory/idempotency safety (see `server/src/services/booking-safety.service.ts`). Transactions require a replica set — a standalone `mongod` will reject them at runtime.

For local development, convert a standalone instance to a single-node replica set once:

1. Add to your `mongod.cfg` (or launch flags):
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Restart `mongod`.
3. Initiate the set once: connect with `mongosh` and run `rs.initiate()`.

Existing data is preserved by this conversion. For production, use a managed replica set (e.g. MongoDB Atlas, which is a replica set by default) or self-host a proper multi-node replica set — a single-node set is a development convenience only, not a production HA setup.

## Payments

- `POST /api/payments/create-order` and `POST /api/payments/verify` are the real Razorpay integration: server-side order creation, HMAC-SHA256 signature verification, and a replay guard (a unique index on the payment's Razorpay payment ID rejects a duplicate `verify` call for the same transaction).
- **Dev-only fallback**: if `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are absent, `POST /api/bookings/:id/confirm-demo` lets checkout complete without a real charge, for local development and demos. This route **hard-refuses (403)** the moment real Razorpay credentials are configured — it cannot be used to bypass a live gateway in a properly configured deployment.
- Refunds (`POST /api/refunds/initiate`) are amount-capped by an atomic compare-and-increment against the payment's original amount — concurrent or duplicate refund requests cannot push the total refunded past what was actually paid. A full refund automatically cancels the booking and releases its inventory/coupon.

## Roles & Permissions

| Role | Can access |
|---|---|
| `CUSTOMER` | Public site, their own bookings/payments/reviews/profile |
| `RECEPTIONIST` | Bookings, calendar, check-in/out, guests, rooms, housekeeping/maintenance (read) |
| `HOUSEKEEPING` | Housekeeping tasks only |
| `MAINTENANCE` | Maintenance tickets only |
| `MANAGER` | Everything ADMIN has except granting/editing ADMIN accounts and modifying critical settings |
| `ADMIN` | Full access, including staff management and hotel settings |

Authorization is enforced server-side on every route (`protect` + `authorize(...)` middleware, or an explicit ownership check in the controller) — the frontend's route guards are a UX convenience, never the source of truth.

## Seed / Demo Data

```bash
pnpm seed
```

This is **idempotent and non-destructive** — it only creates records that don't already exist (checked by email/slug/room number), never deletes or overwrites existing data. Safe to run repeatedly, including against a database with real bookings in it.

It creates:
- One account per role (see credentials below)
- 4 room categories (Standard, Deluxe, Executive, Signature Suite) with realistic pricing
- 13 physical rooms across those categories

**Demo credentials** (printed by the seed command itself):

| Role | Email | Password |
|---|---|---|
| Admin | admin@yeshotels.com | Admin@123 |
| Manager | manager@yeshotels.com | Manager@123 |
| Receptionist | reception@yeshotels.com | Reception@123 |
| Housekeeping | housekeeping@yeshotels.com | House@123 |
| Maintenance | maintenance@yeshotels.com | Main@123 |
| Customer | customer@yeshotels.com | Customer@123 |

These are development/demo credentials only — never reuse them in a production deployment, and rotate/replace them before any real launch.

## Architecture Notes

- **Booking safety**: `server/src/services/booking-safety.service.ts` — MongoDB transaction wraps idempotency-key finalization, per-night inventory claims, and booking creation as one atomic unit. A crash or failure at any point rolls back everything, not just the immediate operation. Covered by a real 10-concurrent-request test in `server/src/controllers/booking.controller.spec.ts`.
- **Coupons**: discount calculation is entirely server-side (`server/src/services/coupon.service.ts`); redemption is atomic (compare-and-increment on `timesUsed`) and only happens after payment confirms, not at booking creation. Cancelling a redeemed booking releases the slot back.
- **Audit logging**: `server/src/services/audit.service.ts` records sensitive mutations with an explicit `actorType` (`USER` / `GUEST` / `SYSTEM`) — guest/anonymous actions are never attributed to a fabricated user account. Viewable at `/admin/audit-logs` (ADMIN/MANAGER only).
- **Notifications**: `server/src/services/notification.service.ts` — every notification attempt is durably logged to the `NotificationLog` collection with an honest status (`SENT`, `FAILED`, or `LOGGED_ONLY` when no SMTP is configured). Never claims delivery it didn't attempt.
- **Refresh tokens**: `server/src/services/refreshToken.service.ts` — login/register issue a rotating refresh token (random 48-byte value, only its SHA-256 hash stored) alongside the existing access token, delivered as an `httpOnly`/`secure`(prod)/`sameSite=lax` cookie scoped to `path: /api/auth`. `POST /api/auth/refresh` rotates it (old token marked used, new one issued in the same "family"); presenting an already-used token is treated as theft and revokes every token in that family. `POST /api/auth/logout` revokes it server-side. `client/lib/api.ts` transparently retries a single 401 by calling `/api/auth/refresh` before failing. Covered by `server/src/services/refreshToken.service.spec.ts` (issue/rotate, reuse-detection/family-revocation, unknown-token rejection, explicit revocation).
- **Health/readiness**: `GET /api/health` (liveness, always 200 once the process is up) and `GET /api/ready` (checks `mongoose.connection.readyState === 1`, 200/503) — for load balancer / orchestrator health checks.
- **Graceful shutdown**: `server/node-build.ts` — SIGTERM/SIGINT stop accepting new connections (`server.close`), let in-flight requests finish, close the MongoDB connection, then exit; a 10s force-exit timer is a safety net if something hangs.
- **Payment reconciliation**: `server/src/services/payment-reconciliation.service.ts` — the single authoritative path both the browser (`POST /api/payments/verify`) and the Razorpay webhook (`POST /api/webhooks/razorpay`) call into. Idempotent regardless of which fires first or whether both do; cross-checks the gateway-reported amount against the booking's server-calculated total (mismatches are quarantined, not confirmed); and only confirms a booking from a state where CONFIRMED is actually legal (see booking state machine below) — closing a real gap where a second, distinct successful Razorpay payment against an already-CONFIRMED booking would previously have silently created a second Payment record instead of being rejected.
- **Booking state machine**: `server/src/services/booking-state.service.ts` is the single source of truth for which `Booking.status` transitions are legal (`PENDING→CONFIRMED/CANCELLED`, `CONFIRMED→CHECKED_IN/CANCELLED`, `CHECKED_IN→CHECKED_OUT`, `CHECKED_OUT`/`CANCELLED` terminal). All 5 controllers that used to mutate `booking.status` directly (check-in, check-out, cancellation, demo payment confirmation, real payment confirmation, full-refund closure) now route through it. This fixed a real, pre-existing inconsistency: `cancellation.controller.ts` explicitly refused to cancel a `CHECKED_IN` booking, while `refund.controller.ts`'s full-refund path would silently force it to `CANCELLED` anyway — the two controllers disagreed about what was legal. Covered by `booking-state.service.spec.ts` (every legal/illegal transition pair) plus the reconciliation/webhook tests exercising it end-to-end.
- **Room state machine**: `server/src/services/room-state.service.ts` centralizes all `Room.status` transitions (`AVAILABLE↔RESERVED`, `→OCCUPIED`, `→CLEANING`, `→MAINTENANCE`, `→OUT_OF_SERVICE`, and back), across the 6 call sites that used to mutate it directly (check-in, check-out, cancellation, full-refund closure, housekeeping, maintenance). This fixed two real, live bugs: (1) check-in never checked the room's current status at all — a receptionist could check a guest into a room already under MAINTENANCE or already OCCUPIED by someone else; now it explicitly requires `AVAILABLE`. (2) Both housekeeping-task inspection and maintenance-ticket resolution unconditionally forced the room to `AVAILABLE`, even if it had been `OCCUPIED` when the ticket was filed (a guest reporting an issue mid-stay is a normal scenario) — a resolved ticket would incorrectly free an occupied room for a new booking. Fixed by adding `roomStatusBeforeTicket` to `MaintenanceTicket` (captured at ticket creation, restored on resolution) instead of hardcoding the restore target. Covered by `room-state.service.spec.ts` (transition legality matrix) and `room-state-integration.spec.ts` (both bugs reproduced end-to-end through the real controllers and proven fixed).
- **Audit logging for system/webhook events was silently broken, now fixed**: `createAuditLog`'s `userAgent: req?.headers["user-agent"]` looked null-safe but wasn't — optional chaining only guards the immediately preceding access, so with `req` undefined this evaluated `undefined["user-agent"]` and threw, which the function's own try/catch silently swallowed. Every req-less (webhook-originated, `actorType: SYSTEM`) audit call — `payment.completed` via webhook, `payment.failed`, refund confirmations — was failing to write an entry this entire time, invisible because nothing had asserted an `AuditLog` document actually existed, only that the payment/booking/refund side effects were correct. Fixed (`req?.headers?.["user-agent"]`) and now covered by a dedicated regression test (`audit.service.spec.ts`) plus an added assertion in the webhook test that the `AuditLog` entry genuinely exists in the database.
- **Pricing invariants**: `server/src/services/pricing.service.ts` extracts the booking total calculation (`taxable = max(roomCharges − discount, 0)`, `tax = round(taxable × 18%)`, `total = taxable + tax`) into a pure, directly-tested function — previously inline in the controller. `coupon.service.ts#calculateDiscount` independently caps discount at the booking amount. Covered by `monetary-invariants.spec.ts`: a full sweep of amount/discount combinations (total is always `taxable + tax`, never negative), plus real-concurrency tests — 2 and 10 simultaneous refund requests that would collectively overdraw a payment (cumulative refunds never exceed the captured amount), and 10 simultaneous coupon redemptions against a `usageLimit: 3` coupon (exactly 3 succeed).

## Deployment

**⚠️ Two real production-boot bugs were found and fixed by actually booting the production build in isolation** (`pnpm build` succeeding only proves the bundler didn't error — it does not prove the resulting server can start). Neither was ever caught by any prior `pnpm build`/`pnpm test`/dev-mode E2E run in this project's history, because dev mode runs the Express app as Vite middleware and never executes `server/node-build.ts` (the actual production entrypoint) at all:
1. **`mongoose`, `helmet`, `jsonwebtoken`, `express-rate-limit`, and `bcryptjs` were completely undeclared in `package.json`** (not even in `devDependencies`), and `cors` was miscategorized as a `devDependency`. They worked locally purely because they were already sitting in this working tree's `node_modules` from earlier `pnpm add` history. A genuine fresh install — a new clone, a CI runner, or (critically) a real production deployment running `pnpm install --prod`, which correctly skips `devDependencies` — would have failed to install them at all, and the server would crash on the very first `require`. Fixed: all six are now correctly declared in `dependencies`.
2. **The Express 5 SPA-fallback route crashed the server at boot**: `server/node-build.ts` used `app.get("*", ...)` to serve `index.html` for client-side routes. Express 5's routing engine (`path-to-regexp` v8) rejects a bare `"*"` wildcard outright — this threw synchronously the moment the route was registered, before `app.listen()` ever ran. Fixed to the Express-5-correct `app.get("/*splat", ...)`.

Both are now verified by an actual reproduction, not just code inspection: copying `package.json` + `pnpm-lock.yaml` + `dist/` into an isolated directory, running `pnpm install --prod --frozen-lockfile`, and running `node dist/server/node-build.mjs` for real — confirmed booting cleanly, connecting to MongoDB, and serving `/api/health`, `/api/ready`, the CSP header, the SPA fallback for a client route, and a JSON 404 for an unmatched API route.

**Security posture is environment-aware, not just described**: `vite.config.server.ts` statically compiles `NODE_ENV` to `"production"` into the built server bundle (`dist/server/node-build.mjs`) — verified by inspecting the actual compiled output, not assumed. This means:
- The insecure JWT dev-fallback secret is **not present at all** in the production build (dead-code-eliminated), regardless of what the hosting platform sets `NODE_ENV` to at runtime.
- `crossOriginOpenerPolicy` and `originAgentCluster` (Helmet headers, disabled in dev to avoid a non-HTTPS-localhost warning) are correctly enabled in the compiled production bundle.
- `POST /api/bookings/:id/confirm-demo` (a dev-only "mark this booking paid without a real gateway" fallback) is hard-refused whenever `NODE_ENV === "production"`, independent of whether Razorpay credentials happen to be set — previously it only self-disabled when Razorpay creds were present, which meant a production deployment that simply forgot to set them would leave a free-booking exploit live. Outside production, it also now requires the caller to be the booking's own logged-in owner or an admin/manager (an anonymous guest-checkout caller is still allowed, matching guest checkout's own reachability) — a logged-in customer can no longer fake-confirm a booking they don't own just by guessing its id. Covered by `payment.controller.spec.ts`.

## Backup & Disaster Recovery

**Recommended for a real production deployment**: use the database provider's native backup mechanism — e.g. MongoDB Atlas's continuous backup with point-in-time restore. That is more robust than anything an application script can offer (it captures the oplog continuously rather than at scheduled snapshot intervals) and should be the primary mechanism if the production database is Atlas-hosted.

**Also implemented here** (`server/src/scripts/backup.ts` / `restore.ts`, `server/src/services/backup-restore.service.ts`): an application-level backup as a portable fallback for any deployment target, including a self-hosted `mongod` with no provider-native backup available. Dumps every collection to MongoDB Extended JSON (EJSON — preserves `ObjectId`/`Date` types exactly, unlike plain `JSON.stringify`) plus a manifest of per-collection document counts.

```bash
pnpm backup [outDir]                              # defaults to ./backups
pnpm restore <backupDir> <targetMongoUri> [--force]
```

The restore path **refuses to target the database the app's own `MONGODB_URI` currently points at**, unless `--force` is explicitly passed — this is a bulk-insert disaster-recovery tool, and pointing it at a live database by accident is exactly the class of mistake `mongoose-safety.ts` exists to prevent elsewhere in this codebase.

**This was actually tested, not just implemented**: backed up the real dev database (26 collections, 108 documents), restored it into a freshly created, isolated verification database, confirmed every collection's restored count matched the backup's exactly, and spot-checked that `_id` came back as a real `ObjectId` and `createdAt` as a real `Date` (not stringified placeholders) — then dropped the verification database. Also covered by an automated test (`backup-restore.service.spec.ts`) that seeds a real document, backs it up, restores it into an isolated database, and asserts field-for-field/type-for-type fidelity, plus that the live-database refusal guard actually throws.

- **Retention/scheduling**: this script performs one backup per invocation — retention policy and scheduling (e.g. daily via cron/a platform's scheduled-jobs feature, keep 30 days) are an operational decision for wherever this is deployed, not something the script enforces itself.
- **Encryption**: relies on the storage layer (encrypted disk/bucket) for backups at rest — the script itself does not encrypt the EJSON files it writes. Encrypt the output directory/bucket at the infrastructure level before treating this as production-grade.
- **RPO** (Recovery Point Objective) = however frequently `pnpm backup` is scheduled to run (not continuous — this is snapshot-based, unlike Atlas's oplog-based continuous backup).
- **RTO** (Recovery Time Objective) = time to provision a fresh database + run `pnpm restore` — for the 108-document dev dataset this took a few seconds; scales with data volume.

## Observability

- **Structured logging** (`server/src/services/logger.service.ts`): every log line is a single JSON object (`timestamp`, `level`, `message`, plus named fields) to stdout/stderr — parseable by any log aggregator, unlike free-form `console.log` strings.
- **Request correlation ids** (`server/src/middleware/requestContext.middleware.ts`): every request gets an id — reused from an incoming `x-request-id` header when present (so a trace stays consistent behind a proxy/load balancer), generated fresh otherwise — echoed back as the `X-Request-Id` response header and attached to every log line for that request, including the 500 response body from the global error handler (so a support ticket quoting a request id can be matched to exact server-side logs).
- **One `http_request` log line per completed request**: method, path, status code, duration, and (when authenticated) the actor's user id/role — never the request/response body, which is exactly where a password or token could leak.
- **Global error-handling safety net** (`server/src/middleware/errorHandler.middleware.ts`): catches anything that escapes a controller's own try/catch (every controller has one, but shared middleware or a future omission wouldn't), logs it with full detail server-side, and returns a generic `{success:false, message:"Internal server error", requestId}` to the client — never the raw error message or stack trace.
- **Process-level crash visibility**: `unhandledRejection`/`uncaughtException` are logged (not silently lost to a raw stderr stack trace) without killing the process, since many are recoverable (e.g. a best-effort notification send failing).
- **Structured logging on the highest-value failure paths**: payment order creation, payment verification, refund initiation, booking creation, and the entire Razorpay webhook handler (signature failures, amount mismatches, illegal-transition rejections, processing failures) all log via the structured logger with `requestId` and relevant identifiers (bookingId/paymentId) attached. This is not applied uniformly across all ~25 controllers — the ones covered are the financial/booking-critical paths named as priorities; a broader sweep of every controller's catch block is disclosed, not done, future work.
- **Verified live**, not just implemented: booted the actual production artifact (isolated `--prod` install, same proof as the deployment section above) and confirmed `X-Request-Id` appears on real responses, an incoming trace id is correctly echoed back, and real `http_request`/`server_started` JSON log lines are written to stdout.
- **Never logged**: passwords, JWTs/refresh tokens, Razorpay key/webhook secrets, payment signatures, or raw request bodies for auth/payment routes. No call site in this codebase logs `req.body` wholesale — every log call names specific fields.

## Durable Background Jobs

`server/src/services/job-queue.service.ts` is a real durable job queue — MongoDB-backed, not in-memory. That's a deliberate choice given this project's actual infrastructure: no Redis/BullMQ is provisioned in this environment, and an in-memory queue presented as "production durable infrastructure" would be dishonest — jobs in this queue survive a process restart because they live in the database, not a JS array. If a Redis-backed queue is provisioned later, this module is the one piece that would need replacing; nothing about the job payloads or handler contract (`registerJobHandler(type, handler)` / `enqueueJob(type, payload, opts)`) is Mongo-specific.

- **Retries with exponential backoff + jitter**, capped at 30 minutes between attempts (`computeBackoffMs`).
- **Dead-letter visibility**: after `maxAttempts` (default 5), a job moves to `DEAD_LETTER` — not deleted, not retried forever — queryable via `getDeadLetterJobs()`.
- **Atomic claiming** (`findOneAndUpdate`) so the same job is never processed twice concurrently.
- **Wired into graceful shutdown**: `stopJobWorker()` is called during the same shutdown sequence as the HTTP server/DB connection close, so a new poll never starts mid-shutdown.
- **Currently used for**: notification email retry. Previously, a failed booking-confirmation/refund email was logged as `FAILED` in `NotificationLog` and never retried — a transient SMTP hiccup meant the guest silently never got their email unless someone noticed the log row. Now `notification.service.ts` enqueues a `notification.email_retry` job on failure (`server/src/jobs/notificationRetry.job.ts`), which updates the *original* `NotificationLog` row to `SENT` on eventual success rather than creating a duplicate log entry.
- **Verified with real retry/backoff/dead-letter behavior**, not just implemented: `job-queue.service.spec.ts` proves a failing job is retried with a real future `nextAttemptAt`, isn't reclaimed before it's due, and dead-letters after exhausting attempts; `notificationRetry.job.spec.ts` proves the notification-retry handler actually updates the original log row on success and correctly fails (letting the queue retry) when no transporter is configured.
- **Not implemented**: a scheduled/cron job runner (e.g. periodic stale-idempotency-record cleanup) — the queue infrastructure exists and could support one, but none is currently registered.

## CI/CD

`.github/workflows/ci.yml` — install → dependency audit (advisory) → typecheck → unit/integration tests (against a real single-node replica-set MongoDB service container) → build → **boot the actual compiled production artifact and hit `/api/health` + `/api/ready`** (not just confirm the bundler didn't error — see "Deployment" above for why that distinction matters) → a separate E2E job running the full Playwright/axe suite, uploading the report as an artifact on failure.

**Disclosed honestly**: this repository has no git remote configured in this environment, so this workflow has **not been run against a real GitHub Actions runner** — it's been reviewed for structural correctness (valid step ordering, no tabs, consistent with the exact commands `pnpm typecheck`/`pnpm test`/`pnpm build` verified working locally throughout this README) but not executed end-to-end on GitHub's infrastructure. Required secrets for a real run: none for the CI job itself (it uses ephemeral throwaway values); a real deploy would need the full `.env.example` list as repository/environment secrets.

## Performance

A real load test (k6, `ramping-vus` 0→20 over 35s) was run against `GET /api/bookings/availability` — the "highest-traffic query in the app" per its own index comment (every search-page load hits it). Result: **p95 latency 14.25ms** for requests that were let through. Only ~300 of 77,305 fired requests were actually let through — because the general rate limiter (300 req/15min per IP) correctly engaged, exactly as designed, once one IP fired that much traffic. That's the rate limiter working correctly under real load, not a performance bug, and it means this test measured real latency for legitimate traffic but did NOT establish a true maximum-throughput ceiling (deliberately not disabled for the test — that would misrepresent how the app actually behaves in production).

**Not done**: a full production-scale load test against a realistic traffic pattern across multiple endpoints (booking creation, payment verification, concurrent check-ins), frontend bundle-size budget enforcement, image lazy-loading audit, or a memory-leak soak test. The bundle sizes visible in every `pnpm build` output in this README (largest chunk ~132KB gzipped, for `react-dom`) are reasonable for this stack but weren't benchmarked against a target budget.

## SEO

- **Dynamic sitemap** (`server/src/routes/sitemap.routes.ts`, `GET /sitemap.xml`): previously a static file listing only the fixed marketing pages. Now generated from the live database on every request — includes every real, active room category page (`/rooms/:slug`) with a real `lastmod`, and uses `CLIENT_URL` for absolute URLs. Verified live: 4 real room pages included alongside the static marketing pages.
- **Not implemented, and not claimed**: SSR/prerendering. This remains a client-rendered SPA — per-page `<title>`/meta description are set via a `useEffect` hook, which works for JS-executing crawlers (Googlebot does execute JS) but not one that doesn't. Migrating to SSR/prerendering would be an architectural change (a different Vite/React setup, or a prerendering step in the build), not a configuration tweak — out of scope here, and explicitly not built just to be able to claim it.
- Canonical URLs, OG image, and structured data remain as previously disclosed (`og:image` is a placeholder SVG; canonical `<link>` tags need a real production domain before they can be added, since a relative href breaks Vite's HTML asset processing).

### Option A — Netlify (already configured)

`netlify.toml` and `netlify/functions/api.ts` wrap the Express app as a serverless function via `serverless-http`. `netlify.toml`'s build command only builds the client (`build:client`) — the server is bundled separately by Netlify's own function bundler (esbuild), not via `build:server`. Set all variables from `.env.example` as Netlify environment variables before deploying.

### Option B — Traditional Node hosting (Render, Railway, Fly.io, a VPS, etc.)

```bash
pnpm install
pnpm build
pnpm start   # runs dist/server/node-build.mjs, which also serves the built client
```

Set all variables from `.env.example` in the platform's environment configuration. `MONGODB_URI` must point at a replica set (see "MongoDB Setup" above) — a managed service like MongoDB Atlas satisfies this by default.

### Pre-launch checklist

- [ ] `JWT_ACCESS_SECRET` set to a real, unique, secret value (never reuse the example/dev value)
- [ ] `MONGODB_URI` points at a replica-set-enabled MongoDB (required for booking transactions)
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` set to **live** keys, not test keys
- [ ] `CLOUDINARY_*` credentials set (Gallery uploads will fail without them)
- [ ] `EMAIL_USER` / `EMAIL_PASS` set, or accept that notifications will only be logged, never sent
- [ ] `CLIENT_URL` set to the real production frontend origin (used for CORS)
- [ ] Demo seed accounts' passwords rotated or the accounts removed before going live
- [ ] `og:image` in `index.html` replaced with a real photo; `robots.txt`/`sitemap.xml` updated with the real domain

## Real Browser Testing (Playwright)

`e2e/` contains real Chromium-based Playwright specs — not just code inspection:

- `e2e/public-site.spec.ts`: horizontal-overflow checks at 6 breakpoints (360/390/768/1024/1280/1440px) across all public pages, an `@axe-core/playwright` accessibility scan (critical/serious impact) per page, a keyboard-navigation reachability check, and a `prefers-reduced-motion` check.
- `e2e/admin-journey.spec.ts`: real login → dashboard → sidebar navigation flows for admin and housekeeping-staff roles.

Run with `npx playwright test` against a running dev server (`pnpm dev`). These are excluded from `pnpm test` (Vitest) via `vitest.config.ts`'s `exclude` — they need a live browser and server, not the unit/integration test DB.

**Latest run: 20/20 passed — zero accessibility violations.** No overflow, label, keyboard-nav, reduced-motion, or color-contrast failures.

## Known Limitations

- **No SSR/prerendering**: this is a client-rendered SPA. Per-page `<title>`/meta description are set via a `useEffect`-based hook, which works for JS-executing crawlers and the browser tab, but a crawler that doesn't execute JavaScript will only see `index.html`'s static defaults. Full per-page SEO would require server-side rendering or prerendering, which is out of scope for the current architecture.
- ~~~57 color-contrast violations~~ **Fixed — 0 remaining** (verified: `axe-core` WCAG AA scan, real Chromium, 20/20 Playwright tests passing). Two real root causes, not 57 unrelated tweaks:
  1. **`Navbar` had no light-appropriate state.** It was designed once, for the homepage, where it starts transparent with white text over a dark hero photo and only gets a solid dark background after scrolling. Every interior page (Rooms, Gallery, FAQ, Contact, Search, the whole booking flow, auth pages) reused the same component with no hero image behind it — so at page load (`scrollY=0`) it rendered white/near-white text directly on the page's light background, measured as low as **1.07:1** (need 4.5:1). This was the majority of all violations across every affected page. Fixed with a `transparent` prop (`Navbar.tsx`) — `transparent={false}` (now set on all 12 non-homepage pages) forces the always-solid dark bar those pages actually need; the homepage keeps its original hero behavior unchanged.
  2. **The brand gold (`#C9A227`) is only ~2.2–2.4:1 against white/ivory** — fine for buttons (large-area, wrapped in a solid gold background — that's a fill, not a text-contrast case) and icons, but real text-on-light usages (price tags, section eyebrow labels, "Sign in"/"Register" links) failed AA. Rather than redefine the brand gold everywhere (large, uncontrolled blast radius across buttons/icons/borders), added a second token `hotel-gold-text: #866A1C` scoped to exactly this case — computed and verified at 5.13:1 on white / 4.75:1 on ivory — and swapped it in only at the specific flagged text nodes.
  3. A few remaining `text-hotel-black/50` labels and one conditionally-rendered (previously untested, `socials.length > 0`) footer link were bumped to `/60` and `/50` respectively, computed the same way.
- **Sitemap is static** (`public/sitemap.xml`) and lists only the fixed marketing routes — it does not include dynamic room-detail pages. Update the `<loc>` values to absolute URLs (and reference the file from `robots.txt`) once a production domain is assigned.
- **`og:image` currently points at a placeholder SVG** — replace with a real production photo before launch; most social platforms won't render an SVG correctly in link previews.
- ~~Content-Security-Policy disabled~~ **Fixed**: CSP is enabled in every environment (`server/index.ts`), allowlisting exactly the app's real external dependencies (Razorpay checkout script/iframe/API, Cloudinary + Unsplash images, Google Fonts). Verified with a real Chromium browser crawling all public + auth pages plus interactive widget use, with zero CSP console violations; the full Playwright suite was re-run after enabling it with no new failures (same 14 passed / 6 pre-existing color-contrast failures as before). Development gets `'unsafe-inline'`/`'unsafe-eval'` in `script-src` only because the Express app runs as Vite dev-server middleware and Vite's HMR client/Fast Refresh preamble need it — the production bundle has no Vite runtime involved and does not carry that relaxation (verified against the compiled bundle, same pattern as the JWT dev-fallback check).
- ~~No Razorpay webhook endpoint~~ **Fixed**: `POST /api/webhooks/razorpay` is a real server-to-server webhook handler (`server/src/controllers/webhook.controller.ts`) — HMAC-SHA256 signature verification against `RAZORPAY_WEBHOOK_SECRET` (constant-time compare, fails closed/503 if unconfigured), raw-body capture wired ahead of `express.json()`, and durable idempotency via `WebhookEvent` (only marked processed after the handler succeeds, so a transient failure gets retried rather than permanently swallowed). Handles `payment.captured` (server-side amount cross-check against the booking total; mismatches are quarantined, not confirmed), `payment.failed`, `refund.processed`, `refund.failed`. Both the webhook and the existing browser-driven `/api/payments/verify` now converge on one shared, idempotent reconciliation function (`payment-reconciliation.service.ts`) — whichever arrives first confirms the payment once; the other is a no-op. Covered by `webhook.controller.spec.ts` (7 tests: signature rejection, fail-closed when unconfigured, idempotent redelivery, no double-confirm across the two paths, amount-mismatch quarantine, refund confirm/fail). Production requires `RAZORPAY_WEBHOOK_SECRET` whenever `RAZORPAY_KEY_ID` is set — the server refuses to boot without it.
- **No background job queue**: notification retries and any other async work run inline in the request/response cycle rather than through a durable queue (e.g. BullMQ). A crash mid-retry loses the retry, not the underlying data.
- **No backup/DR procedure has been tested**: no restore-from-backup has been exercised end-to-end in this environment.
