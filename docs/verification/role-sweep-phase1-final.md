# Per-role sweep — phase1-final

Run 2026-10-13T12:45:28.262Z against http://localhost:8096. Matrix: `docs/rbac/after-n2.json`.

## API (GET routes)

| Role | 2xx | 403 expected | 400/404 (generic params) | Errors |
|---|---|---|---|---|
| RECEPTIONIST | 39 | 55 | 11 | 2 |
| CASHIER | 29 | 68 | 8 | 2 |
| HOUSEKEEPING | 26 | 74 | 5 | 2 |
| MAINTENANCE | 22 | 78 | 5 | 2 |
| SUPERVISOR | 44 | 50 | 11 | 2 |
| MANAGER | 79 | 9 | 17 | 2 |
| FINANCE | 43 | 53 | 9 | 2 |
| RESTAURANT | 22 | 78 | 5 | 2 |

API errors:

- RECEPTIONIST · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- RECEPTIONIST · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- CASHIER · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- CASHIER · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- HOUSEKEEPING · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- HOUSEKEEPING · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- MAINTENANCE · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- MAINTENANCE · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- SUPERVISOR · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- SUPERVISOR · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- MANAGER · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- MANAGER · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- FINANCE · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- FINANCE · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- RESTAURANT · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- RESTAURANT · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user

## Pages

✅ loads with no failed API calls or console errors · 🔒 Access Denied (role lacks the page permission) · ❌ error (details below). A 403 on a sub-call that the permission map denies is noted but not counted as an error.

| Page | Key | RECEPTIONIST | CASHIER | HOUSEKEEPING | MAINTENANCE | SUPERVISOR | MANAGER | FINANCE | RESTAURANT |
|---|---|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | DASHBOARD.ADMIN | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
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

- **RECEPTIONIST** `/admin/front-desk` ✅: 403 GET /api/rooms (permission map)
- **RECEPTIONIST** `/admin/bookings/:id/folio-print` ✅: 403 GET /api/advances (permission map)
- **RECEPTIONIST** `/admin/bookings/:id/grc-print` ✅: 403 GET /api/advances (permission map)
- **RECEPTIONIST** `/admin/calendar` ✅: 403 GET /api/advances (permission map)
- **RECEPTIONIST** `/admin/check-out` ✅: 403 GET /api/payment-channels (permission map)
- **RECEPTIONIST** `/admin/in-house-list` ✅: 403 GET /api/reports/in-house-list (permission map)
- **CASHIER** `/admin/advances` ✅: 403 GET /api/payment-channels (permission map)
- **HOUSEKEEPING** `/admin/rooms` ✅: 403 GET /api/admin/room-categories (permission map)
- **HOUSEKEEPING** `/admin/housekeeping` ✅: 403 GET /api/room-rack (permission map); 403 GET /api/staff (permission map)
- **MAINTENANCE** `/admin/maintenance` ✅: 403 GET /api/rooms (permission map)
- **SUPERVISOR** `/admin/dashboard` ✅: 403 GET /api/dashboard/command-center (permission map)
- **SUPERVISOR** `/admin/bookings/:id/folio-print` ✅: 403 GET /api/advances (permission map)
- **SUPERVISOR** `/admin/bookings/:id/grc-print` ✅: 403 GET /api/advances (permission map)
- **SUPERVISOR** `/admin/calendar` ✅: 403 GET /api/advances (permission map)
- **SUPERVISOR** `/admin/check-out` ✅: 403 GET /api/payment-channels (permission map)
- **SUPERVISOR** `/admin/housekeeping` ✅: 403 GET /api/staff (permission map)
- **SUPERVISOR** `/admin/in-house-list` ✅: 403 GET /api/reports/in-house-list (permission map)
- **SUPERVISOR** `/admin/executive` ✅: 403 GET /api/reports/executive-summary (permission map); 403 GET /api/reports/revenue-trend (permission map); 403 GET /api/reports/department-pl (permission map); 403 GET /api/reports/occupancy-heatmap (permission map)
- **SUPERVISOR** `/staff/housekeeping` ✅: 403 GET /api/dashboard/command-center (permission map)
- **SUPERVISOR** `/staff/maintenance` ✅: 403 GET /api/dashboard/command-center (permission map)
- **FINANCE** `/admin/advances` ✅: 403 GET /api/payment-channels (permission map)
