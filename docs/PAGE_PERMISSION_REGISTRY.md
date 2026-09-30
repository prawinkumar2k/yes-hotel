# Page Permission Registry

This registry maps every frontend route in the Yes Hotels application to a database-driven PageResource record.

## Authentication & Public (Not dynamically permissioned)
- `/` - Public Home
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/rooms`, `/search`, `/booking/*` (Guest facing)
- Legal and Content pages

## Customer Portal (Role-bound, typically not granularly configured by Super Admin)
- `/customer/dashboard`
- `/customer/bookings`
- `/customer/profile`
- `/customer/payments`
- `/customer/reviews`
- `/customer/requests`
- `/customer/loyalty`

## Administration & Staff Modules (Dynamically Permissioned)

### DASHBOARDS
- `DASHBOARD.ADMIN` - `/admin/dashboard`
- `DASHBOARD.EXECUTIVE` - `/admin/executive`
- `DASHBOARD.FRONT_DESK` - `/front-desk/dashboard`
- `DASHBOARD.HOUSEKEEPING` - `/housekeeping/dashboard`
- `DASHBOARD.MAINTENANCE` - `/maintenance/dashboard`
- `DASHBOARD.CASHIER` - `/cashier/dashboard`
- `DASHBOARD.RESTAURANT` - `/restaurant/dashboard`
- `DASHBOARD.FINANCE` - `/finance/dashboard`

### FRONT OFFICE
- `FRONT_DESK` - `/admin/front-desk`
- `GUEST_REGISTRATION` - `/admin/guest-registration`
- `ROOM_RACK` - `/admin/room-rack`
- `BOOKINGS` - `/admin/bookings`, `/admin/bookings/:id`
- `CHECK_IN` - `/admin/check-in`
- `CHECK_OUT` - `/admin/check-out`
- `IN_HOUSE_GUESTS` - `/admin/in-house-list`
- `GUESTS` - `/admin/guests`
- `CALENDAR` - `/admin/calendar`
- `ENQUIRIES` - `/admin/enquiries`

### ROOM MANAGEMENT
- `ROOMS` - `/admin/rooms`
- `ROOM_CATEGORIES` - `/admin/room-categories`
- `HOUSEKEEPING` - `/admin/housekeeping`, `/staff/mobile-housekeeping`
- `MAINTENANCE` - `/admin/maintenance`

### FINANCE & BILLING
- `PAYMENTS` - `/admin/payments`
- `ADVANCES` - `/admin/advances`
- `REFUNDS` - `/admin/refunds`
- `CASHIER_SHIFTS` - `/admin/cashier-shifts`
- `NIGHT_AUDIT` - `/admin/night-audit`
- `ACCOUNTING` - `/admin/accounting`

### REVENUE & PRICING
- `RATE_PLANS` - `/admin/rate-plans`
- `PRICING` - `/admin/pricing`
- `COUPONS` - `/admin/coupons`

### RESTAURANT & POS
- `RESTAURANT_POS` - `/admin/pos`
- `MENU_MANAGEMENT` - `/admin/menu`

### INVENTORY & PROCUREMENT
- `INVENTORY` - `/admin/inventory`
- `VENDORS` - `/admin/vendors`
- `PROCUREMENT` - `/admin/procurement`

### CORPORATE & EVENTS
- `CORPORATE_ACCOUNTS` - `/admin/corporate-accounts`
- `GROUP_BOOKINGS` - `/admin/group-bookings`
- `BANQUETS` - `/admin/banquets`, `/events/dashboard`

### REPORTS & ANALYTICS
- `REPORTS_LAYOUT` - `/admin/reports/*`
- `DAY_SALES_SUMMARY` - `/admin/day-sales-summary`
- `MONTHLY_MIS` - `/admin/monthly-mis`

### CRM & FEEDBACK
- `COMPLAINTS` - `/admin/complaints`
- `REVIEWS` - `/admin/reviews`
- `CONTACT_MESSAGES` - `/admin/contact-messages`

### SYSTEM ADMINISTRATION
- `STAFF` - `/admin/staff`
- `MULTI_PROPERTY` - `/admin/multi-property`
- `TASK_APPROVALS` - `/admin/task-approvals`
- `SETTINGS` - `/admin/settings`
- `PAYMENT_CHANNELS` - `/admin/settings/payment-channels`
- `AUDIT_LOGS` - `/admin/audit-logs`
- `CONTENT_MANAGEMENT` - `/admin/content`, `/admin/faqs`, `/admin/testimonials`, `/admin/gallery`
