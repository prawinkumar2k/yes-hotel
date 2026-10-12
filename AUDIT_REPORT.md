# YES HOTELS PMS — Audit Report

**Phase 0 (recon and wiring audit):** completed 12 Oct 2026. **No application code has been changed yet.**

- **Method:** static mapping of `client/App.tsx` → page → API call → `server/index.ts` mount → route file → controller/service → model, plus a read-only live probe.
- **The probe:** about 120 GET requests against the running dev server (`:8080`) and the dev replica set (`:27027`), logged in as ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING and CASHIER. No writes were issued.
- **Baseline:** `vitest` passes 20 files / 107 tests. `tsc` reports **1 error**, in `AdminFolioPrint.tsx:212` (see P0-07).

Legend for the matrix: ✅ works · ⚠️ works but has a defect · ❌ broken · 🕳️ no backend / not wired · 🔁 duplicated calculation logic.

---

## 1. Critical wiring defects found in Phase 0

These are the defects that make pages fail or roles unusable outright, ranked by blast radius.

| ID | Defect | Evidence | Root cause |
|---|---|---|---|
| P0-01 | **Every non-admin staff role is locked out of property-scoped APIs.** | RECEPTIONIST, HOUSEKEEPING and CASHIER get `400 "Property context is required"` on `/front-desk/summary`, `/housekeeping/dashboard`, `/admin/housekeeping`, `/cashier-shifts/current`, `/reports/day-summary` and every other route behind `requirePropertyAccess`. | The seeded staff users have no `propertyId` / `propertyIds`. `propertyAuth.ts:48` rejects instead of resolving the default property. |
| P0-02 | **SUPER_ADMIN cannot log in.** | `superadmin@yeshotels.com` → 401. | `scripts/seedUsers.ts` writes a `password` field, but the User model and auth flow use `passwordHash`. CASHIER/FINANCE/EVENTS users from the same script happened to work only because they also exist via another path. **To verify in Phase 1.** |
| P0-03 | **`authorize()` has no SUPER_ADMIN bypass, and several routes omit roles.** | `/settings`, `/staff`, `/gallery` and `/payment-channels` allow only `ADMIN, MANAGER`. `/group-bookings` allows `ADMIN, MANAGER, RECEPTIONIST`. `/dashboard/command-center` omits `SUPERVISOR` and `SUPER_ADMIN`. | Two parallel RBAC systems: role lists via `authorize(...)` and the page-permission matrix via `requirePermission(...)`. They disagree. This is a likely cause of "Property Settings loads empty" for SUPER_ADMIN. |
| P0-04 | **Restaurant & POS: "Failed to load orders".** | `/api/pos/orders` and `/api/menu` return **200 `text/html`** (the SPA index), so the client's `res.json()` throws. | `pos.routes.ts`, `menu.routes.ts` and `ota.routes.ts` exist but are **never mounted** in `server/index.ts`. |
| P0-05 | **Unknown `/api/*` paths return 200 HTML instead of 404.** | As above. Any typo'd or unmounted endpoint looks "successful" at the HTTP level. | There is no `/api` 404 handler before the SPA fallback. This hides wiring bugs across the app. |
| P0-06 | **The Housekeeping staff dashboard cannot update tasks.** | `HousekeepingDashboard.tsx:109` sends `PATCH /api/housekeeping/:id`. | That route does not exist. The real routes are `PATCH /api/admin/housekeeping/:id` (task) and `PATCH /api/housekeeping/rooms/:id/status` (room). |
| P0-07 | **The Folio / GST invoice print page crashes.** | `AdminFolioPrint.tsx:212` references undefined `creditLines`, causing a ReferenceError on render. This is the only `tsc` error. | A half-finished refactor in the uncommitted working tree. The same file also falls back to a fake invoice no. `BILL-2026-000001` and room `"101"`. |
| P0-08 | **Night Audit status returns 500.** | `GET /night-audit/status` → `BusinessDate validation failed: propertyId required`. `/night-audit/preview` → 400 "No active business date". History is empty. | The business-date document is auto-created without `propertyId`, and the seed creates none. The night audit has never run on this DB. |
| P0-09 | **The Cashier report returns 500.** | `GET /reports/cashier` → `Cannot populate path 'user'`. | The controller populates `user`, but the CashierShift schema uses a different field name. |
| P0-10 | **The Mobile Housekeeping board sees only 1 of 19 rooms.** | `GET /housekeeping/dashboard` → `rooms[1]` (room 101 only). | The filter is too narrow (it appears to return only rooms whose `housekeepingStatus = DIRTY`). **To confirm in Phase 1.** |
| P0-11 | **Master Data pages are empty, and checkout payment methods are empty.** | `/admin/master-data/{floors,amenities,bed-types,room-views}`, `/admin/pricing` and `/payment-channels` all return `[]`. | These collections are not seeded. Checkout and advance forms read their method list from `/payment-channels`, so it is empty. |
| P0-12 | **Folio APIs have no permission check.** | `folio.routes.ts` uses only `protect`. Any authenticated user (including HOUSEKEEPING) can read a folio, post charges, delete lines, settle and finalize. Verified: HOUSEKEEPING → 200 on `/folios/booking/:id`. | `requirePermission` is missing on every folio route. |
| P0-13 | **The In-House report returns duplicate rows.** | `/reports/in-house-list` → 4 rows (two blank-reference "prawin kumar" rows). Everywhere else reports 2 in-house guests. | Unknown. **To trace in Phase 1.** |
| P0-14 | **Dead links in Master Data Hub.** | `AdminMasterData.tsx` links to `/admin/master-data/buildings` and `/admin/master-data/properties`. | No such routes exist in `App.tsx`, so the catch-all redirects to the public homepage. |
| P0-15 | **Orphan page.** | `AdminMenu.tsx` (menu CRUD) has no route in `App.tsx`. | It is unreachable. Its backend is also unmounted (P0-04). |
| P0-16 | **Frontend page keys disagree with backend permission keys.** | POS page `FRONT_DESK` vs API `RESTAURANT_POS`. Pricing `PRICING` vs `ROOM_CATEGORIES`. Reviews `REVIEWS` and Contact `CONTACT_MESSAGES` vs `COMPLAINTS`. Check-in `CHECK_IN` vs `BOOKINGS`. In-house `IN_HOUSE_GUESTS`, Day Sales `DAY_SALES_SUMMARY` and MIS `MONTHLY_MIS` vs `REPORTS_LAYOUT`. | A user can be shown a page whose API returns 403, or the reverse. |
| P0-17 | **Rate limiting is disabled.** | All `app.use(...Limiter)` lines in `server/index.ts` are commented out, including login, password reset and payment verify. | Commented out during testing. |

---

## 2. Live cross-module disagreement (same fact, same moment, different answers)

Captured from the running app on business date 12 Oct 2026. This is the core "single source of truth" problem.

| Fact | `/dashboard/command-center` | `/admin/stats` | `/front-desk/summary` | `/reports/day-summary` | Other |
|---|---|---|---|---|---|
| Occupied rooms | **1** (`hotelPulse.occupied`) | 2 | — | 2 | `/rooms`: 2 (102, 201) |
| Occupancy % | 5 % | — | — | — | Reports page: 11 % |
| Available rooms | **18** | 15 | — | — | `/room-rack/availability`: 17 · `/front-desk/registration/available-rooms`: 14 |
| Dirty rooms | **1** (`hotelPulse`) **and 3** (`housekeeping`), within the same response | — | 2 | — | |
| Departures today | 1 | **3** | 1 | — | `actualCheckouts`: 2 |
| Monthly revenue | ₹3,73,325 | **₹10,08,875** | — | — | Reports MTD: ₹62,245 |
| Today's revenue | ₹0 | ₹0 | — | — | A ₹1,050 cash payment was posted at 02:06 IST |
| ADR / RevPAR | ₹0 / ₹0 | — | — | — | Executive summary: computed from "in-house revenue / in-house count" |
| In-house guests | 2 | — | 2 | — | `/reports/in-house-list`: 4 rows (P0-13) |

**Room record vs HK task (live):**
- **The `Room.status` field is overloaded.** It holds `CLEANING` and `OCCUPIED` alongside separate `occupancyStatus`, `housekeepingStatus` and `sellStatus` fields.
- **Room 401** has `housekeepingStatus = "ASSIGNED"`, which is a task status leaking into room state. It also has three concurrent HK tasks (ASSIGNED, CLEAN and CLEANING).
- **Rooms 201–206 and 301–304** show `housekeepingStatus = CLEAN` on the Room document, while their tasks are ASSIGNED, CLEANING, DIRTY, INSPECTION or CLEANING_COMPLETED.
- **Room 201** has an ASSIGNED stay-over task while occupied. **Room 204** is SELLABLE (Phase 1 J: open critical ticket).

---

## 3. Duplicated calculation logic (🔁) — where each number is computed today

| Metric | Implementations found | Notes |
|---|---|---|
| Occupancy / occupied / available | `commandCenter.controller.ts:62`, `reports.controller.ts:399`, `:441`, `:720`, `admin.controller.ts`, `front-desk.controller.ts`, `room-rack.controller.ts`, `walk-in-registration.controller.ts`, `bookingEnquiry.controller.ts:417` | At least 9 independent queries. `room-state.service.ts` exists, but Dashboard, Reports and Front Desk don't use it. |
| Dirty rooms | `commandCenter.controller.ts:152` (counts **tasks**), the `hotelPulse` block (counts **rooms**), `front-desk.controller.ts:151` | Tasks and rooms are counted interchangeably. |
| Revenue (today / month) | `commandCenter.controller.ts:124-141`, `admin.controller.ts:23-52`, `reports.controller.ts:82`, `:181`, `:440` | Some sum payments (collections) and some sum folio charges. "Monthly" on the dashboard is effectively the all-time total. |
| ADR / RevPAR | `commandCenter.controller.ts:140-141` (today's *payments* / occupied), `reports.controller.ts:82`, `:181-182`, `:446-447` | Four different definitions. |
| Nights | **About 25 sites**: `booking.controller.ts` (×4), `walk-in-registration.controller.ts` (×5), `folio.controller.ts`, `group-booking.controller.ts`, `bookingEnquiry.controller.ts` (×3), `reports.controller.ts:581` (`Math.round`), plus client `differenceInDays` in BookingDetails, FolioPrint, GRCPrint, BulkDocViewer, CustomerBookingDetails and FrontDesk | `differenceInDays` and the ms/86400000 diff are 24-hour diffs, not calendar-date diffs. Check-in 12 Oct 14:00 → check-out 14 Oct 11:00 = 1.875 days, shown as **"1 Night"** (YES-BKG-3010). |
| GST rate | `pricing.service.ts:78` (18/12 at ₹7,500), `booking.controller.ts:1104,1164` (18/12), `night-audit.controller.ts:128,331` (**9/6**, half rates), `ancillary.controller.ts:40` (flat 18), `PaymentPage.tsx:52` (client-side flat 18), seeds (9 % and 5 %) | Five different rules. None matches the current slabs (5 % ≤ ₹7,500, 18 % above; to verify in Phase 1). The client computes tax itself. |
| Day bucketing | About 29 `setHours(0,0,0,0)` / `toISOString().split("T")` sites across admin, booking, bookingEnquiry, commandCenter, frontDesk, nightAudit and reports controllers | These use server-local or UTC midnight, not Asia/Kolkata, which causes the ₹0 "Today's Revenue" (Phase 1 B). The client calendar also sends `toISOString()` ranges. |

---

## 4. Connectivity matrix — admin and staff pages

Columns: Page (route) → API calls → backend mount / route file → controller (service) → model(s) → live status.

### Dashboards
| Page | API calls | Route file → controller | Models | Status |
|---|---|---|---|---|
| Admin Dashboard `/admin/dashboard` | GET `/dashboard/command-center` | command-center.routes → commandCenter.controller (inline aggregates) | Room, Booking, HousekeepingTask, Payment, Folio(Line), CashierShift, MaintenanceTicket, RestaurantOrder, AdvancePayment, TaskApproval, AuditLog | ⚠️ 🔁 200, but numbers are wrong (§2). Booking sources show Direct only. The trend chart includes future dates. |
| AdminLayout (badges) | GET `/admin/booking-enquiries?status=NEW`, `/front-desk/summary` | admin.routes, front-desk.routes | BookingEnquiry, Booking, Room | ⚠️ 400 for non-admin roles (P0-01) |
| CommandPalette | GET `/admin/bookings?search=`, `/guests?search=` | admin.routes → admin.controller, guest.routes → guest.controller | Booking, Guest | ✅ |
| NotificationCenter | GET `/front-desk/summary` | front-desk.routes | — | ⚠️ P0-01 |
| Executive `/admin/executive` | GET `/reports/revenue-trend`, `/reports/department-pl`, `/reports/occupancy-heatmap`, `/reports/executive-summary` | reports.routes → reports.controller | Booking, FolioLine, Payment, Room | ⚠️ 🔁 200. Separate ADR/RevPAR definitions. |
| Front Desk Dashboard `/front-desk/dashboard` | GET `/dashboard/command-center`, `/front-desk/summary` | as above | — | ⚠️ P0-01, P0-03 |
| Housekeeping Dashboard `/housekeeping/dashboard` | GET `/dashboard/command-center`; PATCH `/housekeeping/:id` | command-center; **no route** | HousekeepingTask | ❌ PATCH 404 (P0-06) |
| Maintenance Dashboard | GET `/dashboard/command-center`; PATCH `/admin/maintenance/:id` | command-center, admin.routes → maintenance.controller | MaintenanceTicket | ⚠️ P0-01 for MAINTENANCE role |
| Cashier Dashboard | GET `/cashier-shifts/current`, `/dashboard/command-center` | cashier-shift.routes → cashier-shift.controller | CashierShift | ⚠️ P0-01 |
| Finance Dashboard | GET `/dashboard/command-center`, `/reports/executive-summary` | — | — | ⚠️ 🔁 |
| Restaurant Dashboard (no route in App.tsx) | GET `/dashboard/command-center`; PATCH `/pos/orders/:id/status` | **pos.routes unmounted** | RestaurantOrder | 🕳️ unreachable page; PATCH → HTML |

### Front office
| Page | API calls | Route file → controller | Models | Status |
|---|---|---|---|---|
| Front Desk `/admin/front-desk` | GET `/front-desk/summary`, `/rooms`; GET `/bookings/:id/checkout-preview`; POST `/bookings/:id/check-in`, `/check-out`, `/extension-check`, `/extend`; POST `/room-rack/:id/assign-booking`; POST `/folios/:id/charges`; DELETE `/folios/:id/lines/:lineId`; PUT `/folios/booking/:id/bill-edit` | front-desk.routes, room.routes, booking.routes → booking.controller (booking-state, room-state, folio services), room-rack.routes, folio.routes → folio.controller | Booking, Room, Folio, FolioLine, Payment, AdvancePayment, HousekeepingTask, AuditLog | ⚠️ 🔁 Dirty count 2 vs 3. Check-in into non-clean rooms is not blocked. DELETE folio line has no RBAC (P0-12). The client recomputes nights. |
| Guest Registration (walk-in) `/admin/guest-registration` | GET `/front-desk/registration/guest-search`, `/available-rooms`; POST `/calculate-rate`, `/walk-in`, `/:id/check-in` | walk-in-registration.routes → walk-in-registration.controller | Guest, Booking, Room, Folio, Payment, AdvancePayment | ⚠️ 🔁 Available 14 vs 18/17/15. Own nights and tax logic. Source of the WALKIN folio defect (Phase 1 C). |
| Room Rack `/admin/room-rack` | GET `/room-rack?…`, `/folios/booking/:id`; POST `/room-rack/:id/manual-release`, `/sell-status` | room-rack.routes → room-rack.controller (room-state.service) | Room, Booking, HousekeepingTask | ⚠️ 🔁 |
| Check-In `/admin/check-in` | GET `/admin/bookings?status=CONFIRMED`, `/rooms`; POST `/bookings/:id/check-in` | admin.routes, booking.routes | Booking, Room | ⚠️ No CLEAN-room guard. Page key mismatch (P0-16). |
| Check-Out `/admin/check-out` | GET `/admin/bookings?status=CHECKED_IN`, `/payment-channels`, `/bookings/:id/checkout-preview`; POST `/bookings/:id/check-out` | booking.routes → booking.controller → folio.service | Booking, Folio, FolioLine, Payment, AdvancePayment, Refund | ❌ The payment-method list is empty (P0-11). Overpayment is allowed, refunds are posted as CREDIT, and folios settle at non-zero balances (Phase 1 C). |
| In-House List `/admin/in-house-list` | GET `/reports/in-house-list?date=` | reports.routes → reports.controller | Booking, Guest, Room | ⚠️ Duplicate rows (P0-13) |
| Calendar `/admin/calendar` | GET `/admin/calendar?start=ISO&end=ISO` | admin.routes → admin.controller.getAdminCalendar | Room, Booking | ⚠️ 🔁 Uses a different query from the Bookings list (Phase 1 F), with UTC ISO range params. |
| Bookings `/admin/bookings` | GET `/admin/bookings?…` | admin.routes → admin.controller.getAdminBookings | Booking | ⚠️ Excludes some bookings that the calendar shows (YES-BKG-4003). |
| Booking Details `/admin/bookings/:id` | GET `/admin/bookings/:id`, `/folios/booking/:id`; PATCH `/admin/bookings/:id/status`; POST `/bookings/:id/cancel`, `/folios/:id/charges` | admin.routes, booking.routes, folio.routes | Booking, Folio, FolioLine | ⚠️ PATCH status bypasses the state machine. Client nights use `differenceInDays`. |
| Folio Print `/admin/bookings/:id/folio-print` | GET `/admin/bookings/:id`, `/advances?bookingId=`, `/folios/booking/:id` | admin, advance, folio routes | Booking, AdvancePayment, Folio | ❌ ReferenceError crash (P0-07). Fake invoice-number fallback. |
| GRC Print `/admin/bookings/:id/grc-print` | GET `/admin/bookings/:id`, `/admin/bookings?limit=50`, `/advances?bookingId=` | — | — | ⚠️ client nights |
| OTA Bookings `/admin/ota-bookings` | GET `/admin/bookings?source=…` | admin.routes | Booking | ⚠️ No commission or net-payable fields. Channex webhook (`ota.routes`) unmounted. Seed booking dates are after the stays. |
| Enquiries `/admin/enquiries` and `/:id` | GET/POST/DELETE `/admin/booking-enquiries`; GET `/:id`; PATCH `/:id/status`; POST `/:id/follow-up`, `/:id/convert` | admin.routes → bookingEnquiry.controller | BookingEnquiry, Booking, RoomCategory | ⚠️ Room type stored as free text ("Deluxe Twin Room" etc.) rather than a category ref. Convert exists (quality to verify). |
| Group Bookings `/admin/group-bookings` | GET/POST `/group-bookings`; PATCH `/:id/status`, `/:id/advance` | group-booking.routes → group-booking.controller | GroupBooking, Booking | ⚠️ P0-03 (no SUPER_ADMIN or SUPERVISOR). No rooming list, pickup or release. |
| Banquets `/admin/banquets`, `/events/dashboard` | GET/POST `/banquets`; PATCH `/:id/status` | banquet.routes → banquet.controller | BanquetBooking | ✅ (basic CRUD) |
| Corporate Accounts | GET/POST `/corporate-accounts` (+ `/:id`, `check-credit`) | corporate-account.routes | CorporateAccount | ✅ |
| Complaints | GET `/complaints`; PATCH `/:id/status` | complaint.routes | Complaint | ✅ |
| Ancillary | GET/POST `/ancillary` | ancillary.routes | AncillaryService | ⚠️ Flat 18 % hardcoded |

### Housekeeping and maintenance
| Page | API calls | Route file → controller | Models | Status |
|---|---|---|---|---|
| Housekeeping `/admin/housekeeping` | GET `/admin/housekeeping`, `/room-rack`, `/staff?role=HOUSEKEEPING`; PATCH `/admin/housekeeping/:id` | admin.routes → housekeeping.controller (room-state.service); staff.routes | HousekeepingTask, Room, User | ⚠️ 🔁 Multiple active tasks per room. Task status written into `Room.housekeepingStatus`. Wrong category label. `/staff` is 403 for SUPERVISOR. Room 201 shown VACANT while in-house. |
| Mobile Housekeeping `/staff/mobile-housekeeping` | GET `/housekeeping/dashboard`; PATCH `/housekeeping/rooms/:id/status` | housekeeping.routes → housekeeping.controller | Room | ❌ Returns 1 of 19 rooms (P0-10). 400 for the HOUSEKEEPING role (P0-01). |
| Task Approvals | GET/POST `/task-approvals`, `/stats`, `/:id/approve`, `/:id/reject` | task-approval.routes | TaskApproval | ✅ (empty) |
| Inspections (no page; used by HK flows) | `/inspections/templates`, `/submit`, `/release`, `/room/:id` | inspection.routes | Inspection, Room | ✅ endpoints respond |
| Maintenance `/admin/maintenance` | GET/POST `/admin/maintenance`, `/rooms`; PATCH `/admin/maintenance/:id` | admin.routes → maintenance.controller (room-state.service) | MaintenanceTicket, Room | ⚠️ A CRITICAL ticket does not set the room OOO. No status-transition guard ("Approve & Complete" shows on OPEN tickets). |
| Rooms `/admin/rooms` | GET/POST/PATCH/DELETE `/rooms`; GET `/admin/room-categories` | room.routes → room.controller | Room, RoomCategory | ⚠️ 🔁 Shows `Room.housekeepingStatus`, which disagrees with tasks |

### Finance
| Page | API calls | Route file → controller | Models | Status |
|---|---|---|---|---|
| Payments `/admin/payments` | GET `/payments?page=`, `/payments/detail/:id` | payment.routes → payment.controller | Payment | ⚠️ Mixed `TXN-` / `pay_` IDs. Gateway reference not separate. |
| Advances `/admin/advances` | GET/POST `/advances`, `/payment-channels`; POST `/advances/:id/refund` (also `/:id/adjust`, `/summary/:bookingId`) | advance.routes (inline handlers) → advance.service | AdvancePayment, AdvanceAdjustment, Booking | ⚠️ Advances are mostly "Unallocated". No reconciliation. Business logic is inline in the route file. |
| Cashier Shifts `/admin/cashier-shifts` | GET `/cashier-shifts`, `/cashiers`, `/current`, `/:id/details`; POST `/open`, `/:id/paid-out`, `/:id/handover/initiate`, `/confirm`, `/:id/close` | cashier-shift.routes → cashier-shift.controller | CashierShift, Payment, Refund | ⚠️ Two open shifts on DRAWER-01. Expected cash is computed in multiple places. Refunds are not deducted. Postings are allowed after handover. |
| Refunds `/admin/refunds` | GET `/refunds`; POST `/refunds/initiate` | refund.routes → refund.controller | Refund, Payment, Folio | ⚠️ |
| Coupons `/admin/coupons` | GET/POST/PATCH/DELETE `/coupons`; public POST `/coupons/validate` | coupon.routes → coupon.service | Coupon | ✅ CRUD (redemption limits to verify) |
| Night Audit `/admin/night-audit` | GET `/night-audit/status`, `/preview`, `/history`; POST `/run` | night-audit.routes → night-audit.controller | BusinessDate, Booking, FolioLine | ❌ 500 / 400 (P0-08). Tax at 9 %/6 % (half rates). |
| Payment Channels `/admin/settings/payment-channels` | GET/POST/PATCH `/payment-channels` | payment-channel.routes | PaymentChannel | ⚠️ Empty collection (P0-11). P0-03. |
| Accounting (page deleted in working tree) | `/accounting/summary`, `/aging` | accounting.routes → accounting.controller | FolioLine, CorporateAccount | 🕳️ backend only |
| Restaurant & POS `/admin/pos` | GET `/menu`, `/pos/orders`; PATCH `/pos/orders/:id/status` | **pos.routes and menu.routes not mounted** | RestaurantOrder, MenuItem | ❌ P0-04 |
| Menu (no route) | `/menu` CRUD | menu.routes (unmounted) | MenuItem | 🕳️ P0-15 |

### Reports
| Page | API calls | Route file → controller | Status |
|---|---|---|---|
| Reports → Analytics `/admin/reports` | GET `/reports/:reportId` (17 IDs) | reports.routes → reports.controller.getDynamicReport | ⚠️ `cashier` → 500 (P0-09). bookings, sales, payments, tax, advances, guest-bills, restaurant and maintenance all return `table[0]` for 1–12 Oct, even though payments exist (likely date-field or UTC filtering). |
| Day Summary (tab and page) | GET `/reports/day-summary?date=` | reports.controller.getDaySummary | ⚠️ 🔁 |
| Cash Sheet | GET `/reports/cash-sheet?date=` | getDynamicReport | ⚠️ Empty on a day with a ₹1,050 cash payment (UTC bucketing) |
| Monthly MIS (tab and page) | GET `/reports/monthly-mis?month=` | getMonthlyMIS | ⚠️ 🔁 |
| Day Sales Summary `/admin/day-sales-summary` | GET `/reports/day-summary` | getDaySummary | ⚠️ |
| Bulk Docs | GET `/admin/bookings?…` | admin.controller | ⚠️ client nights |
| AdminReports.tsx (legacy) | GET `/admin/reports/overview` | reports.controller.getReportsOverview | 🕳️ Not routed (replaced by ReportsLayout). The endpoint still serves a 4th revenue definition. |

### Master data, settings and admin
| Page | API calls | Route file → controller | Status |
|---|---|---|---|
| Settings `/admin/settings` | GET/PATCH `/settings` | settings.routes → settings.controller | ⚠️ 200 for ADMIN with data present. Reported "empty" (likely P0-03 for SUPER_ADMIN, or a response-shape mismatch; to verify in Phase 1). Only a single HotelSettings doc; no tax-slab config. |
| Master Data Hub | (links only) | — | ⚠️ Dead links (P0-14) |
| Floors / Amenities / Bed Types / Room Views | `/admin/master-data/*` CRUD | admin.routes → master-data.controller | ⚠️ All empty (P0-11) |
| Room Categories | `/admin/room-categories` CRUD | roomCategory.controller | ✅ 4 categories |
| Rate Plans | GET/POST `/rate-plans` | rate-plan.controller | ✅ 5 plans |
| Pricing | `/admin/pricing` CRUD | pricing.controller | ⚠️ Empty. Page key mismatch. |
| Guests `/admin/guests` | GET/POST/PATCH `/guests`, `/:id`, `/:id/block` | guest.controller | ⚠️ Spend calculation and walk-in placeholder emails to verify |
| Staff `/admin/staff` | GET/POST/PATCH `/staff`, `/:id/reset-password` | staff.controller | ⚠️ P0-03 |
| Roles (AccessMatrix) | GET `/permissions/pages`, `/roles`, `/roles/:id/permissions`; PUT | permission.routes → PermissionController | ✅ |
| Audit Logs | GET `/audit-logs?…` | auditLog.controller | ⚠️ No export. Contains no-op entries. Before/after, IP and UA to verify. |
| Multi-Property / Channels | `/properties`, `/properties/channels` CRUD and sync | property.controller | ✅ (sync is likely a stub) |
| Content / FAQs / Testimonials / Gallery / Reviews / Contact Messages | respective CRUD | content, faq, testimonial, gallery, review, contact controllers | ✅ (gallery has P0-03) |

### Public and customer site (summary)
`/public/*` (settings, rooms, faqs, testimonials, gallery) ✅ · `/public/content/hero` 404 (no seed) · `/bookings/availability` ✅ · `/booking-enquiry` POST (not probed, write) · `/payments/create-order` + `/verify` + `/webhooks/razorpay` (not probed, write) · customer `/bookings/my*`, `/guests/my/profile`, `/reviews/my`, `/complaints/my` (not probed; need the customer token).

---

## 5. Backend endpoints with no frontend consumer

`/admin/stats` (it still returns a third revenue number) · `/admin/reports/overview` · `/front-desk/arrivals` and `/departures` (summary is used instead) · `/advances/:id/adjust` (no UI button) · `/advances/summary/:bookingId` · `/inspections/*` (no page) · `/accounting/*` (page deleted) · `/corporate-accounts/:id/check-credit` · `/rate-plans/evaluate-rate` · `/front-desk/registration/report` · `/room-rack/availability` · `/permissions/users/:id/overrides` and `/effective` · `/folios/:id/reconcile`, `/finalize`, `/settle` (to verify; called from the checkout flow server-side?) · `/api/demo`, `/api/ping` (starter template leftovers).

---

## 6. Other observations to carry into Phase 1 and 2

- **Uncommitted working tree.** It holds about 198 modified/deleted files (Inventory, Procurement and Accounting pages deleted, plus many edits) on top of `6e2562c`. I'm treating the working tree as the baseline. **Recommend committing or branching it before Phase 1** so every fix lands as a reviewable diff.
- **Stale audit docs from earlier passes.** The root contains prior reports and scripts (`PAGE_TO_API_DATABASE_MAPPING.md`, `FULL_APPLICATION_DATA_INTEGRITY_AUDIT.md`, `matrix_*.json`, `scan_matrix.cjs`, etc.). Several of their conclusions contradict the live probe (e.g. "zero mocks", all pages wired). This report supersedes them. I'll propose moving them to `docs/archive/` instead of deleting.
- **Response shapes are inconsistent.** Most endpoints use `{success, data}`. `/complaints` and `/permissions/*` return raw arrays. propertyAuth errors return `{message}` with no `success` field.
- **Money is stored as floats (rupees) throughout.** The paise migration is Phase 2.
- **Express 5 + Mongoose 9 + a replica set are already in place,** so transactions are feasible without infra changes.
- **Existing tests (107) are green** but did not catch any of P0-01…P0-17. There's no cross-module consistency test and no route-mount test.

---

## 7. Issue log (filled in as phases progress)

| ID | Issue | Root cause | Fix | Test |
|---|---|---|---|---|
| P0-01 … P0-17 | see §1 | see §1 | *pending: Phase 1* | *pending* |
