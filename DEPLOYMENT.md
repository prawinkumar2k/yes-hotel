# YES HOTELS PMS — Deployment

For the person deploying and operating the app. It covers what the server needs, how to build and start it, the checks to run before and after a release, and the data changes that are still waiting for approval.

---

## 1. Requirements

| Component | Requirement | Why |
|---|---|---|
| Node.js | 20 or newer (the server bundle targets Node 22) | `package.json` `engines` |
| MongoDB | **Replica set** (a single-node replica set is fine), 6.0 or newer; developed against 8.2 | Bookings, check-in/out, folios, payments, shifts, POS settlement, enquiry conversion and group blocks all use multi-document transactions. A standalone `mongod` fails these with "Transaction numbers are only allowed on a replica set member" |
| Reverse proxy | TLS termination, one hop | The app sets `trust proxy = 1`, so rate limits and audit-log IPs use the client IP from the first proxy |

## 2. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `MONGODB_URI` | yes | Replica-set URI, e.g. `mongodb://db1:27017,db2:27017,db3:27017/yes_hotels?replicaSet=rs0`. **Don't add `directConnection=true`**: it breaks transactions |
| `CLIENT_URL` | yes | The public origin (CORS and links), e.g. `https://pms.example.com` |
| `JWT_ACCESS_SECRET` | yes | A long random secret; the server refuses to start in production without it |
| `PORT` | no | Default `3000` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for online payments | — |
| `RAZORPAY_WEBHOOK_SECRET` | yes, if Razorpay is set | Boot fails without it (webhooks would otherwise fail closed silently) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | for gallery uploads | — |
| `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS` | for email notifications | — |
| `BOOKING_ENQUIRY_RECIPIENTS` | optional | Comma-separated addresses notified of website enquiries |
| `RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_REFRESH_MAX` | optional | Per IP per 15 minutes. Production defaults: 300 / 10 / 60. Keep the defaults unless a load test says otherwise |

The server validates these at boot and exits with a clear message when a required one is missing.

## 3. Build and start

```bash
pnpm install --frozen-lockfile
pnpm typecheck          # must be clean
pnpm test               # runs against TEST_MONGODB_URI (never the live database)
pnpm build              # dist/spa (client) + dist/server (server bundle)
NODE_ENV=production node dist/server/node-build.mjs
```

The server serves the built client from `dist/spa` and the API under `/api`.

- `GET /api/health`: the process is up.
- `GET /api/ready`: MongoDB is connected. Use this for the load balancer's readiness check.

The production bundle was verified on 2026-10-13 by building it and running the full per-role page sweep against it (`docs/verification/role-sweep-phase1-final.md`).

## 4. Database

- **Indexes.** The models declare them, and Mongoose builds them at startup. The ones correctness depends on:
  - `roomnights` unique (`room`, `date`): no double booking of a room-night
  - `bookinginventorydays` unique (`roomCategory`, `stayDate`): the category sell limit
  - `cashiershifts`: `one_active_shift_per_drawer` and `one_active_shift_per_cashier`
  - `counters`: gapless invoice, advance, shift, KOT and transaction numbers

  After the first start, confirm they exist with `db.<collection>.getIndexes()`.
- **Audit log.** The app never updates or deletes `auditlogs`. In production, also give the app's database user **insert and find only** on that collection, so it is append-only at the database level too.
- **Backups.** `pnpm db:backup` writes `backups/<timestamp>/` (mongodump). `pnpm db:restore -- backups/<timestamp> --yes` **drops and replaces** every backed-up collection of the database named in `MONGODB_URI`; without `--yes` it refuses. Take a backup before every release and before any migration.

## 5. Pending data changes (dry runs done; each needs approval)

Nothing below has been applied. Every script defaults to a dry run and writes its report to `docs/`.

| Change | Report | Script |
|---|---|---|
| Reverse 52 fabricated "Advance Payment Received" folio lines (with matching real Payments) | `docs/repair/folio-unbacked-credits.md` | `scripts/repair/folio-unbacked-credits-report.mjs` |
| Business dates stored as date-only strings | `docs/migrations/business-date-dry-run.md` | `scripts/migrations/2026-10-13-business-date-strings.mjs` |
| Money to paise | `docs/migrations/money-to-paise-dry-run.md` | `scripts/migrations/2026-10-13-money-to-paise.mjs` |
| Rewrite stored folio totals from the ledger (2 folios; the balances are already ₹0 under the ledger) | `docs/repair/folio-ledger-report.md` | `scripts/repair/folio-ledger-report.ts` |
| Advance mismatches (4 seeded advances with no folio lines, 1 folio line with no applied advance) | `docs/repair/advance-reconciliation.md` | `scripts/repair/advance-reconciliation-report.ts` |
| Room 204: open CRITICAL ticket, room still on sale | `docs/consistency/data-integrity.md` | `syncRoomSellStatusWithTickets` |
| Reseed demo data (chronology, OTA terms) | `docs/consistency/data-integrity.md` | `pnpm seed` on a fresh database |

## 6. Release checklist

1. `pnpm db:backup` and confirm the backup directory is complete.
2. `pnpm typecheck && pnpm test && pnpm build`.
3. Deploy, then wait for `/api/ready` to return 200.
4. Smoke checks:
   - Log in as each role.
   - Open the Dashboard, Front Desk, Folio, Cashier Shifts and POS.
   - Run `npx tsx scripts/audit/consistency-check.ts --base=<url>`; it must report 5/5.
5. Watch the logs for 5xx and `Failed to write audit log` for the first hour.

## 7. Rollback

Redeploy the previous build. If a migration ran, stop the app and run `pnpm db:restore -- <backup from step 1> --yes`; this replaces the current data with the backup, so anything written since then is lost. Then start the previous build.
