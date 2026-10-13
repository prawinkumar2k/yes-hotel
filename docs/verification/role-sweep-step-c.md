# Per-role sweep — step-c

Run 2026-10-13T06:30:49.109Z against http://localhost:8095. Matrix: `docs/rbac/after-n2.json`.

## API (GET routes)

| Role | 2xx | 403 expected | 400/404 (generic params) | Errors |
|---|---|---|---|---|
| RECEPTIONIST | 0 | 9 | 0 | 98 |
| CASHIER | 11 | 17 | 2 | 77 |
| HOUSEKEEPING | 26 | 74 | 5 | 2 |
| MAINTENANCE | 22 | 78 | 5 | 2 |
| SUPERVISOR | 44 | 50 | 11 | 2 |
| MANAGER | 79 | 9 | 17 | 2 |
| FINANCE | 43 | 53 | 9 | 2 |
| RESTAURANT | 22 | 78 | 5 | 2 |

API errors:

- RECEPTIONIST · GET /api/auth/me → ERR fetch failed
- RECEPTIONIST · GET /api/rooms/categories → ERR fetch failed
- RECEPTIONIST · GET /api/rooms/categories/:slug → ERR fetch failed
- RECEPTIONIST · GET /api/rooms → ERR fetch failed
- RECEPTIONIST · GET /api/bookings/availability → ERR fetch failed
- RECEPTIONIST · GET /api/bookings/my → ERR fetch failed
- RECEPTIONIST · GET /api/bookings/my/:id → ERR fetch failed
- RECEPTIONIST · GET /api/bookings/my/:id/invoice → ERR fetch failed
- RECEPTIONIST · GET /api/bookings/:id/checkout-preview → ERR fetch failed
- RECEPTIONIST · GET /api/admin/stats → ERR fetch failed
- RECEPTIONIST · GET /api/admin/reports/overview → ERR fetch failed
- RECEPTIONIST · GET /api/admin/bookings → ERR fetch failed
- RECEPTIONIST · GET /api/admin/bookings/:id → ERR fetch failed
- RECEPTIONIST · GET /api/admin/calendar → ERR fetch failed
- RECEPTIONIST · GET /api/admin/housekeeping → ERR fetch failed
- RECEPTIONIST · GET /api/admin/maintenance → ERR fetch failed
- RECEPTIONIST · GET /api/admin/contact-messages → ERR fetch failed
- RECEPTIONIST · GET /api/admin/booking-enquiries → ERR fetch failed
- RECEPTIONIST · GET /api/admin/booking-enquiries/:id → ERR fetch failed
- RECEPTIONIST · GET /api/admin/reviews → ERR fetch failed
- RECEPTIONIST · GET /api/admin/room-categories → ERR fetch failed
- RECEPTIONIST · GET /api/admin/room-categories/:id → ERR fetch failed
- RECEPTIONIST · GET /api/admin/pricing → ERR fetch failed
- RECEPTIONIST · GET /api/admin/master-data/floors → ERR fetch failed
- RECEPTIONIST · GET /api/admin/master-data/amenities → ERR fetch failed
- RECEPTIONIST · GET /api/admin/master-data/bed-types → ERR fetch failed
- RECEPTIONIST · GET /api/admin/master-data/room-views → ERR fetch failed
- RECEPTIONIST · GET /api/payments → ERR fetch failed
- RECEPTIONIST · GET /api/payments/detail/:id → ERR fetch failed
- RECEPTIONIST · GET /api/payments/:bookingId → ERR fetch failed
- RECEPTIONIST · GET /api/reviews → ERR fetch failed
- RECEPTIONIST · GET /api/reviews/my → ERR fetch failed
- RECEPTIONIST · GET /api/faqs → ERR fetch failed
- RECEPTIONIST · GET /api/testimonials → ERR fetch failed
- RECEPTIONIST · GET /api/content → ERR fetch failed
- RECEPTIONIST · GET /api/content/:key → ERR fetch failed
- RECEPTIONIST · GET /api/guests/my/profile → ERR fetch failed
- RECEPTIONIST · GET /api/guests → ERR fetch failed
- RECEPTIONIST · GET /api/refunds → ERR fetch failed
- RECEPTIONIST · GET /api/coupons → ERR fetch failed
- RECEPTIONIST · GET /api/staff → ERR fetch failed
- RECEPTIONIST · GET /api/gallery/public → ERR fetch failed
- RECEPTIONIST · GET /api/gallery → ERR fetch failed
- RECEPTIONIST · GET /api/settings/public → ERR fetch failed
- RECEPTIONIST · GET /api/settings → ERR fetch failed
- RECEPTIONIST · GET /api/public/settings → ERR fetch failed
- RECEPTIONIST · GET /api/public/gallery → ERR fetch failed
- RECEPTIONIST · GET /api/public/faqs → ERR fetch failed
- RECEPTIONIST · GET /api/public/testimonials → ERR fetch failed
- RECEPTIONIST · GET /api/public/content/:key → ERR fetch failed
- RECEPTIONIST · GET /api/public/rooms → ERR fetch failed
- RECEPTIONIST · GET /api/audit-logs → ERR fetch failed
- RECEPTIONIST · GET /api/room-rack → ERR fetch failed
- RECEPTIONIST · GET /api/room-rack/availability → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/summary → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/arrivals → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/departures → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/registration/guest-search → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/registration/available-rooms → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/registration/:bookingId/print → ERR fetch failed
- RECEPTIONIST · GET /api/front-desk/registration/report → ERR fetch failed
- RECEPTIONIST · GET /api/advances → ERR fetch failed
- RECEPTIONIST · GET /api/advances/summary/:bookingId → ERR fetch failed
- RECEPTIONIST · GET /api/folios/booking/:bookingId → ERR fetch failed
- RECEPTIONIST · GET /api/night-audit/status → ERR fetch failed
- RECEPTIONIST · GET /api/night-audit/preview → ERR fetch failed
- RECEPTIONIST · GET /api/cashier-shifts/cashiers → ERR fetch failed
- RECEPTIONIST · GET /api/cashier-shifts/current → ERR fetch failed
- RECEPTIONIST · GET /api/cashier-shifts → ERR fetch failed
- RECEPTIONIST · GET /api/cashier-shifts/:id/details → ERR fetch failed
- RECEPTIONIST · GET /api/rate-plans → ERR fetch failed
- RECEPTIONIST · GET /api/corporate-accounts → ERR fetch failed
- RECEPTIONIST · GET /api/corporate-accounts/:id → ERR fetch failed
- RECEPTIONIST · GET /api/group-bookings → ERR fetch failed
- RECEPTIONIST · GET /api/group-bookings/:id → ERR fetch failed
- RECEPTIONIST · GET /api/inspections/templates → ERR fetch failed
- RECEPTIONIST · GET /api/inspections/room/:roomId → ERR fetch failed
- RECEPTIONIST · GET /api/accounting/summary → ERR fetch failed
- RECEPTIONIST · GET /api/accounting/aging → ERR fetch failed
- RECEPTIONIST · GET /api/banquets → ERR fetch failed
- RECEPTIONIST · GET /api/ancillary → ERR fetch failed
- RECEPTIONIST · GET /api/complaints/my → ERR fetch failed
- RECEPTIONIST · GET /api/complaints → ERR fetch failed
- RECEPTIONIST · GET /api/properties → ERR fetch failed
- RECEPTIONIST · GET /api/properties/channels → ERR fetch failed
- RECEPTIONIST · GET /api/housekeeping/dashboard → ERR fetch failed
- RECEPTIONIST · GET /api/dashboard/command-center → ERR fetch failed
- RECEPTIONIST · GET /api/payment-channels → ERR fetch failed
- RECEPTIONIST · GET /api/payment-channels/:id → ERR fetch failed
- RECEPTIONIST · GET /api/task-approvals → ERR fetch failed
- RECEPTIONIST · GET /api/task-approvals/stats → ERR fetch failed
- RECEPTIONIST · GET /api/permissions/pages → ERR fetch failed
- RECEPTIONIST · GET /api/permissions/roles → ERR fetch failed
- RECEPTIONIST · GET /api/permissions/roles/:roleId/permissions → ERR fetch failed
- RECEPTIONIST · GET /api/permissions/users/:userId/overrides → ERR fetch failed
- RECEPTIONIST · GET /api/permissions/users/:userId/effective → ERR fetch failed
- RECEPTIONIST · GET /api/pos/orders → ERR fetch failed
- RECEPTIONIST · GET /api/menu → ERR fetch failed
- CASHIER · GET /api/auth/me → ERR fetch failed
- CASHIER · GET /api/rooms/categories → ERR fetch failed
- CASHIER · GET /api/rooms/categories/:slug → ERR fetch failed
- CASHIER · GET /api/rooms → ERR fetch failed
- CASHIER · GET /api/bookings/availability → ERR fetch failed
- CASHIER · GET /api/bookings/my → ERR fetch failed
- CASHIER · GET /api/bookings/my/:id → ERR fetch failed
- CASHIER · GET /api/bookings/my/:id/invoice → ERR fetch failed
- CASHIER · GET /api/bookings/:id/checkout-preview → ERR fetch failed
- CASHIER · GET /api/admin/stats → ERR fetch failed
- CASHIER · GET /api/admin/reports/overview → ERR fetch failed
- CASHIER · GET /api/admin/bookings → ERR fetch failed
- CASHIER · GET /api/admin/bookings/:id → ERR fetch failed
- CASHIER · GET /api/admin/calendar → ERR fetch failed
- CASHIER · GET /api/admin/housekeeping → ERR fetch failed
- CASHIER · GET /api/admin/maintenance → ERR fetch failed
- CASHIER · GET /api/admin/contact-messages → ERR fetch failed
- CASHIER · GET /api/admin/booking-enquiries → ERR fetch failed
- CASHIER · GET /api/admin/booking-enquiries/:id → ERR fetch failed
- CASHIER · GET /api/admin/reviews → ERR fetch failed
- CASHIER · GET /api/admin/room-categories → ERR fetch failed
- CASHIER · GET /api/admin/room-categories/:id → ERR fetch failed
- CASHIER · GET /api/admin/pricing → ERR fetch failed
- CASHIER · GET /api/admin/master-data/floors → ERR fetch failed
- CASHIER · GET /api/admin/master-data/amenities → ERR fetch failed
- CASHIER · GET /api/admin/master-data/bed-types → ERR fetch failed
- CASHIER · GET /api/admin/master-data/room-views → ERR fetch failed
- CASHIER · GET /api/payments → ERR fetch failed
- CASHIER · GET /api/payments/detail/:id → ERR fetch failed
- CASHIER · GET /api/guests/my/profile → 401 Unauthorized
- CASHIER · GET /api/public/settings → ERR fetch failed
- CASHIER · GET /api/public/gallery → ERR fetch failed
- CASHIER · GET /api/public/faqs → ERR fetch failed
- CASHIER · GET /api/public/testimonials → ERR fetch failed
- CASHIER · GET /api/public/content/:key → ERR fetch failed
- CASHIER · GET /api/public/rooms → ERR fetch failed
- CASHIER · GET /api/audit-logs → ERR fetch failed
- CASHIER · GET /api/room-rack → ERR fetch failed
- CASHIER · GET /api/room-rack/availability → ERR fetch failed
- CASHIER · GET /api/front-desk/summary → ERR fetch failed
- CASHIER · GET /api/front-desk/arrivals → ERR fetch failed
- CASHIER · GET /api/front-desk/departures → ERR fetch failed
- CASHIER · GET /api/front-desk/registration/guest-search → ERR fetch failed
- CASHIER · GET /api/front-desk/registration/available-rooms → ERR fetch failed
- CASHIER · GET /api/front-desk/registration/:bookingId/print → ERR fetch failed
- CASHIER · GET /api/front-desk/registration/report → ERR fetch failed
- CASHIER · GET /api/advances → ERR fetch failed
- CASHIER · GET /api/advances/summary/:bookingId → ERR fetch failed
- CASHIER · GET /api/folios/booking/:bookingId → ERR fetch failed
- CASHIER · GET /api/night-audit/status → ERR fetch failed
- CASHIER · GET /api/night-audit/preview → ERR fetch failed
- CASHIER · GET /api/night-audit/history → ERR fetch failed
- CASHIER · GET /api/reports/revenue-trend → ERR fetch failed
- CASHIER · GET /api/reports/department-pl → ERR fetch failed
- CASHIER · GET /api/reports/occupancy-heatmap → ERR fetch failed
- CASHIER · GET /api/reports/executive-summary → ERR fetch failed
- CASHIER · GET /api/reports/in-house-list → ERR fetch failed
- CASHIER · GET /api/reports/day-summary → ERR fetch failed
- CASHIER · GET /api/reports/monthly-mis → ERR fetch failed
- CASHIER · GET /api/reports/:reportId → ERR fetch failed
- CASHIER · GET /api/cashier-shifts/cashiers → ERR fetch failed
- CASHIER · GET /api/cashier-shifts/current → ERR fetch failed
- CASHIER · GET /api/cashier-shifts → ERR fetch failed
- CASHIER · GET /api/cashier-shifts/:id/details → ERR fetch failed
- CASHIER · GET /api/rate-plans → ERR fetch failed
- CASHIER · GET /api/corporate-accounts → ERR fetch failed
- CASHIER · GET /api/corporate-accounts/:id → ERR fetch failed
- CASHIER · GET /api/group-bookings → ERR fetch failed
- CASHIER · GET /api/group-bookings/:id → ERR fetch failed
- CASHIER · GET /api/inspections/templates → ERR fetch failed
- CASHIER · GET /api/inspections/room/:roomId → ERR fetch failed
- CASHIER · GET /api/accounting/summary → ERR fetch failed
- CASHIER · GET /api/accounting/aging → ERR fetch failed
- CASHIER · GET /api/banquets → ERR fetch failed
- CASHIER · GET /api/ancillary → ERR fetch failed
- CASHIER · GET /api/complaints/my → ERR fetch failed
- CASHIER · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- HOUSEKEEPING · GET /api/guests/my/profile → 401 Unauthorized
- HOUSEKEEPING · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- MAINTENANCE · GET /api/guests/my/profile → 401 Unauthorized
- MAINTENANCE · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- SUPERVISOR · GET /api/guests/my/profile → 401 Unauthorized
- SUPERVISOR · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- MANAGER · GET /api/guests/my/profile → 401 Unauthorized
- MANAGER · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- FINANCE · GET /api/guests/my/profile → 401 Unauthorized
- FINANCE · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- RESTAURANT · GET /api/guests/my/profile → 401 Unauthorized
- RESTAURANT · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user

## Pages

✅ loads with no failed API calls or console errors · 🔒 Access Denied (role lacks the page permission) · ❌ error (details below). A 403 on a sub-call that the permission map denies is noted but not counted as an error.

| Page | Key | RECEPTIONIST | CASHIER | HOUSEKEEPING | MAINTENANCE | SUPERVISOR | MANAGER | FINANCE | RESTAURANT |
|---|---|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | DASHBOARD.ADMIN | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | ✅ |
| `/admin/front-desk` | FRONT_DESK | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/guest-registration` | GUEST_REGISTRATION | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/room-rack` | ROOM_RACK | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/bookings` | BOOKINGS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/ota-bookings` | BOOKINGS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/bookings/:id` | BOOKINGS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/bookings/:id/folio-print` | BOOKINGS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/bookings/:id/grc-print` | BOOKINGS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/calendar` | CALENDAR | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/check-in` | CHECK_IN | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/check-out` | CHECK_OUT | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/master-data` | SETTINGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/master-data/amenities` | SETTINGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/master-data/floors` | SETTINGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/master-data/bed-types` | SETTINGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/master-data/room-views` | SETTINGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/rooms` | ROOMS | 🔒 | 🔒 | ✅ | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/room-categories` | ROOM_CATEGORIES | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/rate-plans` | RATE_PLANS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/pricing` | PRICING | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/guests` | GUESTS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/payments` | PAYMENTS | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/advances` | ADVANCES | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/cashier-shifts` | CASHIER_SHIFTS | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/refunds` | REFUNDS | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/coupons` | COUPONS | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/housekeeping` | HOUSEKEEPING | 🔒 | 🔒 | ✅ | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/task-approvals` | TASK_APPROVALS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | ✅ | 🔒 |
| `/admin/maintenance` | MAINTENANCE | 🔒 | 🔒 | 🔒 | ✅ | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/staff` | STAFF | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/gallery` | CONTENT_MANAGEMENT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/content` | CONTENT_MANAGEMENT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/faqs` | CONTENT_MANAGEMENT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/testimonials` | CONTENT_MANAGEMENT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/reviews` | REVIEWS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/contact-messages` | CONTACT_MESSAGES | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/complaints` | COMPLAINTS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/reports/*` | REPORTS_LAYOUT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/in-house-list` | IN_HOUSE_GUESTS | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/day-sales-summary` | REPORTS_LAYOUT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/monthly-mis` | REPORTS_LAYOUT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/enquiries` | ENQUIRIES | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/enquiries/:id` | ENQUIRIES | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/executive` | DASHBOARD.EXECUTIVE | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/multi-property` | MULTI_PROPERTY | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/night-audit` | NIGHT_AUDIT | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/staff/mobile-housekeeping` | HOUSEKEEPING | 🔒 | 🔒 | ✅ | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/settings` | SETTINGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/settings/payment-channels` | PAYMENT_CHANNELS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/audit-logs` | AUDIT_LOGS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/admin/corporate-accounts` | CORPORATE_ACCOUNTS | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 |
| `/admin/banquets` | BANQUETS | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/admin/pos` | RESTAURANT_POS | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | ✅ |
| `/admin/ancillary` | FRONT_DESK | ✅ | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/group-bookings` | GROUP_BOOKINGS | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/front-desk/dashboard` | DASHBOARD.FRONT_DESK | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/housekeeping/dashboard` | DASHBOARD.HOUSEKEEPING | 🔒 | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/maintenance/dashboard` | DASHBOARD.MAINTENANCE | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| `/cashier/dashboard` | DASHBOARD.CASHIER | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| `/finance/dashboard` | DASHBOARD.FINANCE | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 |
| `/events/dashboard` | BANQUETS | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| `/staff/housekeeping` | HOUSEKEEPING | 🔒 | 🔒 | ✅ | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| `/staff/maintenance` | MAINTENANCE | 🔒 | 🔒 | 🔒 | ✅ | ✅ | ✅ | 🔒 | 🔒 |

### Page errors and notes

- **RECEPTIONIST** `/admin/bookings/:id/folio-print` ✅: 403 GET /api/advances (permission map)
- **RECEPTIONIST** `/admin/bookings/:id/grc-print` ✅: 403 GET /api/advances (permission map)
- **RECEPTIONIST** `/admin/check-out` ✅: 403 GET /api/payment-channels (permission map)
- **RECEPTIONIST** `/admin/in-house-list` ✅: 403 GET /api/reports/in-house-list (permission map)
- **CASHIER** `/admin/advances` ✅: 403 GET /api/payment-channels (permission map)
- **HOUSEKEEPING** `/admin/rooms` ✅: 403 GET /api/admin/room-categories (permission map)
- **HOUSEKEEPING** `/admin/housekeeping` ✅: 403 GET /api/room-rack (permission map); 403 GET /api/staff (permission map)
- **MAINTENANCE** `/admin/maintenance` ✅: 403 GET /api/rooms (permission map)
- **SUPERVISOR** `/admin/bookings/:id/folio-print` ✅: 403 GET /api/advances (permission map)
- **SUPERVISOR** `/admin/bookings/:id/grc-print` ✅: 403 GET /api/advances (permission map)
- **SUPERVISOR** `/admin/calendar` ✅: 403 GET /api/advances (permission map)
- **SUPERVISOR** `/admin/check-out` ✅: 403 GET /api/payment-channels (permission map)
- **SUPERVISOR** `/admin/housekeeping` ✅: 403 GET /api/staff (permission map)
- **SUPERVISOR** `/admin/in-house-list` ✅: 403 GET /api/reports/in-house-list (permission map)
- **SUPERVISOR** `/admin/executive` ✅: 403 GET /api/reports/executive-summary (permission map); 403 GET /api/reports/revenue-trend (permission map); 403 GET /api/reports/department-pl (permission map); 403 GET /api/reports/occupancy-heatmap (permission map)
- **SUPERVISOR** `/admin/multi-property` 🔒: 403 GET /api/reports/occupancy-heatmap (permission map); 403 GET /api/reports/revenue-trend (permission map)
- **SUPERVISOR** `/staff/housekeeping` ✅: 403 GET /api/dashboard/command-center (permission map)
- **SUPERVISOR** `/staff/maintenance` ✅: 403 GET /api/dashboard/command-center (permission map)
- **FINANCE** `/admin/advances` ✅: 403 GET /api/payment-channels (permission map)
