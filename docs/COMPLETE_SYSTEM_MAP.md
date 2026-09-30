# COMPLETE SYSTEM MAP

## WORKFLOW 1: Guest Arrival & Registration
Guest Registration Page
↓
POST /api/walk-in
↓
WalkInController (createWalkInBooking)
↓
Booking Model, Folio Model, FolioLine Model, AdvancePayment Model (if payment), RoomRack Model (if assignment)
↓
Bookings Collection, Folios Collection, FolioLines Collection, AdvancePayments Collection
↓
Admin Front Desk (Dashboard)
↓
Expected Arrivals / In-House Reports

## WORKFLOW 2: Guest Stay & Billing
Admin Front Desk Page (or POS)
↓
POST /api/folios/:id/lines (or POS api)
↓
FolioController (addCharge)
↓
FolioLine Model, Folio Model
↓
FolioLines Collection
↓
Admin Checkout Page
↓
Guest Folio Invoice Report

## WORKFLOW 3: Checkout
Admin Checkout Page
↓
POST /api/bookings/:id/check-out
↓
BookingController (handleProcessCheckOut)
↓
Booking Model, Folio Model, FolioLine Model, PaymentReceipt Model, RoomRack Model
↓
Bookings Collection, Folios Collection
↓
Night Audit / Daily Sales Reports
↓
Admin Housekeeping (Room marked DIRTY)

## WORKFLOW 4: Advances
Advance Payment Page
↓
POST /api/advances
↓
AdvancePaymentController
↓
AdvancePayment Model, PaymentReceipt Model
↓
AdvancePayments Collection
↓
CheckOut flow (Advances available to offset balance)

## WORKFLOW 5: Restaurant POS
Admin POS Page
↓
POST /api/pos/orders
↓
POSController
↓
RestaurantOrder Model, FolioLine Model (if room charge)
↓
RestaurantOrders Collection
↓
Daily Sales Report (F&B)

## WORKFLOW 6: Housekeeping
Admin Housekeeping Page
↓
PATCH /api/housekeeping/tasks/:id
↓
HousekeepingController
↓
HousekeepingTask Model, RoomRack Model
↓
HousekeepingTasks Collection, Rooms Collection
↓
Admin Front Desk (Room available to assign)

## WORKFLOW 7: Night Closing
Night Audit Page
↓
POST /api/command-center/night-audit
↓
NightAuditController
↓
DailyBusinessDate Model, Folio Model, Booking Model
↓
DailyBusinessDates Collection
↓
Daily Reports, Revenue Dashboards
