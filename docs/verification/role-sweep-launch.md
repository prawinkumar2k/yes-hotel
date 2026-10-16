# Per-role sweep — launch

Run 2026-10-16T05:47:13.655Z against http://localhost:8090. Matrix: `docs/rbac/current.json`.

## API (GET routes)

| Role | 2xx | 403 expected | 400/404 (generic params) | Errors |
|---|---|---|---|---|
| ADMIN | 100 | 0 | 23 | 2 |
| MANAGER | 91 | 10 | 22 | 2 |
| RECEPTIONIST | 66 | 37 | 20 | 2 |
| HOUSEKEEPING | 27 | 89 | 7 | 2 |

API errors:

- ADMIN · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- ADMIN · GET /api/permissions/users/:userId/effective → 401 User session expired or user not found. Please log in again.
- MANAGER · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- MANAGER · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- RECEPTIONIST · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- RECEPTIONIST · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user
- HOUSEKEEPING · GET /api/guests/my/profile → 403 Guest profiles are available to guest accounts only
- HOUSEKEEPING · GET /api/permissions/users/:userId/effective → 403 Forbidden: Cannot fetch permissions for another user

## Pages

✅ loads with no failed API calls or console errors · 🔒 Access Denied (role lacks the page permission) · ❌ error (details below). A 403 on a sub-call that the permission map denies is noted but not counted as an error.

| Page | Key | ADMIN | MANAGER | RECEPTIONIST | HOUSEKEEPING |
|---|---|---|---|---|---|
| `/admin/dashboard` | DASHBOARD.ADMIN | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/front-desk` | FRONT_DESK | ✅ | ✅ | ✅ | 🔒 |
| `/admin/guest-registration` | GUEST_REGISTRATION | ✅ | ✅ | ✅ | 🔒 |
| `/admin/room-rack` | ROOM_RACK | ✅ | ✅ | ✅ | 🔒 |
| `/admin/bookings` | BOOKINGS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/ota-bookings` | BOOKINGS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/bookings/:id` | BOOKINGS | ❌ | ❌ | ❌ | 🔒 |
| `/admin/bookings/:id/folio-print` | BOOKINGS | ❌ | ❌ | ❌ | 🔒 |
| `/admin/bookings/:id/grc-print` | BOOKINGS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/calendar` | CALENDAR | ✅ | ✅ | ✅ | 🔒 |
| `/admin/check-in` | CHECK_IN | ✅ | ✅ | ✅ | 🔒 |
| `/admin/check-out` | CHECK_OUT | ✅ | ✅ | ✅ | 🔒 |
| `/admin/master-data` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/master-data/amenities` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/master-data/floors` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/master-data/bed-types` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/master-data/room-views` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/rooms` | ROOMS | ✅ | ✅ | 🔒 | ✅ |
| `/admin/room-categories` | ROOM_CATEGORIES | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/rate-plans` | RATE_PLANS | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/pricing` | PRICING | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/guests` | GUESTS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/payments` | PAYMENTS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/advances` | ADVANCES | ✅ | ✅ | ✅ | 🔒 |
| `/admin/verifications` | VERIFICATIONS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/change-requests` | BOOKINGS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/live-chat` | ENQUIRIES | ✅ | ✅ | ✅ | 🔒 |
| `/admin/billing` | CASHIER_DESK | ✅ | ✅ | ✅ | 🔒 |
| `/admin/payments/:id/receipt` | PAYMENTS | ❌ | ❌ | ❌ | 🔒 |
| `/admin/advances/:id/receipt` | ADVANCES | ❌ | ❌ | ❌ | 🔒 |
| `/admin/cashier-shifts` | CASHIER_SHIFTS | ❌ | ❌ | ❌ | 🔒 |
| `/admin/refunds` | REFUNDS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/coupons` | COUPONS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/housekeeping` | HOUSEKEEPING | ✅ | ✅ | 🔒 | ✅ |
| `/admin/task-approvals` | TASK_APPROVALS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/maintenance` | MAINTENANCE | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/staff` | STAFF | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/gallery` | CONTENT_MANAGEMENT | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/content` | CONTENT_MANAGEMENT | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/faqs` | CONTENT_MANAGEMENT | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/testimonials` | CONTENT_MANAGEMENT | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/reviews` | REVIEWS | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/contact-messages` | CONTACT_MESSAGES | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/complaints` | COMPLAINTS | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/reports/*` | REPORTS_LAYOUT | ✅ | ✅ | ✅ | 🔒 |
| `/admin/in-house-list` | IN_HOUSE_GUESTS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/day-sales-summary` | REPORTS_LAYOUT | ✅ | ✅ | ✅ | 🔒 |
| `/admin/monthly-mis` | REPORTS_LAYOUT | ✅ | ✅ | ✅ | 🔒 |
| `/admin/enquiries` | ENQUIRIES | ✅ | ✅ | ✅ | 🔒 |
| `/admin/enquiries/:id` | ENQUIRIES | ❌ | ❌ | ❌ | 🔒 |
| `/admin/executive` | DASHBOARD.EXECUTIVE | ✅ | ❌ | 🔒 | 🔒 |
| `/admin/multi-property` | MULTI_PROPERTY | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/night-audit` | NIGHT_AUDIT | ✅ | ✅ | 🔒 | 🔒 |
| `/staff/mobile-housekeeping` | HOUSEKEEPING | ✅ | ✅ | 🔒 | ✅ |
| `/admin/seo` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/settings` | SETTINGS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/settings/payment-channels` | PAYMENT_CHANNELS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/audit-logs` | AUDIT_LOGS | ✅ | 🔒 | 🔒 | 🔒 |
| `/admin/corporate-accounts` | CORPORATE_ACCOUNTS | ✅ | ✅ | 🔒 | 🔒 |
| `/admin/banquets` | BANQUETS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/pos` | RESTAURANT_POS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/menu` | RESTAURANT_POS | ✅ | ✅ | ✅ | 🔒 |
| `/admin/ancillary` | FRONT_DESK | ✅ | ✅ | ✅ | 🔒 |
| `/admin/group-bookings` | GROUP_BOOKINGS | ✅ | ✅ | ✅ | 🔒 |
| `/front-desk/dashboard` | DASHBOARD.FRONT_DESK | ✅ | 🔒 | ✅ | 🔒 |
| `/housekeeping/dashboard` | DASHBOARD.HOUSEKEEPING | ✅ | 🔒 | 🔒 | ✅ |
| `/maintenance/dashboard` | DASHBOARD.MAINTENANCE | ✅ | ✅ | 🔒 | 🔒 |
| `/cashier/dashboard` | DASHBOARD.CASHIER | ✅ | ✅ | ✅ | 🔒 |
| `/finance/dashboard` | DASHBOARD.FINANCE | ✅ | ✅ | 🔒 | 🔒 |
| `/events/dashboard` | BANQUETS | ✅ | ✅ | ✅ | 🔒 |
| `/staff/housekeeping` | HOUSEKEEPING | ✅ | ✅ | 🔒 | ✅ |
| `/staff/maintenance` | MAINTENANCE | ✅ | ✅ | 🔒 | 🔒 |

### Page errors and notes

- **ADMIN** `/admin/bookings/:id` ❌: 404 GET /api/folios/booking/6ad1b48df9fe95614a9c3e6b
- **ADMIN** `/admin/bookings/:id/folio-print` ❌: 404 GET /api/folios/booking/6ad1b48df9fe95614a9c3e6b
- **ADMIN** `/admin/payments/:id/receipt` ❌: 404 GET /api/reception/payments/6ad1b48df9fe95614a9c3e6b/receipt
- **ADMIN** `/admin/advances/:id/receipt` ❌: 404 GET /api/advances/6ad1b48df9fe95614a9c3e6b/receipt
- **ADMIN** `/admin/cashier-shifts` ❌: 404 GET /api/advances/6ad1b48df9fe95614a9c3e6b/receipt
- **ADMIN** `/admin/enquiries/:id` ❌: 500 GET /api/admin/booking-enquiries/undefined
- **MANAGER** `/admin/bookings/:id` ❌: 404 GET /api/folios/booking/6ad1b48df9fe95614a9c3e6b
- **MANAGER** `/admin/bookings/:id/folio-print` ❌: 404 GET /api/folios/booking/6ad1b48df9fe95614a9c3e6b
- **MANAGER** `/admin/payments/:id/receipt` ❌: 404 GET /api/reception/payments/6ad1b48df9fe95614a9c3e6b/receipt
- **MANAGER** `/admin/advances/:id/receipt` ❌: 404 GET /api/reception/payments/6ad1b48df9fe95614a9c3e6b/receipt; 404 GET /api/advances/6ad1b48df9fe95614a9c3e6b/receipt
- **MANAGER** `/admin/cashier-shifts` ❌: 404 GET /api/advances/6ad1b48df9fe95614a9c3e6b/receipt
- **MANAGER** `/admin/enquiries/:id` ❌: 500 GET /api/admin/booking-enquiries/undefined
- **MANAGER** `/admin/executive` ❌: 500 GET /api/admin/booking-enquiries/undefined
- **RECEPTIONIST** `/admin/bookings/:id` ❌: 404 GET /api/folios/booking/6ad1b48df9fe95614a9c3e6b
- **RECEPTIONIST** `/admin/bookings/:id/folio-print` ❌: 404 GET /api/folios/booking/6ad1b48df9fe95614a9c3e6b
- **RECEPTIONIST** `/admin/payments/:id/receipt` ❌: 404 GET /api/reception/payments/6ad1b48df9fe95614a9c3e6b/receipt
- **RECEPTIONIST** `/admin/advances/:id/receipt` ❌: 404 GET /api/advances/6ad1b48df9fe95614a9c3e6b/receipt
- **RECEPTIONIST** `/admin/cashier-shifts` ❌: 404 GET /api/advances/6ad1b48df9fe95614a9c3e6b/receipt
- **RECEPTIONIST** `/admin/enquiries/:id` ❌: 500 GET /api/admin/booking-enquiries/undefined
- **RECEPTIONIST** `/admin/executive` 🔒: 500 GET /api/admin/booking-enquiries/undefined
