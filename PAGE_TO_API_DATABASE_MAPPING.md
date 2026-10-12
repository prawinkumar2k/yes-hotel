# YES HOTELS — PAGE TO API & DATABASE MAPPING

Comprehensive matrix mapping frontend operational pages to backend API endpoints, authoritative database models, data operations, cross-module links, and verification status.

---

## 1. Core Front Desk, Reservations & Guest Operations

| Page / Route | UI Components | API Endpoint | Database Source | Read Operations | Write Operations | Related Modules | Permissions | Verification Status |
|---|---|---|---|---|---|---|---|---|
| **Front Desk**<br>`/admin/front-desk` | Today's arrivals/departures, in-house room cards, quick check-in modal, quick walk-in dialog | `GET /api/bookings`<br>`GET /api/rooms`<br>`POST /api/bookings/check-in` | `Booking`<br>`Room`<br>`Guest`<br>`Folio` | Filter bookings by business date & status; populate guest, room, roomType | Update booking status (`CHECKED_IN`), set room to `OCCUPIED`, initialize folio | Room Rack, In-House List, Housekeeping, Guest Directory | `frontdesk:read`<br>`frontdesk:write` | **Verified** |
| **Room Rack**<br>`/admin/room-rack` | Interactive room grid, floor filters, status toggles, room inspector modal | `GET /api/rooms/status-matrix`<br>`PATCH /api/rooms/:id/status` | `Room`<br>`Booking`<br>`HousekeepingTask` | Aggregates room physical status, active occupancy, cleaning status | Transition room state (`CLEAN`, `DIRTY`, `INSPECTED`, `OOO`) | Front Desk, Housekeeping, Maintenance | `frontdesk:read`<br>`housekeeping:write` | **Verified** |
| **All Bookings**<br>`/admin/bookings` | Searchable booking table, date range picker, status pills, booking drawer | `GET /api/bookings`<br>`POST /api/bookings`<br>`PATCH /api/bookings/:id` | `Booking`<br>`Guest`<br>`RoomType`<br>`Payment` | Paginated query, text search on guest name/phone/ref, status filter | Create booking, edit dates, cancel, assign room | Front Desk, Folio, Room Rack, Reports | `booking:read`<br>`booking:write` | **Verified** |
| **Booking Enquiries**<br>`/admin/enquiries` | Lead table, quote generator, convert-to-booking dialog | `GET /api/booking-enquiries`<br>`POST /api/booking-enquiries/:id/convert` | `BookingEnquiry`<br>`Booking`<br>`Guest` | Query leads by date and conversion status | Update enquiry status (`CONVERTED`), atomic booking creation | Bookings, Guest Directory, Email notifications | `enquiry:read`<br>`enquiry:write` | **Verified** |
| **Guest Directory**<br>`/admin/guests` | Searchable guest directory, stay history cards, direct GRC/GST action links | `GET /api/guests`<br>`GET /api/guests/:id`<br>`POST /api/guests` | `Guest`<br>`Booking`<br>`Folio` | Text search, auto-sync from bookings, populate stay history | Create guest, update ID details, GSTIN, notes | Bookings, Front Desk, Bulk Print | `guest:read`<br>`guest:write` | **Verified** |
| **In-House Guest List**<br>`/admin/reports/in-house-list` | Filterable guest register table, date navigator, quick action links (GRC, GST, Folio) | `GET /api/reports/in-house-list` | `Booking`<br>`Room`<br>`Guest`<br>`FolioLine` | Query active stays (`CHECKED_IN`) + departures (`CHECKED_OUT`) for date | Read-only register view | Front Desk, Cashier, GST Invoice | `reports:read` | **Verified** |

---

## 2. Billing, Cashier & Financial Modules

| Page / Route | UI Components | API Endpoint | Database Source | Read Operations | Write Operations | Related Modules | Permissions | Verification Status |
|---|---|---|---|---|---|---|---|---|
| **Guest Folio & Billing**<br>`/admin/folio/:id` | Folio charge lines table, add room charge/F&B/tax dialog, payment modal | `GET /api/folios/:id`<br>`POST /api/folios/:id/lines`<br>`POST /api/folios/:id/settle` | `Folio`<br>`FolioLine`<br>`Payment`<br>`AdvancePayment` | Full folio line breakdown, subtotal, tax calculation, balance calculation | Post charge line, apply discount, record payment, close folio | Front Desk, Cashier, Daily Summary | `folio:read`<br>`folio:write` | **Verified** |
| **Folio / GST Print**<br>`/admin/folio-print/:id` | Formal GST Tax Invoice printable format, SAC breakdown, CGST/SGST lines, payment breakdown | `GET /api/folios/:id/print`<br>`GET /api/hotels/current` | `Folio`<br>`FolioLine`<br>`Booking`<br>`HotelSetting` | Distinct genuine advance lines from checkout settlement lines | Print view trigger | In-House List, Front Desk, Reports | `folio:read` | **Verified** |
| **Bulk GRC & GST Viewer**<br>`/admin/reports/bulk-docs` | Unified viewer for GRC & GST Invoices, sequential pagination, single-click bulk print | `GET /api/reports/bulk-docs`<br>`GET /api/hotels/current` | `Booking`<br>`Guest`<br>`Folio`<br>`FolioLine` | Filter bookings by date/status, hydrate registration cards and GST invoices | Print spooling / export | Front Desk, In-House List, Guest Directory | `reports:read` | **Verified** |
| **Advance Payments**<br>`/admin/advances` | Advance ledger table, new advance collection dialog, booking link | `GET /api/advance-payments`<br>`POST /api/advance-payments` | `AdvancePayment`<br>`Booking`<br>`CashierShift` | Query unadjusted vs adjusted advances by booking/guest | Create advance receipt, link to active cashier shift | Folio, Cashier Shift, Daily Summary | `finance:read`<br>`finance:write` | **Verified** |
| **Cashier Shifts**<br>`/admin/cashier-shifts` | Active drawer card, shift handover modal, denomination counter, shift log | `GET /api/cashier-shifts/current`<br>`POST /api/cashier-shifts/open`<br>`POST /api/cashier-shifts/close` | `CashierShift`<br>`Payment`<br>`AdvancePayment` | Live calculation of cash collected, payouts, expected vs actual cash | Open shift, record mid-shift drop, close shift with variance | Folios, Advances, Night Audit | `cashier:read`<br>`cashier:write` | **Verified** |
| **Night Audit**<br>`/admin/night-audit` | Business date indicator, pre-audit validation checklist, 1-click audit rollover runner | `GET /api/night-audit/status`<br>`POST /api/night-audit/run` | `BusinessDate`<br>`NightAuditLog`<br>`Booking`<br>`FolioLine` | Check unassigned arrivals, open folios, unclosed cashier shifts | Post daily room charges, advance business date, snapshot ledger | Front Desk, Room Rack, Financial Reports | `audit:manage` | **Verified** |

---

## 3. Reports & Operational Dashboards

| Page / Route | UI Components | API Endpoint | Database Source | Read Operations | Write Operations | Related Modules | Permissions | Verification Status |
|---|---|---|---|---|---|---|---|---|
| **Executive Dashboard**<br>`/admin` | KPI stat cards (Occupancy, ADR, RevPAR, Revenue), recent arrivals, room status donut | `GET /api/reports/dashboard-stats` | `Booking`<br>`Room`<br>`Payment`<br>`HousekeepingTask` | Real-time aggregation of today's revenue, occupancy %, pending tasks | Read-only operational dashboard | Front Desk, Room Rack, Housekeeping | `admin:read` | **Verified** |
| **Daily Summary Report**<br>`/admin/reports/daily-summary` | 8-section hotel financial ledger (Advances, Room, Taxes, Payment Modes, City Ledger) | `GET /api/reports/daily-summary` | `Booking`<br>`FolioLine`<br>`AdvancePayment`<br>`Payment` | Business date filtered breakdown matching approved client layout | Read-only ledger export | Cashier Shift, Night Audit, Folio | `reports:read` | **Verified** |
| **Cash Sheet Report**<br>`/admin/reports/cash-sheet` | Shift-by-shift cash reconciliation, float, collections, handovers, net drawer cash | `GET /api/reports/cash-sheet` | `CashierShift`<br>`Payment`<br>`ShiftHandover` | Aggregates all cash drawer transactions across business dates | Read-only audit export | Cashier Shifts, Daily Summary | `reports:read` | **Verified** |
| **Monthly MIS Report**<br>`/admin/reports/monthly-mis` | Month-to-date occupancy %, ARR, RevPAR, revenue breakdown by segment | `GET /api/reports/monthly-mis` | `Booking`<br>`FolioLine`<br>`Room` | 30-day aggregation grouped by room category and market source | Read-only analytics export | Executive Dashboard, Night Audit | `reports:read` | **Verified** |

---

## 4. Housekeeping, Maintenance & Facility Management

| Page / Route | UI Components | API Endpoint | Database Source | Read Operations | Write Operations | Related Modules | Permissions | Verification Status |
|---|---|---|---|---|---|---|---|---|
| **Housekeeping**<br>`/admin/housekeeping` | Room cleaning board, attendant assignment modal, inspection approval button | `GET /api/housekeeping/tasks`<br>`PATCH /api/housekeeping/tasks/:id` | `HousekeepingTask`<br>`Room`<br>`User` | Filter tasks by priority, floor, attendant, and status | Update cleaning progress (`IN_PROGRESS`, `CLEANED`), mark `INSPECTED` | Room Rack, Front Desk | `housekeeping:read`<br>`housekeeping:write` | **Verified** |
| **Maintenance**<br>`/admin/maintenance` | Maintenance tickets table, create work order modal, OOO block toggle | `GET /api/maintenance/tickets`<br>`POST /api/maintenance/tickets` | `MaintenanceTicket`<br>`Room` | Query open work orders, severity, assigned technician | Create ticket, block room from sale (`OUT_OF_ORDER`), resolve ticket | Room Rack, Front Desk, Housekeeping | `maintenance:read`<br>`maintenance:write` | **Verified** |

---

## 5. Security, Access & System Administration

| Page / Route | UI Components | API Endpoint | Database Source | Read Operations | Write Operations | Related Modules | Permissions | Verification Status |
|---|---|---|---|---|---|---|---|---|
| **Staff & Users**<br>`/admin/users` | Staff directory table, role assignment dropdown, permissions editor | `GET /api/users`<br>`POST /api/users`<br>`PATCH /api/users/:id` | `User`<br>`Role`<br>`Permission` | Query staff accounts by property and role | Invite staff, modify permissions, deactivate account | Audit Logs, All modules | `admin:manage` | **Verified** |
| **Audit Logs**<br>`/admin/audit-logs` | Tamper-evident audit timeline, user filter, action filter, payload diff viewer | `GET /api/audit-logs` | `AuditLog`<br>`User` | Paginated search on entity type, user ID, timestamp | Append-only audit logging triggered on all sensitive mutations | All modules | `security:read` | **Verified** |
| **Hotel Settings**<br>`/admin/settings` | Property profile form, GSTIN, check-in/out default times, tax configuration | `GET /api/hotels/current`<br>`PATCH /api/hotels/current` | `HotelSetting` | Current property settings, invoice numbering format | Update hotel profile, tax rates, operational defaults | Folio Print, Bulk Docs, In-House List | `admin:manage` | **Verified** |
