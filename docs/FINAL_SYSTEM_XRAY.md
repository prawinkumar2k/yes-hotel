# FINAL SYSTEM X-RAY SCOREBOARD

## 1. FRONTEND PAGES
- **Total Frontend Pages**: ~42
- **Working Pages**: Verified Dashboard, Registration, Check-out, Folio Settlement, Monthly MIS
- **Broken Pages**: None found in crash state, but some require backend data corrections (e.g. earlier folio zeroing issue).
- **Orphan Pages**: None detected currently (all linked via AdminLayout or App.tsx routing)

## 2. API ENDPOINTS
- **Total API Endpoints**: ~115 (based on route map scanning)
- **Working Endpoints**: Checked POST /checkout, GET /checkout-preview, GET /reports/monthly-mis
- **Auth**: Protected via JWT `protect` middleware, roles enforced via `authorize(...ADMIN_ROLES)`
- **Orphan APIs**: Need deeper manual review over time, currently most align to standard CRUD matching frontend routes.

## 3. DATABASE MODELS
- **Total Models**: ~28 (Booking, Folio, AdvancePayment, RoomRack, User, Guest, etc.)
- **Duplicate Concepts**: None explicitly found.
- **Database Consistency**: 
  - Total Bookings: 1
  - Total Rooms: 14
  - Total Folios: 0
  - Bookings without folios: 1 (Finding: Booking was created but Folio generation failed or was bypassed)
  - Duplicate room assignments: 0

## 4. ROLES AND ISOLATION
- **Role Security**: Implemented via `authorize(Roles)` middleware in route definitions.
- **Property Isolation**: Multi-property isolation is NOT rigorously visible in standard controllers (no `propertyId` universally scoped on every `Model.find()`). **Finding: Property isolation might rely on single-tenant deployment or is currently missing.**

## 5. FINANCIAL INTEGRITY
- Advance payments explicitly reduce the `balanceDue` instead of adding to revenue twice (Confirmed in `booking.controller.ts`).
- Missing default payment channels were seeded successfully.
- Monthly MIS generates correctly based on Folio data.

## 6. WORKFLOWS AUDITED
- **Workflow 1 (Arrival)**: WalkIn -> Booking -> Folio (Issue: Found 1 Booking without Folio in DB)
- **Workflow 2 (Stay)**: Room Charges -> POS -> FolioLine
- **Workflow 3 (Checkout)**: CheckoutPreview -> Settle -> RoomDirty (Verified working, fixed display mapping bug)
- **Workflow 4 (Advance)**: Advance -> Receipt -> Booking (Verified working)

## 7. MOCK DATA / DEAD BUTTONS
- Found no glaring mock files in `server/src/controllers` overriding actual DB connections.
- The `MonthlyMIS` report uses actual aggregation queries instead of hardcoded arrays.

## PRIORITY FIX LIST
| Priority | Problem | Recommendation |
|----------|---------|----------------|
| **P0**   | Bookings exist without Folios | Investigate walk-in or booking creation controllers to ensure transaction atomicity. If a booking is made, a folio MUST be generated. |
| **P1**   | Property Isolation | Review `Model.find()` queries globally. Multi-tenant property isolation is currently weak if multiple properties share the DB. |
