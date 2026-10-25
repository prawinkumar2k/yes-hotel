# Handoff: deploy YES HOTELS PMS to the Hostinger VPS (Docker)

For the next coding agent. It covers where the work stands, what the owner asked for, what is already known about the server, and the remaining steps in order. Written 2026-10-14.

---

## 1. What the owner asked for

1. **Host the whole app on their Hostinger VPS, fully in Docker** ("dockerise everything and make it work properly").
2. **IP only for now** (testing). No domain yet. Serve on `http://187.127.217.225:<port>`.
3. **The hotel has 19 rooms.** Staff must be able to edit them in the app. Test everything end to end.
4. **Housekeeping login:** housekeepers should only see which rooms need cleaning, take a photo of the cleaned room, and upload it. Today there is no photo upload in housekeeping. This is a new feature.

Not answered by the owner: whether to deploy the **uncommitted working-tree changes** (see §3). The default is committed code only. Ask before including them.

## 2. Standing rules from the owner (keep following them)

- Before any data change, run `npm run db:backup` (writes `backups/<timestamp>/`).
- Stop and ask before:
  - any data migration;
  - deleting endpoints or pages;
  - anything that changes what a role can access.
- Commit locally, one commit per step. Push only when asked.
- The owner writes casually ("bro"). Reply in plain, short English.
- **Never write the VPS root password into any file, commit, script or log.** Ask the owner for it at run time. It was shared in chat, so recommend the owner change it after setup, and set up SSH key login only with the owner's explicit OK.

## 3. Code state

- Repo: `C:\Users\Hp\Downloads\yes-hotels-booking-b40`, branch `hardening/phase-1`.
- Last commit: `e51dfc7` (customer portal). Everything after `d46c37c` is local only, not pushed.
- Verified at `e51dfc7`:
  - `npx vitest run`: 45 files, 311 tests pass. Tests need MongoDB; `TEST_MONGODB_URI` defaults to `mongodb://localhost:27017/yes_hotels_test`.
  - `npx tsc --noEmit -p .`: clean.
  - `npm run build`: OK. Output is `dist/spa` (client) and `dist/server/node-build.mjs` (server).
- **Uncommitted changes NOT made by the previous agent.** Leave them alone unless the owner says otherwise:
  - `client/pages/staff/FrontDeskDashboard.tsx` (large rewrite)
  - `client/App.tsx`: wraps `/front-desk/dashboard` in AdminLayout
  - `client/components/admin/AdminLayout.tsx`: a Walk-In button in the header
  - `client/pages/admin/AdminBookings.tsx`, `AdminDashboard.tsx`, `AdminGuestRegistration.tsx`
  - untracked `scratch/*`
- Stack:
  - Express 5 + Mongoose 9 + React/Vite, Node 20+ (the bundle targets Node 22).
  - Start: `node dist/server/node-build.mjs`. It serves `dist/spa` and the API under `/api`.
  - Health: `GET /api/health` (process up), `GET /api/ready` (MongoDB connected).
- Read `DEPLOYMENT.md` (env vars, release checklist) and `USER_FLOWS.md` (what each role does).
- Logins after `npm run seed`:

  | Role | Email | Password |
  |---|---|---|
  | Admin | admin@yeshotels.com | Admin@123 |
  | Manager | manager@yeshotels.com | Manager@123 |
  | Reception | reception@yeshotels.com | Reception@123 |
  | Housekeeping | housekeeping@yeshotels.com | House@123 |

  Change these on a live server.

## 4. What is already on the VPS (inspected read-only; nothing was changed)

- Host: `187.127.217.225` (srv1878988.hstgr.cloud). Ubuntu 24.04, 8 GB RAM, 96 GB disk (24 GB used).
- SSH: user `root`, password login. Key login is **not** set up. `~/.ssh/hms_vps_key` on the owner's PC is not authorized on this server.
- Installed: Docker 29.7, Node 20.20, pnpm, pm2, nginx, certbot, ufw (active).
- **Other live sites share this server. Do not stop, change or reuse their ports or data:**

  | Site | How it runs | Ports |
  |---|---|---|
  | dealpost | pm2 | 3000 |
  | karikalam.in | nginx site in `/var/www/karikalam` | — |
  | suvaialaya | Docker: `suvaialaya-application` (app), `suvaialaya-db` (mongo:6.0), `suvaialaya-redis` | 8080, 27017, 6379 |

  - Nginx owns 80/443 and has sites `dealpost`, `karikalam.in` and `suvaialaya`.
  - ufw allows 22, 80, 443, 3000, 8080, 8081.
- **Security note for the owner (don't fix without asking):** suvaialaya's MongoDB (27017) and Redis (6379) are published on `0.0.0.0` by Docker, which bypasses ufw. They may be reachable from the internet.

## 5. Blockers to fix in code before an HTTP-only (IP) deployment

1. **Refresh cookie.** `server/src/controllers/auth.controller.ts`, `setRefreshCookie`:
   - `secure: process.env.NODE_ENV === "production"` means the browser drops the cookie over plain HTTP, so sessions don't survive a refresh.
   - Fix: add an env override such as `COOKIE_SECURE=false`. Default it to secure in production, and document it in `DEPLOYMENT.md` and `.env.example`.
2. **CSP.** `server/index.ts`, around line 173, sets `upgradeInsecureRequests` in production, which forces browsers onto https and breaks the IP site.
   - Fix: make it conditional on the same "served over HTTPS" setting.
3. Check for any other `https`-only assumption, such as HSTS in the helmet config or `CLIENT_URL` checks. Set `CLIENT_URL=http://187.127.217.225:<port>`.
4. Required env vars:
   - `NODE_ENV=production`
   - `MONGODB_URI` (a replica set, see §6)
   - `CLIENT_URL`
   - `JWT_ACCESS_SECRET`: long random; the server refuses to start without it.
   - `PORT`
   - Razorpay, Cloudinary and email are **not** configured. That's fine for testing: online payment shows "pay at Reception", and the demo payment is disabled in production.
   - If `RAZORPAY_KEY_*` is set, `RAZORPAY_WEBHOOK_SECRET` is required, or boot fails.

## 6. Docker plan

- **MongoDB must be a replica set.** The app uses multi-document transactions; a standalone `mongod` fails. Use a single-node replica set:
  - container `yeshotels-db`, image `mongo:8`, `--replSet rs0`, with a one-shot `rs.initiate()` (healthcheck or init container);
  - a named volume for data;
  - **no published port**, or `127.0.0.1` only. Don't repeat the suvaialaya exposure.
  - URI: `mongodb://yeshotels-db:27017/yes_hotels?replicaSet=rs0`. Don't add `directConnection=true`.
- **App container** `yeshotels-app`:
  - multi-stage Dockerfile: build with pnpm (`pnpm install --frozen-lockfile`, `pnpm build`), then run `node dist/server/node-build.mjs` on `node:22-slim`;
  - publish one free port, e.g. **3100** (`0.0.0.0:3100:3100`), and open it in ufw: `ufw allow 3100/tcp`;
  - a volume for uploaded files if local uploads are used (see §7).
- **Compose project name `yeshotels`**, in its own folder, e.g. `/opt/yeshotels`. Use a `.env` there; never commit it.
- Add a `.dockerignore`: `node_modules`, `dist`, `backups`, `test-results`, `scratch`, `.env*`, `*.pdf`, `*.xlsx`, `data/` if large.
- **Getting code to the server.** Local commits are not on GitHub. Either push with the owner's OK and clone on the server, or `git archive e51dfc7` into a tarball and `scp` it.
- Later, with a domain: an nginx server block that proxies to `127.0.0.1:3100`, then certbot, then switch the cookie and CSP back to secure.

## 7. Feature work requested

### 7a. 19 rooms, editable

- `npm run seed` creates more rooms than 19 (the seed lists ~27; check `server/src/scripts/seed.ts` around line 240).
- Ask the owner for the real room numbers and categories. If they don't have them yet, seed exactly 19 placeholder rooms.
- Confirm that Admin/Manager can **create, edit and disable rooms** and categories in the admin UI (`/admin/rooms` and its categories page). Test edit + save end to end.
- Seed against the **Docker** database, never the owner's local dev DB. On a fresh database no backup is needed, but take one before any later reseed.

### 7b. Housekeeping: "see rooms to clean, take photo, upload"

- No photo upload exists in housekeeping today. Look at:
  - `server/src/routes/housekeeping.routes.ts`, `server/src/models/Housekeeping*`
  - `transitionHousekeepingStatus` (CLEANING_COMPLETED queues a ROOM_RELEASE verification for Reception)
  - the housekeeping dashboard page (`/housekeeping/dashboard`)
- Suggested design:
  - **Server:** an endpoint to attach 1–N photos to the housekeeping task when marking it cleaned, required for "Cleaning completed".
    - Store with multer to a Docker volume (`/app/uploads`, served read-only under `/uploads` behind auth), or to Cloudinary if keys are added later.
    - Limit size (e.g. 5 MB) and type (jpeg/png/webp).
  - **Client (mobile first):**
    - a list of rooms assigned or dirty;
    - a "Take photo" input (`<input type="file" accept="image/*" capture="environment">`);
    - upload, then "Mark cleaned".
  - **Reception:** the Verification Queue item for that room shows the photos, so they verify against them.
  - **Housekeeping sees nothing else.** Check the HOUSEKEEPING grants in `server/src/config/permissions.ts` and the sidebar.
    - Removing any access is an access change: **list what will change and ask the owner first.**
- Add HTTP integration tests next to `server/src/routes/reception-workflow.integration.spec.ts`. That spec's setup is a good template.

## 8. Order of work

1. Ask the owner:
   - whether to include the uncommitted changes from §3;
   - the real 19 room numbers and categories;
   - for the root password, given at run time only.
2. Fix the HTTP blockers (§5) behind env flags. Run tests and commit.
3. Build the housekeeping photo feature (§7b) and its tests. Ask about any access removal first. Commit.
4. Add `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.example` entries and a `DEPLOYMENT.md` Docker section. Run it locally with Docker Desktop: replica set up, `/api/ready` returns 200, logins work over http. Commit.
5. Deploy to `/opt/yeshotels`. Bring up the stack, seed 19 rooms, and open port 3100 in ufw. Touch nothing else on the server.
6. Smoke test on `http://187.127.217.225:3100`:
   - every role logs in;
   - edit a room;
   - booking → check-in → charges → payment → checkout;
   - housekeeping photo → Reception verifies;
   - the customer "Booking no. + mobile" sign-in;
   - `npx tsx scripts/audit/consistency-check.ts --base=http://187.127.217.225:3100` reports 5/5.
7. Report the actual results. Remind the owner to change the root password and the default staff passwords, and mention the exposed suvaialaya Mongo/Redis.

## 9. Gotchas from earlier work

- Windows + Git Bash:
  - Apostrophes inside `node -e '…'` break the shell, and heredocs and `node -e` strip backslashes (`\d` and friends).
  - Write scripts or files with an editor tool instead, and use function replacers in `String.replace`.
- Files mix CRLF and LF. Detect the line ending before string-replacing.
- The Vite dev server (`:8080` locally) restarts on server edits. Use a production build for sweeps.
- When committing, stage only your own hunks. The working tree contains someone else's edits (§3).
