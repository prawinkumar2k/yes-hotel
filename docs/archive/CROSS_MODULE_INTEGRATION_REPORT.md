# YES HOTELS — CROSS-MODULE INTEGRATION REPORT

Detailed architectural analysis and verification of the 10 core cross-module workflows across the YES HOTELS Property Management System.

---

## Workflow A: Enquiry → Reservation

### 1. Business Logic & Data Flow
- **Initiation**: Guest or corporate group submits an inquiry via `/admin/enquiries` or public lead forms.
- **Conversion**: The operator clicks "Convert to Reservation" on an active inquiry.
- **Controller**: `bookingEnquiry.controller.ts` (`convertEnquiryToBooking`).
- **Atomic Operations**:
  1. Validates that the enquiry status is not already `CONVERTED`.
  2. Resolves or creates a `Guest` profile matching the lead's email/phone.
  3. Creates an authoritative `Booking` record with `CONFIRMED` status, calculated rate, and booking reference.
  4. Marks the `BookingEnquiry` status as `CONVERTED` and records `convertedBookingId`.
- **Integrity Enforcement**: Duplicate submissions are rejected with an explicit 409 Conflict error.

---

## Workflow B: Reservation → Front Desk → Room Rack

### 1. Business Logic & Data Flow
- **Room Assignment**: Operator assigns a physical room to a reservation either in advance or at check-in.
- **Availability Enforcement**: `room-state.service.ts` inspects active bookings for overlapping check-in/check-out dates.
- **Double-Booking Prevention**:
  - Overlapping queries enforce: `checkInDate < newCheckOutDate && checkOutDate > newCheckInDate`.
  - Only rooms with status `AVAILABLE` and physical condition not marked `OUT_OF_ORDER` can be assigned.
- **Room Rack Synchronization**:
  - `GET /api/rooms/status-matrix` dynamically aggregates physical state (`Room.status`), cleanliness (`HousekeepingTask.status`), and live occupancy from `Booking.status === "CHECKED_IN"`.

---

## Workflow C: Check-in → Guest Directory → In-House Guests

### 1. Business Logic & Data Flow
- **Check-in Action**: Triggered from `/admin/front-desk` or `/admin/bookings`.
- **Controller**: `booking.controller.ts` (`checkInBooking`).
- **State Changes**:
  1. Booking status transitions from `CONFIRMED` to `CHECKED_IN`.
  2. The assigned room's occupancy status is set to `OCCUPIED`.
  3. An active `Folio` is verified or initialized.
  4. Initial room charge for night 1 is posted to the folio.
- **Guest Directory Auto-Sync**:
  - `guest.controller.ts` ensures the guest record contains up-to-date identification (ID type, ID number, GSTIN, nationality) and links past stay references.
- **In-House Guest Register**:
  - Immediately includes the checked-in guest on `/admin/reports/in-house-list` and in `/admin/reports/bulk-docs`.

---

## Workflow D: Check-out → Folio → Housekeeping → Room Availability

### 1. Business Logic & Data Flow
- **Settlement Validation**:
  - Operator inspects the folio balance on `/admin/folio/:id`. The stay cannot be checked out with an outstanding balance unless explicitly authorized as City Ledger/Company Bill.
- **Check-out Trigger**:
  - Booking status transitions to `CHECKED_OUT`.
  - Room occupancy transitions to `VACANT`.
  - Room physical cleanliness is set to `DIRTY`.
- **Housekeeping Work Order**:
  - Automatically generates a `HousekeepingTask` assigned to the floor/attendant with priority `HIGH`.
- **Sale Availability Release**:
  - The room remains blocked from new walk-ins until housekeeping marks the task `CLEANED` and a supervisor marks it `INSPECTED`.

---

## Workflow E: Payments → Folios → Advances → Cashier Shifts

### 1. Business Logic & Data Flow
- **Genuine Advances vs Settlements**:
  - Deposits collected before or during the stay are recorded as `AdvancePayment` records.
  - In `AdminFolioPrint.tsx` and `folio.controller.ts`, true advances are labeled `Advance Adjustment` and credited against the gross bill.
  - Final payments made upon checkout are categorized separately as `Settlement Payments`.
- **Cashier Shift Drawer Attribution**:
  - Every cash or card payment logs the `cashierShiftId` of the active user session.
  - Cashier drawer closing balances calculate:
    $$\text{Expected Cash} = \text{Opening Float} + \sum \text{Cash Collected} - \sum \text{Cash Payouts}$$
  - Variances are flagged for supervisor review during shift handover.

---

## Workflow F: Restaurant / POS → Guest Folio

### 1. Business Logic & Data Flow
- **Order Placement**: In-room dining or restaurant orders can be billed directly to room.
- **Verification**: `pos.controller.ts` verifies that the target room is currently `OCCUPIED` by an active `CHECKED_IN` booking.
- **Posting**: A new `FolioLine` of type `FOOD_AND_BEVERAGE` is posted with the order reference, SAC code, and GST breakdown.
- **Immutability**: Once billed to room, the POS order is marked `POSTED_TO_ROOM` to prevent duplicate billing.

---

## Workflow G: Housekeeping ↔ Maintenance ↔ Room Availability

### 1. Business Logic & Data Flow
- **Room Status Flow**:
  $$\text{DIRTY} \longrightarrow \text{CLEANING} \longrightarrow \text{CLEAN} \longrightarrow \text{INSPECTED} \longrightarrow \text{AVAILABLE}$$
- **Maintenance Escalation**:
  - When an attendant flags a defect, a `MaintenanceTicket` is generated.
  - The room is marked `OUT_OF_ORDER` (OOO) or `OUT_OF_SERVICE` (OOS), automatically removing it from inventory on Front Desk and Room Rack.
- **Release Control**:
  - Resolving the maintenance ticket resets the room status to `DIRTY` to ensure mandatory sanitization and inspection before re-leasing.

---

## Workflow H: Cashier Shift → Reconciliation → Night Audit

### 1. Business Logic & Data Flow
- **Pre-Audit Checks**:
  - Validates that all pending check-outs are resolved and all cashier shifts for the day have completed handover/closing.
- **Business Date Rollover**:
  - Authoritative `BusinessDate` model advances by +1 day.
- **Automated Posting**:
  - Posts daily room charges and room taxes for all currently in-house guests.
  - Generates immutable snapshot records in `NightAuditLog`.
- **Idempotency**: Running Night Audit twice on the same calendar day is blocked by `businessDate` verification.

---

## Workflow I: Reports → Authoritative Database Records

### 1. Source Records & Calculation Matrix
- **Daily Summary (`/admin/reports/daily-summary`)**:
  - Reconciles total room revenue, F&B revenue, advance collections, advance adjustments, and payment modes against raw `FolioLine`, `Payment`, and `AdvancePayment` collections.
- **In-House Guest List (`/admin/reports/in-house-list`)**:
  - Aggregates live occupied rooms plus same-day checked-out departures. Uses wide tabular layout to guarantee zero cell truncation or column collision.
- **Bulk GRC & GST Print (`/admin/reports/bulk-docs`)**:
  - Enables batch preview and dual-format printing (Registration Cards and Tax Invoices) directly from authoritative booking records without navigating individual screens.

---

## Workflow J: Staff → Roles → Permissions → Audit Trail

### 1. Business Logic & Data Flow
- **Role-Based Access Control**:
  - Validates permissions via `auth.middleware.ts` (`requirePermission`).
- **Direct Object Reference (IDOR) Protection**:
  - All read/write operations strictly scope entity lookups by `propertyId` matching the authenticated user's assigned property token.
- **Tamper-Evident Audit Logging**:
  - Every financial transaction, room status override, booking cancellation, and discount posting triggers an asynchronous append to `AuditLog`.
