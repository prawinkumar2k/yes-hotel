# YES HOTELS — Hotel Website & Management System

The booking website and hotel management system for **YES HOTELS**, Hosa Road Junction, Bengaluru — live at **https://yeshotels.in**.

| Document | For | What it covers |
|---|---|---|
| **README.md** (this file) | Developers | What the system does, code layout, local setup, tests |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Whoever runs the server | Server, Docker, SSL, releases, backups, rollback |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Hotel owner / Admin | Logins and passwords, rooms and rates, email, website content |
| [USER_FLOWS.md](USER_FLOWS.md) | Staff | Step-by-step workflows and the rules the system enforces |
| [CHANGELOG.md](CHANGELOG.md) | Everyone | What changed, release by release |

---

## What the system does

**Website (guests)**
- Rooms, gallery, about, contact, FAQ and policy pages; booking with live availability.
- Guest sign-in three ways: email + password, a **6-digit code emailed** to them, or **booking number + mobile**.
- Guest account: bookings and bills, pay the balance online, request date / guest changes, write reviews, profile.
- **Live chat**: a chat assistant answers common questions; "Talk to Reception" hands the chat to staff in real time.

**Hotel system (staff)** — four logins: Admin, Manager, Reception, Housekeeping.
- Front Desk: arrivals, departures, check-in / check-out, walk-in registration with registration card (GRC), extend stay, **room move**, **early departure**.
- Billing: folios (guest bills), payments, advances, refunds, cashier shifts, GST invoices (CGST + SGST), bill numbers issued only at checkout.
- Verification Queue: cleaned rooms (with photo), refunds, voids, cash variances checked by Reception.
- Housekeeping: rooms to clean, photo proof from the phone.
- Live Chat inbox, enquiries, OTA bookings (entered by hand), guest change requests.
- Reports: day sales, monthly MIS (incl. room-service sales), operations reports, night audit.
- Admin: staff and permissions, room types / rooms / rates, master data, website content, settings, audit log.

## Technology

| Part | Technology |
|---|---|
| Website and staff app | React 18, TypeScript, Vite, Tailwind CSS, React Query |
| Server | Node.js 22, Express 5 |
| Database | MongoDB 8 (**replica set required** — bookings and billing use transactions) |
| Real-time | Socket.IO (live chat, live counts) |
| Email | Nodemailer via Google Workspace (bookings@yeshotels.in) |
| Payments | Razorpay (optional; without keys, guests pay at Reception) |
| Tests | Vitest — unit and HTTP integration tests against a real MongoDB |
| Hosting | Docker Compose on a VPS behind nginx + Let's Encrypt SSL; GitHub Actions deploys on push |

## Code layout

```
client/            React app — public website, guest account, staff system
  pages/           one file per screen (admin/, staff/, customer/, public/, auth/, booking/)
  components/      shared UI (hotel/ = website, admin/ = staff layout, chatbot/ = website chat)
  lib/ hooks/      API client, auth storage, image resize, real-time hook
server/
  index.ts         Express app: security headers, rate limits, routes
  node-build.ts    production entry (serves the built website + API + Socket.IO)
  src/routes/      API routes (+ *.integration.spec.ts HTTP tests next to them)
  src/controllers/ request handlers
  src/services/    business rules: billing, tax, rooms, chat, customer, early departure, room move…
  src/models/      MongoDB (Mongoose) models
  src/config/      permissions (who can do what), JWT, allowed origins
  src/realtime/    Socket.IO (staff and guest channels)
shared/            code used by both sides: business dates (IST), hotel facts (hotel-info.ts)
public/            images, logo (brand/), icons, robots.txt
scripts/           maintenance scripts (backups, migrations, audits, master-password hash)
docs/              audit reports, policy page sources, RBAC notes
```

Key rules live in one place each:
- **Who can do what:** `server/src/config/permissions.ts`.
- **GST:** `server/src/services/tax.service.ts` (CGST 2.5% + SGST 2.5%; rooms above ₹7,500/night 18%).
- **Bills (folios):** `server/src/services/folio.service.ts` — lines are never deleted; corrections are reversals.
- **Hotel facts shown on the website:** `shared/hotel-info.ts`.

## Run it locally

Requirements: Node.js 20+, pnpm, and MongoDB running as a **replica set** (a single-node replica set is fine).

```bash
pnpm install
cp .env.example .env        # fill in MONGODB_URI, JWT_ACCESS_SECRET, …
pnpm dev                    # website + API on http://localhost:8080
```

`pnpm seed` loads demo data for **local development only**; it refuses to run in production.

## Checks before every commit

```bash
pnpm typecheck     # TypeScript, must be clean
pnpm test          # all tests; uses TEST_MONGODB_URI (never the live database)
pnpm build         # production build: dist/spa + dist/server
```

## Environment variables

Full list in `.env.example`. The important ones:

| Variable | Needed | Notes |
|---|---|---|
| `MONGODB_URI` | Yes | Replica-set URI. Don't add `directConnection=true`. |
| `JWT_ACCESS_SECRET` | Yes | Long random secret; production refuses to start without it. |
| `CLIENT_URL` | Yes | Public address, e.g. `https://yeshotels.in` (its `www.` twin is allowed automatically). |
| `COOKIE_SECURE` | Production | `true` behind HTTPS. |
| `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS` | For email | Google Workspace app password for bookings@yeshotels.in. Without them, sign-in codes can't be sent. |
| `MASTER_PASSWORD_HASH` | Optional | Owner's master password (hash only) — see docs/OPERATIONS.md. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | For online payment | All three together. |
| `RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX` | Optional | Defaults: 3,000 API calls and 10 failed logins per IP per 15 min. |

Secrets live only in `.env` files on each machine — never in the code or in git.

## Deployment

Pushing to `main` or `hardening/phase-1` deploys automatically to the server. Details, backups and rollback: [DEPLOYMENT.md](DEPLOYMENT.md).
