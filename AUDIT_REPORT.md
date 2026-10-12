# YES HOTELS — Audit Report

**Property:** YES HOTELS Bengaluru · 19 rooms · Asia/Kolkata · INR
**Branch:** `fix/production-hardening`
**Status:** Phase 0 (Recon & Wiring Audit) complete. **No application code has been changed.**

> This file replaces an earlier, uncommitted Phase 0 draft. That draft was not generated from the code and had errors, e.g. it listed models (`Content`, `GalleryItem`) and endpoints (`/api/menu` as "Connected") that don't exist or aren't mounted. Everything below was extracted from the source and checked against the running app.

---

## 0. How this was produced

1. **Static extraction** (a script, re-runnable). It parses `server/index.ts` mounts → every `router.<verb>()` in `server/src/routes/*` (middleware chain, handler, controller import) → the models each controller imports. On the client it parses `client/App.tsx` routes → each page's transitive imports → every `api.<verb>()`, `fetch("/api…")` and page-local `apiFetch("/api…", token, method)` call. Dynamic URLs (`const url = cond ? a : b`) are resolved from their literals.
2. **Matching.** Each client call was matched to a mounted backend route on method and segment pattern.
3. **Live sweep.** Every mounted `GET` route was hit (243 routes, 108 GETs) against the dev server on `:8080` with the seeded DB (`yes_hotels` on the `:27027` replica set), using a locally minted 10-minute SUPER_ADMIN token. **Only GET was used, so no seeded data was mutated.** One GET was skipped because it writes (see C-7).
4. **RBAC probes.** CUSTOMER and RECEPTIONIST tokens were sent at admin and money endpoints. The POST probes used a non-existent folio id, so nothing was written.
5. **DB evidence queries** (read-only) for each reported defect.

**Inventory:** 94 frontend routes · 43 router mounts · **243 mounted endpoints** · 3 route files never mounted (8 endpoints) · 59 models · 55 controllers · 24 services.

---

## 1. Headline findings (ranked)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| H1 | **Critical (security)** | Folio money endpoints have **authentication but no authorization or ownership check**. Any logged-in user, including a self-registered CUSTOMER, can read any folio, post charges, delete lines, edit the bill, settle and finalize. | [folio.routes.ts](server/src/routes/folio.routes.ts) uses only `protect`; [folio.controller.ts](server/src/controllers/folio.controller.ts) has no role or owner checks. Probe: a CUSTOMER `POST /api/folios/:id/settle` reached the controller (returned "Folio not found", not 403). |
| H2 | **Critical (accounting)** | 2 folios are `SETTLED` with a non-zero balance. | `WALKIN-1011-001` = **−₹2,000**, `YES-BKG-2020` = **−₹3,050** (the second one wasn't in the original defect list). |
| H3 | **Critical (inventory)** | The room-night inventory table is **empty**: `bookinginventorydays` = 0 docs against 56 bookings. The double-booking guard model exists but is not populated, so it protects nothing. | DB count |
| H4 | High | **Two parallel RBAC systems.** Legacy `authorize(...roles)` lists omit `SUPER_ADMIN`, so SUPER_ADMIN gets **403** on Settings, Staff, Gallery, Payment Channels, Group Bookings and Complaints. The newer `requirePermission(module, action)` system is used elsewhere. | Live sweep (§4) |
| H5 | High | **No single source of truth for room state.** The Room doc carries 4 overlapping fields (`status`, `housekeepingStatus`, `occupancyStatus`, `sellStatus`) that already disagree in the DB. Room-status counts are computed independently in 4 controllers and 4 client pages. | §5, §6-A |
| H6 | High | **GST logic exists in 8+ places with 5 different rule sets.** The ≤ ₹7,500 slab still uses **12%**, the pre-Sept-2025 rate. | §5 |
| H7 | High | Restaurant & POS is dead: `pos.routes.ts` and `menu.routes.ts` are **never mounted**, so every POS call returns 404. `ota.routes.ts` (Channex webhook) isn't mounted either. | §3 |
| H8 | High | `GET /api/night-audit/status` → **500**. The `businessdates` collection is empty, and a *GET* handler tries to create a BusinessDate without a `propertyId`. Night audit can't start. | Live sweep |
| H9 | Medium | All rate limiters are **commented out** in [server/index.ts](server/index.ts) (auth, payment verify, general). | Source |
| H10 | Medium | The housekeeping role dashboard PATCHes `/api/housekeeping/:id`, which doesn't exist. Status updates from `/housekeeping/dashboard` always fail. | §3 |

---

## 2. Connectivity Matrix — frontend page → API → controller → models

*Models* = the models imported by the controller(s) serving that page (controller-level, not per handler). *Flags* combine the static match with the live sweep. `✗` = no mounted backend route.

| # | Route | Page component | API calls (method path → controller) | Models | Flags |
|---|---|---|---|---|---|
| 1 | `/` | [Index](client/pages/Index.tsx) | GET /rooms/categories → room.getRoomCategories<br>GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | RoomCategory, Room, Booking | OK |
| 2 | `/about` | [AboutPage](client/pages/public/AboutPage.tsx) | GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | — | OK |
| 3 | `/rooms` | [RoomsPage](client/pages/public/RoomsPage.tsx) | GET /rooms/categories → room.getRoomCategories | RoomCategory, Room, Booking | OK |
| 4 | `/rooms/:slug` | [RoomDetailsPage](client/pages/public/RoomDetailsPage.tsx) | GET /rooms/categories/:p → room.getRoomCategoryBySlug | RoomCategory, Room, Booking | OK |
| 5 | `/gallery` | [GalleryPage](client/pages/public/GalleryPage.tsx) | — | — | no direct API calls (static / child-driven) |
| 6 | `/faq` | [FAQPage](client/pages/public/FAQPage.tsx) | GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | — | OK |
| 7 | `/contact` | [ContactPage](client/pages/public/ContactPage.tsx) | POST /contact → contact.submitContact | ContactMessage | OK |
| 8 | `/search` | [SearchPage](client/pages/booking/SearchPage.tsx) | GET /bookings/availability → booking.checkAvailability | Booking, Room, RoomCategory, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry | OK |
| 9 | `/booking` | → /search | — | — | redirect |
| 10 | `/booking/guest-details` | [GuestDetailsPage](client/pages/booking/GuestDetailsPage.tsx) | POST /booking-enquiry → bookingEnquiry.submitBookingEnquiry<br>POST /bookings/availability → booking.checkAvailability | BookingEnquiry, User, Booking, Guest, NotificationLog, Room, Property, RoomCategory, Payment, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay | OK |
| 11 | `/booking/payment` | [PaymentPage](client/pages/booking/PaymentPage.tsx) | POST /coupons/validate → coupon.validateCoupon<br>GET /rooms/categories → room.getRoomCategories<br>POST /bookings → booking.createBooking<br>POST /payments/create-order → payment.createOrder<br>POST /bookings/:p/confirm-demo → payment.confirmDemoBooking<br>POST /payments/verify → payment.verifyPayment | Coupon, RoomCategory, Room, Booking, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry, NotificationLog | OK |
| 12 | `/booking/confirmation` | [ConfirmationPage](client/pages/booking/ConfirmationPage.tsx) | — | — | no direct API calls (static / child-driven) |
| 13 | `/terms-and-conditions` | [LegalPage](client/pages/public/LegalPage.tsx) | GET /content/:p → content.getContentByKey | WebsiteContent | OK |
| 14 | `/privacy-policy` | [LegalPage](client/pages/public/LegalPage.tsx) | GET /content/:p → content.getContentByKey | WebsiteContent | OK |
| 15 | `/cancellation-and-refund` | [LegalPage](client/pages/public/LegalPage.tsx) | GET /content/:p → content.getContentByKey | WebsiteContent | OK |
| 16 | `/login` | [LoginPage](client/pages/auth/LoginPage.tsx) | POST /auth/login → auth.login | User, Guest | OK |
| 17 | `/register` | [RegisterPage](client/pages/auth/RegisterPage.tsx) | POST /auth/register → auth.register | User, Guest | OK |
| 18 | `/forgot-password` | [ForgotPasswordPage](client/pages/auth/ForgotPasswordPage.tsx) | POST /auth/forgot-password → passwordReset.forgotPassword | User, PasswordResetToken | OK |
| 19 | `/reset-password` | [ResetPasswordPage](client/pages/auth/ResetPasswordPage.tsx) | POST /auth/reset-password → passwordReset.resetPassword | User, PasswordResetToken | OK |
| 20 | `/customer/dashboard` | [CustomerDashboard](client/pages/customer/CustomerDashboard.tsx) | GET /bookings/my → booking.getMyBookings | Booking, Room, RoomCategory, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry | OK |
| 21 | `/customer/bookings` | [CustomerBookings](client/pages/customer/CustomerBookings.tsx) | GET /bookings/my → booking.getMyBookings | Booking, Room, RoomCategory, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry | OK |
| 22 | `/customer/bookings/:id` | [CustomerBookingDetails](client/pages/customer/CustomerBookingDetails.tsx) | GET /bookings/my/:p/invoice → booking.getMyBookingInvoice<br>GET /bookings/my/:p → booking.getMyBookingById<br>POST /bookings/:p/cancel → cancellation.cancelBooking<br>GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | Booking, Room, RoomCategory, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry, NotificationLog, Refund | OK |
| 23 | `/customer/bookings/:id/folio` | [CustomerFolio](client/pages/customer/CustomerFolio.tsx) | GET /folios/booking/:p → folio.getFolioByBooking<br>GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | Folio, FolioLine, Booking | OK |
| 24 | `/customer/profile` | [CustomerProfile](client/pages/customer/CustomerProfile.tsx) | PATCH /auth/profile → auth.updateProfile | User, Guest | OK |
| 25 | `/customer/payments` | [CustomerPayments](client/pages/customer/CustomerPayments.tsx) | GET /bookings/my → booking.getMyBookings | Booking, Room, RoomCategory, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry | OK |
| 26 | `/customer/reviews` | [CustomerReviews](client/pages/customer/CustomerReviews.tsx) | GET /reviews/my → review.getMyReviews | Review, Booking | OK |
| 27 | `/customer/requests` | [CustomerComplaints](client/pages/customer/CustomerComplaints.tsx) | GET /complaints/my → complaint.getMyComplaints<br>POST /complaints/my → complaint.createMyComplaint<br>GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | Complaint | OK |
| 28 | `/customer/loyalty` | [CustomerLoyalty](client/pages/customer/CustomerLoyalty.tsx) | GET /guests/my/profile → guest.getMyGuestProfile<br>GET /public/settings → (inline in route file).(inline)<br>GET /public/faqs → (inline in route file).(inline)<br>GET /public/testimonials → (inline in route file).(inline)<br>GET /public/content/:p → (inline in route file).(inline)<br>GET /public/rooms → (inline in route file).(inline)<br>GET /public/gallery → (inline in route file).(inline) | Guest, Booking, Complaint, LoyaltyTransaction | OK |
| 29 | `/admin/dashboard` | [AdminDashboard](client/pages/admin/AdminDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog | OK |
| 30 | `/admin/front-desk` | [AdminFrontDesk](client/pages/admin/AdminFrontDesk.tsx) | GET /front-desk/summary → front-desk.getFrontDeskSummary<br>GET /rooms → room.getRooms<br>POST /room-rack/:p/assign-booking → room-rack.assignRoomToBooking<br>POST /bookings/:p/check-in → booking.checkIn<br>GET /bookings/:p/checkout-preview → booking.getCheckoutPreview<br>POST /bookings/:p/check-out → booking.checkOut<br>POST /bookings/:p/extension-check → booking.checkExtensionConflict<br>POST /bookings/:p/extend → booking.extendStay<br>PUT /folios/booking/:p/bill-edit → folio.updateBookingBill<br>DELETE /folios/:p/lines/:p → folio.deleteFolioLine<br>POST /folios/:p/charges → folio.postFolioCharge | Booking, Room, HousekeepingTask, MaintenanceTicket, AdvancePayment, HotelSettings, BusinessDate, RoomCategory, BookingEvent, Payment, Property, BookingIdempotency, Folio, FolioLine, BookingInventoryDay, BookingEnquiry | OK |
| 31 | `/admin/guest-registration` | [AdminGuestRegistration](client/pages/admin/AdminGuestRegistration.tsx) | GET /front-desk/registration/guest-search → walk-in-registration.searchGuest<br>GET /front-desk/registration/available-rooms → walk-in-registration.getAvailableRoomsForRegistration<br>POST /front-desk/registration/calculate-rate → walk-in-registration.calculateRegistrationRate<br>POST /front-desk/registration/walk-in → walk-in-registration.walkInArrivalRegistration<br>POST /front-desk/registration/:p/check-in → walk-in-registration.walkInCheckIn | Booking, Room, RoomCategory, Guest, Folio, FolioLine, AdvancePayment, PaymentChannel, HotelSettings, Property, User | OK |
| 32 | `/admin/room-rack` | [AdminRoomRack](client/pages/admin/AdminRoomRack.tsx) | GET /room-rack → room-rack.getRoomRack<br>GET /folios/booking/:p → folio.getFolioByBooking<br>POST /room-rack/:p/manual-release → room-rack.manualReleaseRoom<br>POST /room-rack/:p/sell-status → room-rack.updateRoomSellStatus | Room, RoomCategory, Booking, HousekeepingTask, MaintenanceTicket, BookingEvent, Folio, FolioLine | OK |
| 33 | `/admin/bookings` | [AdminBookings](client/pages/admin/AdminBookings.tsx) | GET /admin/bookings → admin.getAdminBookings | Booking, Room, RoomCategory | OK |
| 34 | `/admin/ota-bookings` | [AdminOTABookings](client/pages/admin/AdminOTABookings.tsx) | GET /admin/bookings → admin.getAdminBookings | Booking, Room, RoomCategory | OK |
| 35 | `/admin/bookings/:id` | [AdminBookingDetails](client/pages/admin/AdminBookingDetails.tsx) | GET /admin/bookings/:p → admin.getAdminBookingById<br>PATCH /admin/bookings/:p/status → admin.updateBookingStatus<br>POST /bookings/:p/cancel → cancellation.cancelBooking<br>GET /folios/booking/:p → folio.getFolioByBooking<br>POST /folios/:p/charges → folio.postFolioCharge | Booking, Room, RoomCategory, NotificationLog, Payment, Refund, Folio, FolioLine | OK |
| 36 | `/admin/bookings/:id/folio-print` | [AdminFolioPrint](client/pages/admin/AdminFolioPrint.tsx) | GET /admin/bookings/:p → admin.getAdminBookingById<br>GET /advances → (inline in route file).(inline) | Booking, Room, RoomCategory | OK |
| 37 | `/admin/bookings/:id/grc-print` | [AdminGRCPrint](client/pages/admin/AdminGRCPrint.tsx) | GET /admin/bookings/:p → admin.getAdminBookingById<br>GET /advances → (inline in route file).(inline)<br>GET /admin/bookings → admin.getAdminBookings | Booking, Room, RoomCategory | OK |
| 38 | `/admin/calendar` | [AdminCalendar](client/pages/admin/AdminCalendar.tsx) | GET /admin/calendar → admin.getAdminCalendar | Booking, Room, RoomCategory | OK |
| 39 | `/admin/check-in` | [AdminCheckIn](client/pages/admin/AdminCheckIn.tsx) | GET /admin/bookings → admin.getAdminBookings<br>GET /rooms → room.getRooms<br>POST /bookings/:p/check-in → booking.checkIn | Booking, Room, RoomCategory, Payment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, AdvancePayment, BookingEvent, BookingInventoryDay, BookingEnquiry | OK |
| 40 | `/admin/check-out` | [AdminCheckOut](client/pages/admin/AdminCheckOut.tsx) | GET /admin/bookings → admin.getAdminBookings<br>GET /payment-channels → payment-channel.getPaymentChannels<br>GET /bookings/:p/checkout-preview → booking.getCheckoutPreview<br>POST /bookings/:p/check-out → booking.checkOut | Booking, Room, RoomCategory, PaymentChannel, Payment, AdvancePayment, Property, HousekeepingTask, BookingIdempotency, Folio, FolioLine, BookingEvent, BookingInventoryDay, BookingEnquiry | 403 for SUPER_ADMIN on /payment-channels |
| 41 | `/admin/master-data` | [AdminMasterData](client/pages/admin/AdminMasterData.tsx) | — | — | no direct API calls (static / child-driven) |
| 42 | `/admin/master-data/amenities` | [AdminAmenities](client/pages/admin/AdminAmenities.tsx) | GET /admin/master-data/amenities → master-data.getAmenities<br>DELETE /admin/master-data/amenities/:p → master-data.deleteAmenity<br>PATCH /admin/master-data/amenities/:p → master-data.updateAmenity<br>GET /admin/master-data/amenities → master-data.getAmenities | Floor, Amenity, BedType, RoomView, Room, RoomCategory | OK |
| 43 | `/admin/master-data/floors` | [AdminFloors](client/pages/admin/AdminFloors.tsx) | GET /admin/master-data/floors → master-data.getFloors<br>DELETE /admin/master-data/floors/:p → master-data.deleteFloor<br>PATCH /admin/master-data/floors/:p → master-data.updateFloor<br>GET /admin/master-data/floors → master-data.getFloors | Floor, Amenity, BedType, RoomView, Room, RoomCategory | OK |
| 44 | `/admin/master-data/bed-types` | [AdminBedTypes](client/pages/admin/AdminBedTypes.tsx) | GET /admin/master-data/bed-types → master-data.getBedTypes<br>DELETE /admin/master-data/bed-types/:p → master-data.deleteBedType<br>PATCH /admin/master-data/bed-types/:p → master-data.updateBedType<br>GET /admin/master-data/bed-types → master-data.getBedTypes | Floor, Amenity, BedType, RoomView, Room, RoomCategory | OK |
| 45 | `/admin/master-data/room-views` | [AdminRoomViews](client/pages/admin/AdminRoomViews.tsx) | GET /admin/master-data/room-views → master-data.getRoomViews<br>DELETE /admin/master-data/room-views/:p → master-data.deleteRoomView<br>PATCH /admin/master-data/room-views/:p → master-data.updateRoomView<br>GET /admin/master-data/room-views → master-data.getRoomViews | Floor, Amenity, BedType, RoomView, Room, RoomCategory | OK |
| 46 | `/admin/rooms` | [AdminRooms](client/pages/admin/AdminRooms.tsx) | GET /rooms → room.getRooms<br>GET /admin/room-categories → roomCategory.getAllCategories<br>DELETE /rooms/:p → room.deleteRoom<br>PATCH /rooms/:p → room.updateRoom<br>GET /rooms → room.getRooms | RoomCategory, Room, Booking | OK |
| 47 | `/admin/room-categories` | [AdminRoomCategories](client/pages/admin/AdminRoomCategories.tsx) | GET /admin/room-categories → roomCategory.getAllCategories<br>DELETE /admin/room-categories/:p → roomCategory.deleteCategory<br>GET /admin/room-categories/:p → roomCategory.getCategoryById<br>GET /admin/room-categories → roomCategory.getAllCategories | RoomCategory, Booking | OK |
| 48 | `/admin/rate-plans` | [AdminRatePlans](client/pages/admin/AdminRatePlans.tsx) | GET /rate-plans → rate-plan.getRatePlans<br>POST /rate-plans → rate-plan.createRatePlan | RatePlan | OK |
| 49 | `/admin/pricing` | [AdminPricing](client/pages/admin/AdminPricing.tsx) | GET /admin/room-categories → roomCategory.getAllCategories<br>GET /admin/pricing → pricing.getPricingRules<br>DELETE /admin/pricing/:p → pricing.deletePricingRule<br>PATCH /admin/pricing/:p → pricing.updatePricingRule<br>GET /admin/pricing → pricing.getPricingRules | RoomCategory, Booking, PricingRule | OK |
| 50 | `/admin/guests` | [AdminGuests](client/pages/admin/AdminGuests.tsx) | GET /guests → guest.getGuests<br>GET /guests/:p → guest.getGuestById<br>POST /guests → guest.createGuest<br>PATCH /guests/:p → guest.updateGuest<br>PATCH /guests/:p/block → guest.toggleGuestBlock | Guest, Booking, Complaint, LoyaltyTransaction | OK |
| 51 | `/admin/payments` | [AdminPayments](client/pages/admin/AdminPayments.tsx) | GET /payments/detail/:p → payment.getPaymentById<br>GET /payments → payment.getPayments | Booking, Payment, NotificationLog | OK |
| 52 | `/admin/advances` | [AdminAdvances](client/pages/admin/AdminAdvances.tsx) | GET /advances → (inline in route file).(inline)<br>GET /payment-channels → payment-channel.getPaymentChannels<br>POST /advances → (inline in route file).(inline)<br>POST /advances/:p/refund → (inline in route file).(inline) | PaymentChannel, Payment, AdvancePayment | 403 for SUPER_ADMIN on /payment-channels |
| 53 | `/admin/cashier-shifts` | [AdminCashierShifts](client/pages/admin/AdminCashierShifts.tsx) | GET /cashier-shifts/current → cashier-shift.getCurrentShift<br>POST /cashier-shifts/open → cashier-shift.openShift<br>POST /cashier-shifts/:p/paid-out → cashier-shift.recordPaidOut<br>POST /cashier-shifts/:p/handover/initiate → cashier-shift.initiateHandover<br>POST /cashier-shifts/:p/handover/confirm → cashier-shift.confirmHandover<br>POST /cashier-shifts/:p/close → cashier-shift.closeShift<br>GET /cashier-shifts/:p/details → cashier-shift.getShiftDetails | CashierShift, BusinessDate, FolioLine, AdvancePayment, Payment, Refund, Property, User | OK |
| 54 | `/admin/refunds` | [AdminRefunds](client/pages/admin/AdminRefunds.tsx) | POST /refunds/initiate → refund.initiateRefund<br>GET /refunds → refund.getRefunds | Refund, Payment, Booking, Room, NotificationLog | OK |
| 55 | `/admin/coupons` | [AdminCoupons](client/pages/admin/AdminCoupons.tsx) | GET /coupons → coupon.getCoupons<br>PATCH /coupons/:p → coupon.updateCoupon<br>POST /coupons → coupon.createCoupon<br>DELETE /coupons/:p → coupon.deleteCoupon | Coupon | OK |
| 56 | `/admin/housekeeping` | [AdminHousekeeping](client/pages/admin/AdminHousekeeping.tsx) | GET /admin/housekeeping → housekeeping.getHousekeepingTasks<br>GET /room-rack → room-rack.getRoomRack<br>GET /staff → staff.getStaffList<br>PATCH /admin/housekeeping/:p → housekeeping.updateHousekeepingTask | HousekeepingTask, Room, RoomCategory, Booking, MaintenanceTicket, BookingEvent, User, StaffProfile | 403 for SUPER_ADMIN on /staff |
| 57 | `/admin/task-approvals` | [AdminTaskApprovals](client/pages/admin/AdminTaskApprovals.tsx) | POST /task-approvals → task-approval.createTaskApproval<br>GET /task-approvals → task-approval.getTaskApprovals<br>POST /task-approvals/:p/approve → task-approval.approveTaskApproval<br>POST /task-approvals/:p/reject → task-approval.rejectTaskApproval | TaskApproval | OK |
| 58 | `/admin/maintenance` | [AdminMaintenance](client/pages/admin/AdminMaintenance.tsx) | GET /admin/maintenance → maintenance.getMaintenanceTickets<br>GET /rooms → room.getRooms<br>PATCH /admin/maintenance/:p → maintenance.updateMaintenanceTicket | MaintenanceTicket, Room, RoomCategory, Booking | OK |
| 59 | `/admin/staff` | [AdminStaff](client/pages/admin/AdminStaff.tsx) | PATCH /staff/:p → staff.updateStaff<br>POST /staff → staff.createStaff<br>POST /staff/:p/reset-password → staff.resetStaffPassword<br>GET /staff → staff.getStaffList<br>GET /permissions/roles → (inline in route file).(inline)<br>GET /permissions/pages → (inline in route file).(inline)<br>GET /permissions/roles/:p/permissions → (inline in route file).(inline)<br>PUT /permissions/roles/:p/permissions → (inline in route file).(inline) | User, StaffProfile | 403 for SUPER_ADMIN on /staff |
| 60 | `/admin/gallery` | [AdminGallery](client/pages/admin/AdminGallery.tsx) | GET /gallery → gallery.getGallery<br>POST /gallery → gallery.uploadGalleryImage<br>PATCH /gallery/:p → gallery.updateGalleryImage<br>DELETE /gallery/:p → gallery.deleteGalleryImage | Gallery | 403 for SUPER_ADMIN on /gallery |
| 61 | `/admin/content` | [AdminContent](client/pages/admin/AdminContent.tsx) | GET /content → content.getContentKeys<br>POST /content → content.createContent<br>PATCH /content/:p → content.updateContent<br>DELETE /content/:p → content.deleteContent | WebsiteContent | OK |
| 62 | `/admin/faqs` | [AdminFAQs](client/pages/admin/AdminFAQs.tsx) | GET /faqs → faq.getFAQs<br>POST /faqs → faq.createFAQ<br>PATCH /faqs/:p → faq.updateFAQ<br>DELETE /faqs/:p → faq.deleteFAQ | FAQ | OK |
| 63 | `/admin/testimonials` | [AdminTestimonials](client/pages/admin/AdminTestimonials.tsx) | GET /testimonials → testimonial.getTestimonials<br>POST /testimonials → testimonial.createTestimonial<br>PATCH /testimonials/:p → testimonial.updateTestimonial<br>DELETE /testimonials/:p → testimonial.deleteTestimonial | Testimonial | OK |
| 64 | `/admin/reviews` | [AdminReviews](client/pages/admin/AdminReviews.tsx) | GET /admin/reviews → review.getAllReviews<br>PATCH /admin/reviews/:p/status → review.moderateReview | Review, Booking | OK |
| 65 | `/admin/contact-messages` | [AdminContactMessages](client/pages/admin/AdminContactMessages.tsx) | PATCH /admin/contact-messages/:p/status → contact.updateContactStatus<br>DELETE /admin/contact-messages/:p → contact.deleteContactMessage | ContactMessage | OK |
| 66 | `/admin/complaints` | [AdminComplaints](client/pages/admin/AdminComplaints.tsx) | GET /complaints → complaint.getComplaints<br>PATCH /complaints/:p/status → complaint.updateComplaintStatus | Complaint | 403 for SUPER_ADMIN on /complaints |
| 67 | `/admin/reports/*` | [AdminReportsLayout](client/pages/admin/AdminReportsLayout.tsx) | GET /reports/monthly-mis → reports.getMonthlyMIS<br>GET /reports/day-summary → reports.getDaySummary<br>GET /reports/cash-sheet → reports.getDynamicReport<br>GET /reports/:p → reports.getDynamicReport<br>GET /reports/in-house-list → reports.getInHouseList<br>GET /admin/bookings/:p → admin.getAdminBookingById<br>GET /advances → (inline in route file).(inline)<br>GET /admin/bookings → admin.getAdminBookings | FolioLine, Booking, Room, AdvancePayment, RestaurantOrder, Complaint, Payment, Folio, HousekeepingTask, MaintenanceTicket, CorporateAccount, CashierShift, RoomCategory | OK |
| 68 | `/admin/in-house-list` | [AdminInHouseList](client/pages/admin/AdminInHouseList.tsx) | GET /reports/in-house-list → reports.getInHouseList | FolioLine, Booking, Room, AdvancePayment, RestaurantOrder, Complaint, Payment, Folio, HousekeepingTask, MaintenanceTicket, CorporateAccount, CashierShift | OK |
| 69 | `/admin/day-sales-summary` | [AdminDaySalesSummary](client/pages/admin/AdminDaySalesSummary.tsx) | GET /reports/day-summary → reports.getDaySummary | FolioLine, Booking, Room, AdvancePayment, RestaurantOrder, Complaint, Payment, Folio, HousekeepingTask, MaintenanceTicket, CorporateAccount, CashierShift | OK |
| 70 | `/admin/monthly-mis` | [AdminMonthlyMIS](client/pages/admin/AdminMonthlyMIS.tsx) | GET /reports/monthly-mis → reports.getMonthlyMIS | FolioLine, Booking, Room, AdvancePayment, RestaurantOrder, Complaint, Payment, Folio, HousekeepingTask, MaintenanceTicket, CorporateAccount, CashierShift | OK |
| 71 | `/admin/enquiries` | [AdminEnquiries](client/pages/admin/AdminEnquiries.tsx) | GET /admin/booking-enquiries → bookingEnquiry.getBookingEnquiries<br>DELETE /admin/booking-enquiries/:p → bookingEnquiry.deleteBookingEnquiry<br>POST /admin/booking-enquiries → bookingEnquiry.createAdminEnquiry | BookingEnquiry, User, Booking, Guest, NotificationLog, Room, Property, RoomCategory | OK |
| 72 | `/admin/enquiries/:id` | [AdminEnquiryDetails](client/pages/admin/AdminEnquiryDetails.tsx) | GET /admin/booking-enquiries/:p → bookingEnquiry.getBookingEnquiryById<br>PATCH /admin/booking-enquiries/:p/status → bookingEnquiry.updateBookingEnquiryStatus<br>POST /admin/booking-enquiries/:p/follow-up → bookingEnquiry.addFollowUp<br>POST /admin/booking-enquiries/:p/convert → bookingEnquiry.convertEnquiryToBooking | BookingEnquiry, User, Booking, Guest, NotificationLog, Room, Property, RoomCategory | OK |
| 73 | `/admin/executive` | [AdminExecutiveDashboard](client/pages/admin/AdminExecutiveDashboard.tsx) | GET /reports/executive-summary → reports.getExecutiveSummary<br>GET /reports/revenue-trend → reports.getRevenueTrend<br>GET /reports/department-pl → reports.getDepartmentPL<br>GET /reports/occupancy-heatmap → reports.getOccupancyHeatmap | FolioLine, Booking, Room, AdvancePayment, RestaurantOrder, Complaint, Payment, Folio, HousekeepingTask, MaintenanceTicket, CorporateAccount, CashierShift | OK |
| 74 | `/admin/multi-property` | [AdminMultiProperty](client/pages/admin/AdminMultiProperty.tsx) | GET /properties → property.getProperties<br>GET /rooms/categories → room.getRoomCategories<br>GET /properties/channels → property.getChannelMappings<br>POST /properties → property.createProperty<br>PATCH /properties/:p/toggle-active → property.togglePropertyActive<br>POST /properties/channels → property.upsertChannelMapping<br>DELETE /properties/channels/:p → property.deleteChannelMapping<br>POST /properties/channels/:p/sync → property.syncChannelMapping | Property, ChannelMapping, RoomCategory, Room, Booking | OK |
| 75 | `/admin/night-audit` | [AdminNightAudit](client/pages/admin/AdminNightAudit.tsx) | GET /night-audit/status → night-audit.getNightAuditStatus<br>POST /night-audit/run → night-audit.runNightAudit | BusinessDate, Booking, Room, Folio, FolioLine, AdvancePayment, CashierShift | 500 on /night-audit/status |
| 76 | `/staff/mobile-housekeeping` | [MobileHousekeeping](client/pages/staff/MobileHousekeeping.tsx) | GET /housekeeping/dashboard → housekeeping.getHousekeepingDashboard<br>PATCH /housekeeping/rooms/:p/status → housekeeping.updateRoomHousekeepingStatus | HousekeepingTask, Room | OK |
| 77 | `/admin/analytics` | → /admin/reports | — | — | redirect |
| 78 | `/admin/settings` | [AdminSettings](client/pages/admin/AdminSettings.tsx) | GET /settings → settings.getSettings<br>PATCH /settings → settings.updateSettings | HotelSettings | 403 for SUPER_ADMIN on /settings |
| 79 | `/admin/settings/payment-channels` | [AdminPaymentChannels](client/pages/admin/AdminPaymentChannels.tsx) | GET /payment-channels → payment-channel.getPaymentChannels<br>PATCH /payment-channels/:p → payment-channel.updatePaymentChannel<br>POST /payment-channels → payment-channel.createPaymentChannel | PaymentChannel, Payment, AdvancePayment | 403 for SUPER_ADMIN on /payment-channels |
| 80 | `/admin/audit-logs` | [AdminAuditLogs](client/pages/admin/AdminAuditLogs.tsx) | GET /audit-logs → auditLog.getAuditLogs | AuditLog | OK |
| 81 | `/admin/corporate-accounts` | [AdminCorporateAccounts](client/pages/admin/AdminCorporateAccounts.tsx) | GET /corporate-accounts → corporate-account.getCorporateAccounts<br>POST /corporate-accounts → corporate-account.createCorporateAccount | CorporateAccount | OK |
| 82 | `/admin/banquets` | [AdminBanquets](client/pages/admin/AdminBanquets.tsx) | POST /banquets → banquet.createBanquetBooking<br>PATCH /banquets/:p/status → banquet.updateBanquetStatus<br>GET /banquets → banquet.getBanquetBookings | BanquetBooking | OK |
| 83 | `/admin/pos` | [AdminPOS](client/pages/admin/AdminPOS.tsx) | **GET /menu ✗**<br>**POST /pos/orders ✗**<br>**PATCH /pos/orders/:p/status ✗**<br>**? /pos/orders ✗** | — | **404/unmounted: GET /menu**; **404/unmounted: POST /pos/orders**; **404/unmounted: PATCH /pos/orders/:p/status**; **404/unmounted: ? /pos/orders** |
| 84 | `/admin/ancillary` | [AdminAncillary](client/pages/admin/AdminAncillary.tsx) | POST /ancillary → ancillary.createAncillaryService<br>GET /ancillary → ancillary.getAncillaryServices | AncillaryService, Room, Folio, FolioLine | OK |
| 85 | `/admin/group-bookings` | [AdminGroupBookings](client/pages/admin/AdminGroupBookings.tsx) | POST /group-bookings → group-booking.createGroupBooking<br>PATCH /group-bookings/:p/status → group-booking.updateGroupStatus<br>PATCH /group-bookings/:p/advance → group-booking.recordGroupAdvance<br>GET /group-bookings → group-booking.getGroupBookings | GroupBooking | 403 for SUPER_ADMIN on /group-bookings |
| 86 | `/front-desk/dashboard` | [FrontDeskDashboard](client/pages/staff/FrontDeskDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>GET /front-desk/summary → front-desk.getFrontDeskSummary | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog, HotelSettings | OK |
| 87 | `/housekeeping/dashboard` | [HousekeepingDashboard](client/pages/staff/HousekeepingDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>**PATCH /housekeeping/:p ✗** | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog | **404/unmounted: PATCH /housekeeping/:p** |
| 88 | `/maintenance/dashboard` | [MaintenanceDashboard](client/pages/staff/MaintenanceDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>PATCH /admin/maintenance/:p → maintenance.updateMaintenanceTicket | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog | OK |
| 89 | `/cashier/dashboard` | [CashierDashboard](client/pages/staff/CashierDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>GET /cashier-shifts/current → cashier-shift.getCurrentShift | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog, FolioLine, Refund, Property | OK |
| 90 | `/finance/dashboard` | [FinanceDashboard](client/pages/staff/FinanceDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>GET /reports/executive-summary → reports.getExecutiveSummary | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog, FolioLine | OK |
| 91 | `/events/dashboard` | [AdminBanquets](client/pages/admin/AdminBanquets.tsx) | POST /banquets → banquet.createBanquetBooking<br>PATCH /banquets/:p/status → banquet.updateBanquetStatus<br>GET /banquets → banquet.getBanquetBookings | BanquetBooking | OK |
| 92 | `/staff/housekeeping` | [HousekeepingDashboard](client/pages/staff/HousekeepingDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>**PATCH /housekeeping/:p ✗** | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog | **404/unmounted: PATCH /housekeeping/:p** |
| 93 | `/staff/maintenance` | [MaintenanceDashboard](client/pages/staff/MaintenanceDashboard.tsx) | GET /dashboard/command-center → commandCenter.getCommandCenterData<br>PATCH /admin/maintenance/:p → maintenance.updateMaintenanceTicket | HousekeepingTask, MaintenanceTicket, Room, Booking, Payment, RestaurantOrder, CorporateAccount, BanquetBooking, BusinessDate, Folio, CashierShift, Complaint, Guest, User, GroupBooking, AdvancePayment, TaskApproval, AuditLog | OK |
| 94 | `*` | → / | — | — | redirect |

---

## 3. Broken wiring (client calls with no working backend)

| Client call | Caller | Problem | Root cause |
|---|---|---|---|
| `GET /api/menu`, `PATCH /api/menu/:id` | [AdminPOS.tsx](client/pages/admin/AdminPOS.tsx), [AdminMenu.tsx](client/pages/admin/AdminMenu.tsx) | 404 | `menu.routes.ts` not mounted |
| `GET/POST /api/pos/orders`, `PATCH /api/pos/orders/:id/status` | [AdminPOS.tsx](client/pages/admin/AdminPOS.tsx) | 404 → "Failed to load orders" | `pos.routes.ts` not mounted |
| `PATCH /api/housekeeping/:id` | [HousekeepingDashboard.tsx:109](client/pages/staff/HousekeepingDashboard.tsx#L109) | 404 | Only `PATCH /api/housekeeping/rooms/:id/status` and `PATCH /api/admin/housekeeping/:id` exist |
| *(page)* `AdminMenu` | [AdminMenu.tsx](client/pages/admin/AdminMenu.tsx) | Orphan page, no route in `App.tsx` | — |
| `POST /api/ota/channex-webhook` | (external) | Unreachable | `ota.routes.ts` not mounted |

**Pages returning errors for privileged users (live):**

| Page | Endpoint | SUPER_ADMIN | ADMIN |
|---|---|---|---|
| `/admin/settings` | `GET /api/settings` | **403** | 200 (populated) |
| `/admin/staff`, `/admin/housekeeping` (staff picker) | `GET /api/staff` | **403** | 200 |
| `/admin/gallery` | `GET /api/gallery` | **403** | — |
| `/admin/settings/payment-channels`, `/admin/advances`, `/admin/check-out` (payment-method picker) | `GET /api/payment-channels` | **403** | 200 but **0 rows** (collection empty) |
| `/admin/group-bookings` | `GET /api/group-bookings` | **403** | 200 |
| `/admin/complaints` | `GET /api/complaints` | **403** | 200 (non-standard envelope: no `data`) |
| `/admin/night-audit` | `GET /api/night-audit/status` | **500** | **500** |

> **"Property Settings loads empty" (L)** does **not** reproduce at the API for ADMIN: the API returns a full document. For SUPER_ADMIN it's a 403. For ADMIN the remaining suspect is client form hydration. The settings document also holds placeholder data (`"123 Hotel Avenue, City"`, `"YES Hotels"`), not the Bengaluru property.

---

## 4. Backend posture

### 4.1 Live GET sweep (SUPER_ADMIN, 108 GET routes)
- **84 × 2xx · 22 × 4xx · 1 × 5xx · 1 skipped.**
- Of the 4xx: 8 are the RBAC 403s above. The rest are expected validation responses to the sweep's generic parameters (missing `checkIn`/`checkOut`, an admin calling `/my/*`, sample ids not found). They aren't defects.
- No endpoint took more than 1s on the seeded data set.

### 4.2 Authorization gaps
- **34 public endpoints.** Most are legitimately public (auth, availability, public CMS, booking create, Razorpay verify/webhook, health). Ones to review:
  - `POST /api/bookings/:id/confirm-demo` marks a booking paid. It's hard-blocked when `NODE_ENV=production`, but it's unauthenticated in every other environment.
  - `POST /api/rate-plans/evaluate-rate` and `GET /api/rate-plans` expose rate-plan internals.
- **19 endpoints with auth but no role/permission check**:
  - 7 folio endpoints (H1)
  - `GET /api/properties` and `GET /api/properties/channels`: a CUSTOMER got **200**
  - `GET /api/permissions/users/:userId/effective`
  - the rest are legitimately self-scoped `/my/*`
- **Two RBAC mechanisms** coexist: `authorize()` with role lists vs `requirePermission(MODULE, ACTION)` (H4). Phase 1M will consolidate them onto the permission system, with `SUPER_ADMIN` as an explicit bypass.
- **Write side effects in GET handlers**:
  - `GET /api/folios/booking/:id` creates and seeds a folio
  - `GET /api/night-audit/status` creates a BusinessDate

### 4.3 Response envelope
The envelope is inconsistent. Most handlers return `{ success, data, message }`, some return `{ success, <named key> }` (e.g. complaints), and middleware errors return `{ message }` without `success`. To be standardised in Phase 2.

### 4.4 Endpoints with no frontend caller (47)
These need a decision in Phase 1: wire the endpoint up or remove it. Notable: `GET /api/front-desk/arrivals|departures`, `POST /api/folios/:id/settle|finalize|reconcile`, `POST /api/advances/:id/adjust`, `GET /api/night-audit/preview|history`, `POST /api/inspections/submit|release`, `GET /api/accounting/summary|aging`.

`GET /api/auth/me` · `PATCH /api/rooms/:id/status` · `POST /api/booking-enquiries` · `GET /api/admin/stats` · `POST /api/admin/maintenance` · `GET /api/admin/contact-messages` · `PATCH /api/admin/booking-enquiries/:id` · `GET /api/payments/:bookingId` · `GET /api/reviews` · `POST /api/reviews` · `GET /api/gallery/public` · `PATCH /api/gallery/reorder` · `GET /api/settings/public` · `POST /api/webhooks/razorpay` · `GET /api/room-rack/availability` · `GET /api/front-desk/arrivals` · `GET /api/front-desk/departures` · `GET /api/front-desk/registration/:bookingId/print` · `GET /api/front-desk/registration/report` · `GET /api/advances/summary/:bookingId` · `POST /api/advances/:id/adjust` · `POST /api/folios/:folioId/reconcile` · `POST /api/folios/:folioId/finalize` · `POST /api/folios/:folioId/settle` · `GET /api/night-audit/preview` · `GET /api/night-audit/history` · `GET /api/cashier-shifts/cashiers` · `GET /api/cashier-shifts` · `PATCH /api/rate-plans/:id` · `POST /api/rate-plans/evaluate-rate` · `GET /api/corporate-accounts/:id` · `PUT /api/corporate-accounts/:id` · `POST /api/corporate-accounts/:id/check-credit` · `GET /api/group-bookings/:id` · `GET /api/inspections/templates` · `POST /api/inspections/submit` · `POST /api/inspections/release` · `GET /api/inspections/room/:roomId` · `GET /api/accounting/summary` · `GET /api/accounting/aging` · `POST /api/complaints` · `PATCH /api/properties/:id` · `GET /api/payment-channels/:id` · `DELETE /api/payment-channels/:id` · `GET /api/task-approvals/stats` · `GET /api/permissions/users/:userId/overrides` · `PUT /api/permissions/users/:userId/overrides`

---

## 5. Duplicated calculation logic (single-source-of-truth violations)

| Fact | Where it's computed independently | Divergence observed |
|---|---|---|
| **GST rate** | [pricing.service.ts:78](server/src/services/pricing.service.ts#L78) (12/18), [booking.controller.ts:1104,1164](server/src/controllers/booking.controller.ts#L1104) (12/18), [night-audit.controller.ts:128,331](server/src/controllers/night-audit.controller.ts#L128) (6/9, i.e. half-rates), [ancillary.controller.ts:40](server/src/controllers/ancillary.controller.ts#L40) (flat 18), [PaymentPage.tsx:52](client/pages/booking/PaymentPage.tsx#L52) (flat 18, **client-side**), [AdminFolioPrint.tsx:136](client/pages/admin/AdminFolioPrint.tsx#L136) / [AdminBulkDocViewer.tsx:148](client/pages/admin/AdminBulkDocViewer.tsx#L148) / [AdminGuestRegistration.tsx:889,1377](client/pages/admin/AdminGuestRegistration.tsx#L889) (hardcoded 6+6, **client-side**), [seed.ts:613,793,1083](server/src/scripts/seed.ts#L613) (9% / 5%) | Matches the observed "×1.09" totals and the 5% walk-ins. The 12% slab is outdated: since 22 Sep 2025 it's 5% (no ITC) for ≤ ₹7,500/night and 18% above. |
| **Nights** | 15 copies: booking.controller ×4, bookingEnquiry ×2, folio, group-booking, reports (`Math.round`), walk-in ×3, pricing.service, AdminFrontDesk, AdminGuestRegistration ×2 | `ceil` vs `round` on Date objects with time components, which explains "12→14 Oct = 1 night" when check-in/out times are stored. |
| **Room counts / occupancy** | Server: commandCenter, front-desk, reports, room controllers. Client: AdminFrontDesk, AdminHousekeeping, HousekeepingDashboard, MobileHousekeeping | Dashboard 5% vs Reports 11%; Dirty 1 / 2 / 3 |
| **ADR / RevPAR** | commandCenter.controller, reports.controller | Dashboard ADR ₹0 vs Reports ₹7,610 |
| **Day bucketing** | 33 call sites using `setHours(0)`, `toISOString().split("T")`, etc. Top offenders: reports (12), night-audit (6), commandCenter (5), front-desk (3) | 02:06 IST payment lands on the previous UTC day |
| **Room state writes** | `room-state.service` is used by 6 controllers, but booking.controller, room.controller, walk-in-registration.controller and seed.ts also write Room status fields directly | Room 201 `status=OCCUPIED`, `occupancyStatus=VACANT` |

**Mock / hardcoded data:** none found in operational pages. The only static arrays are UI menus (`AdminMasterData` modules, `AdminReportsLayout` categories). Inconsistent numbers come from duplicated *logic* and inconsistent *data*, not from mocks.

---

## 6. Reported defects — Phase 0 reproduction status

✅ = reproduced from DB/source in Phase 0 · 🔶 = partially reproduced / cause narrowed · ⏳ = needs a UI/flow repro in Phase 1

| ID | Defect | Status | Phase 0 evidence / narrowed root cause |
|---|---|---|---|
| A | Room-state disagreement across modules | ✅ | Room 201: `status=OCCUPIED`, `occupancyStatus=VACANT`. Room 401: `housekeepingStatus=ASSIGNED` (a task status leaking into the room). Room 101: `status=CLEANING`, `hk=DIRTY`. 17 HK tasks (3 DIRTY, 3 CLEANING, 4 ASSIGNED, 2 INSPECTION, 2 CLEANING_COMPLETED, 3 CLEAN) but 17/19 rooms say `CLEAN`. |
| A | "Standard Luxury Suite" on every HK card | ⏳ | Category join/fallback in HK board, to trace in Phase 1A |
| B | Business date in UTC | ✅ | Shift `SHF-202610-0001.businessDate = 2026-10-11T19:47:12Z` (a Date, not `YYYY-MM-DD`). `businessdates` collection **empty**, night-audit status 500 (H8). 33 UTC-prone bucketing sites. |
| C | Folio refund posted as CREDIT, settled at −₹2,000 | ✅ | H2. Folio lines only carry `DEBIT`/`CREDIT` direction with no entry-type semantics. |
| C | Timestamp invoice numbers | ✅ | Both invoices are `INV-1791…` (epoch-ms) |
| C | Mixed `TXN-` / `pay_` IDs | 🔶 | `transactionId` is uniformly `TXN-…` (25/25). `pay_…` lives in `razorpayPaymentId`. The mix is a UI display issue, and the gateway ref is already stored separately. |
| D | Advances "Unallocated" | ✅ | **10 of 11** advances have no `booking` link (6 RECEIVED, 4 FULLY_ADJUSTED) |
| E | Two open shifts per drawer | 🔶 | `CS-2026-001` is OPEN with **no `drawerId` and no `businessDate`**. `SHF-202610-0001` is now CLOSED. Two ID formats (`CS-` vs `SHF-`). No uniqueness constraint on an active shift per drawer. |
| F | Nights miscount | ✅ | §5, 15 implementations |
| F | No double-booking guard | ✅ | H3 |
| F | Calendar ≠ reservation list | ⏳ | Different endpoints: `/admin/calendar` vs `/admin/bookings`. Query divergence to trace in Phase 1F. |
| G | Enquiry room types not in master data | ✅ | `roomType` is free text ("Executive Suite", "Deluxe King Room", "Deluxe Twin Room"). Master data: Standard Room / Deluxe Room / Executive Room / Signature Suite. No `roomCategoryId`. |
| H | OTA booked after checkout | ✅ | **49 / 56** bookings have `createdAt > checkOutDate` (seed artefact) |
| I | Hardcoded / inconsistent GST | ✅ | §5 |
| J | Critical ticket, room still sellable | ✅ | Room **204**, CRITICAL "balcony door won't lock", ticket `IN_PROGRESS`, room `SELLABLE` |
| K | Dashboard vs Reports metrics | ✅ | §5 (two ADR/occupancy implementations) |
| L | POS "Failed to load orders" | ✅ | H7 |
| L | Settings loads empty | 🔶 | 403 for SUPER_ADMIN; for ADMIN the API is fine → client hydration (§3) |
| M | RBAC only in UI | ✅ | H1, H4, §4.2 |
| M | Last-login wrong | ⏳ | To trace in auth controller / refresh flow |

---

## 7. Proposed order for Phase 1 (for approval)

1. **Security stop-gaps first** (small, high-impact):
   - H1 folio RBAC and ownership
   - H4 add SUPER_ADMIN, then consolidate RBAC
   - H9 re-enable rate limiters
2. **Foundations everything else depends on:**
   - a `businessDate` utility (IST, `YYYY-MM-DD`)
   - one `nights()` function
   - one `taxService` with configurable, effective-dated slabs
   - integer-paise money helpers
3. **A** `roomStatusService.getSnapshot()` with three separate state machines. Migrate the overlapping Room fields.
4. **C/D/E**: folio ledger semantics, settle-at-zero, the repair-script report, invoice series, advance linking, the shift single-function expected cash.
5. **F** inventory-day writes and backfill; **B** night audit; then **G, H, J, K, L, M**.

Schema migrations needed (the scripts will be written and shown before running):
- Room state fields
- `businessDate` → string
- Folio line entry types
- Invoice counter
- Advance → booking backfill (report only)
- Enquiry `roomCategoryId`
- `bookinginventorydays` backfill

---

## 8. Phase 1 progress log

Branch `hardening/phase-1`. After every step: full test suite, the GET sweep, and `npx tsx scripts/audit/consistency-check.ts` (results kept in `docs/consistency/`).

### Step 0 — Safety

| Item | Result |
|---|---|
| `npm run db:backup` / `npm run db:restore -- <dir> --yes` | Added: mongodump/mongorestore with gzip. Restore refuses without `--yes` and checks the database name. |
| Backup taken | `backups/2026-10-12T16-41-50-793`. Restored into a scratch DB: 59 collections, 842 docs, **0 count mismatches**. |
| Replica set | Dev Mongo is replica set `rs0` (PRIMARY on :27027), and a transaction probe succeeded. No `docker-compose.yml` exists yet; when it's created, it must start Mongo with `--replSet`. |
| Test baseline | 1 pre-existing failure (`night-audit-concurrency.spec.ts`, caused by H8). Vitest was also collecting a stale git worktree under `.claude/worktrees/hardening` (branch `fix/hardening-work`), which double-counted the tests; it is now excluded. |

### Step 1 — Security

| Issue | Root cause | Fix | Test |
|---|---|---|---|
| H1: any logged-in user (incl. CUSTOMER) could post folio charges, void lines, edit the bill, settle or finalize | `folio.routes.ts` used only `protect` | Every folio mutation requires `FOLIOS:<action>`, held only by the money desk (MANAGER, RECEPTIONIST, CASHIER) plus full-access roles | `rbac.integration.spec.ts`: CUSTOMER → 403 on all 16 money mutations |
| Customer could read any guest's folio, and the read wrote data | GET had no ownership check; it seeded folios; group detection pulled other guests' bookings by phone number | `requirePermissionOrBookingOwner`: CUSTOMER may read only their own booking, read-only (no seeding, no group aggregation) | own folio → 200; other's → 403; a read never creates a folio |
| H4: two RBAC systems; SUPER_ADMIN got 403 on Settings, Staff, Gallery, Payment Channels, Group Bookings, Complaints, FAQ/Testimonial/Content writes | Legacy `authorize(...roles)` lists omitted SUPER_ADMIN; the permission system lived in seed-generated DB rows | **One map**, `server/src/config/permissions.ts`, keyed by the single `UserRole` enum. `authorize()` is deleted. All 16 call sites and 8 controller role arrays now use `requirePermission` / `PermissionService.can`. DB `rolepermissions` rows override the map only when written by the Access Matrix UI (`source: "UI"`); the 99 seed rows (never edited) are inert, so **no data change** | `permissions.spec.ts` (map invariants); SUPER_ADMIN not denied on the 5 formerly-403 pages |
| Cashier shifts could only be opened/closed by admins | Routes asked for `CASHIER_SHIFTS:CREATE`; grants used `OPEN_SHIFT/CLOSE_SHIFT/RECONCILE` | Routes use the granted vocabulary | integration spec: RECEPTIONIST/CASHIER/MANAGER pass auth on shift mutations |
| `requirePropertyAccess` could never pass for non-admin staff | It read `propertyId` from the JWT, which only holds `{id, role}` | Loads the property assignment from the User record. CUSTOMER now gets 403 (was 400) | integration spec |
| H9: rate limiting disabled | All limiters commented out | General `/api` limiter, strict limiter on login/register/forgot/reset/payment-verify, separate refresh limiter; all configurable via `RATE_LIMIT_*` env (see `.env.example`) | `RateLimit-*` headers present on live responses |
| `/users/:id/effective` computed another user's permissions from the requester's role | Requester role passed as fallback | Resolves the target user's role | — |

**Access diff (generated, not hand-written):** `docs/rbac/step1-access-diff.txt`, produced by `scripts/audit/rbac-matrix.ts` (before = DB grants + legacy `authorize`; after = new map). It contains only the approved changes:

- SUPER_ADMIN gains the 38 routes that were behind legacy role lists.
- Folio mutations lose 9 roles.
- Advance/refund mutations gain RECEPTIONIST and lose FINANCE.
- Shift mutations gain MANAGER, RECEPTIONIST and CASHIER.
- Group advance gains CASHIER.

Capability checks inside controllers (`CAP.*` keys) keep their previous role sets and add SUPER_ADMIN where it was missing: cancel any booking, maintenance approval, demo-confirm, the admin-target guard on staff edits, and task-approval tiers.

**Mutation-route audit** (logged in but no role/ownership check), after the fix:
- **Customer-reachable, non-public:** `PATCH /auth/profile` and `POST /complaints/my` are self-scoped. `POST /bookings/:id/cancel` and `POST /reviews` check ownership.
- **Public by design:** auth, booking create, enquiry, contact, coupon validate, the Razorpay webhook (signature-verified), and `payments/create-order|verify`.
- **Open item:** `POST /payments/create-order` has no ownership check (anyone can create an order for any booking id; low impact).
- **Open item:** `confirm-demo` is anonymous outside production.
- No mutation route is open to every staff role.

**Verification:**
- Tests: 145 pass, 1 fail (the pre-existing night-audit failure). 45 tests are new; the 6 tests of the deleted `authorize()` were removed.
- `tsc`: 0 errors.
- GET sweep: 2xx went from 84 to 90, and the 8 SUPER_ADMIN 403s are gone.
- Consistency check: 0/5 (unchanged, as expected for a security step; see `docs/consistency/step-1-security.md`).

### New findings during Step 1 (need a decision)

| # | Finding | Impact | Proposed |
|---|---|---|---|
| N1 | **No staff user has a `propertyId`**, so every property-scoped route returns 400 for RECEPTIONIST, CASHIER, HOUSEKEEPING, MAINTENANCE, RESTAURANT and FINANCE (verified live). | Non-admin staff cannot use the app | Assign the single property (YES-BLR) to all staff: a data change, needs approval. The rewritten seeds will do it too. |
| N2 | 42 permission checks can't be passed by any non-admin role (no grants, or action-name mismatch). Examples: `HOUSEKEEPING:EDIT` (HK staff can't update room status), `MAINTENANCE:UPDATE`, `RESTAURANT_POS:*`, `COUPONS:*`, `BANQUETS:*`, `REPORTS_LAYOUT:VIEW`, `TASK_APPROVALS:*`, `NIGHT_AUDIT:CREATE`. | Roles can't do their jobs | Proposed grants table to follow; it changes access, so it needs approval. |
| N3 | A MANAGER can edit or reset the password of a **SUPER_ADMIN** (the guard protects ADMIN targets only). | Privilege escalation | Restrict SUPER_ADMIN targets to SUPER_ADMIN. This reduces MANAGER access, so it needs approval. |
| N4 | Seed grants give HOUSEKEEPING `ROOMS: CREATE/EDIT/DELETE`. | Housekeepers can delete rooms | Reduce to `VIEW`, needs approval. |
| N5 | `GET /api/properties` is reachable by CUSTOMER. | Info leak (low) | Require `PROPERTIES:VIEW`. |
| N6 | `GET /folios/booking/:id` (staff) **fabricates "Advance Payment Received (CASH)" credit lines** when seeding folios. About 200 lines were created today 13:00–13:07 IST across historical bookings. | Ledger corruption on read | Fix in the folio-ledger step; include these in the repair-script report. |
| N7 | The ₹1,050 cash checkout payment exists only as a folio line; no `Payment` document was written. | Collections and revenue widgets that read `payments` miss it | Fix in the folio/payment step: one write path. |
| N8 | The in-house **report** returns 4 rows; every other module says 2. HK task list doesn't populate the room category (source of "Standard Luxury Suite"). | Inconsistent counts | Step 3 (room status service). |
| N9 | Staff create/edit only allows 5 roles (no CASHIER, SUPERVISOR, FINANCE…). | Can't onboard cashiers from the UI | Step 3 or Phase 2. |

---

## Appendix A — All mounted endpoints (243)

| Method | Path | Handler | Auth | RBAC | Live GET (SUPER_ADMIN) | Used by FE |
|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | register | **public** | — |  | ✓ |
| POST | `/api/auth/login` | login | **public** | — |  | ✓ |
| POST | `/api/auth/refresh` | refresh | **public** | — |  | ✓ |
| POST | `/api/auth/logout` | logout | **public** | — |  | ✓ |
| GET | `/api/auth/me` | getMe | ✓ | — | 200 | unused |
| PATCH | `/api/auth/profile` | updateProfile | ✓ | — |  | ✓ |
| POST | `/api/auth/forgot-password` | forgotPassword | **public** | — |  | ✓ |
| POST | `/api/auth/reset-password` | resetPassword | **public** | — |  | ✓ |
| GET | `/api/rooms/categories` | getRoomCategories | **public** | — | 200 | ✓ |
| GET | `/api/rooms/categories/:slug` | getRoomCategoryBySlug | **public** | — | 200 | ✓ |
| GET | `/api/rooms` | getRooms | ✓ | ROOMS:VIEW | 200 | ✓ |
| POST | `/api/rooms` | createRoom | ✓ | ROOMS:CREATE |  | ✓ |
| PATCH | `/api/rooms/:id` | updateRoom | ✓ | ROOMS:EDIT |  | ✓ |
| DELETE | `/api/rooms/:id` | deleteRoom | ✓ | ROOMS:DELETE |  | ✓ |
| PATCH | `/api/rooms/:id/status` | updateRoomStatus | ✓ | ROOMS:EDIT |  | unused |
| GET | `/api/bookings/availability` | checkAvailability | **public** | — | 400 | ✓ |
| POST | `/api/bookings/availability` | checkAvailability | **public** | — |  | ✓ |
| POST | `/api/bookings` | createBooking | **public** | — |  | ✓ |
| GET | `/api/bookings/my` | getMyBookings | ✓ | — | 200 | ✓ |
| GET | `/api/bookings/my/:id` | getMyBookingById | ✓ | — | 404 | ✓ |
| GET | `/api/bookings/my/:id/invoice` | getMyBookingInvoice | ✓ | — | 404 | ✓ |
| POST | `/api/bookings/:id/confirm-demo` | confirmDemoBooking | **public** | — |  | ✓ |
| POST | `/api/bookings/:id/cancel` | cancelBooking | ✓ | — |  | ✓ |
| POST | `/api/bookings/:id/check-in` | checkIn | ✓ | BOOKINGS:CREATE |  | ✓ |
| GET | `/api/bookings/:id/checkout-preview` | getCheckoutPreview | ✓ | BOOKINGS:VIEW | 200 | ✓ |
| POST | `/api/bookings/:id/check-out` | checkOut | ✓ | BOOKINGS:CREATE |  | ✓ |
| POST | `/api/bookings/:id/extension-check` | checkExtensionConflict | ✓ | BOOKINGS:CREATE |  | ✓ |
| POST | `/api/bookings/:id/extend` | extendStay | ✓ | BOOKINGS:CREATE |  | ✓ |
| POST | `/api/booking-enquiry` | submitBookingEnquiry | **public** | — |  | ✓ |
| POST | `/api/booking-enquiries` | submitBookingEnquiry | **public** | — |  | unused |
| GET | `/api/admin/stats` | getAdminStats | ✓ | — | 200 | unused |
| GET | `/api/admin/reports/overview` | getReportsOverview | ✓ | — | 200 | ✓ |
| GET | `/api/admin/bookings` | getAdminBookings | ✓ | BOOKINGS:VIEW | 200 | ✓ |
| GET | `/api/admin/bookings/:id` | getAdminBookingById | ✓ | BOOKINGS:VIEW | 200 | ✓ |
| PATCH | `/api/admin/bookings/:id/status` | updateBookingStatus | ✓ | BOOKINGS:EDIT |  | ✓ |
| GET | `/api/admin/calendar` | getAdminCalendar | ✓ | CALENDAR:VIEW | 400 | ✓ |
| GET | `/api/admin/housekeeping` | getHousekeepingTasks | ✓ | HOUSEKEEPING:VIEW | 200 | ✓ |
| PATCH | `/api/admin/housekeeping/:id` | updateHousekeepingTask | ✓ | HOUSEKEEPING:ASSIGN |  | ✓ |
| GET | `/api/admin/maintenance` | getMaintenanceTickets | ✓ | MAINTENANCE:VIEW | 200 | ✓ |
| POST | `/api/admin/maintenance` | createMaintenanceTicket | ✓ | MAINTENANCE:CREATE |  | unused |
| PATCH | `/api/admin/maintenance/:id` | updateMaintenanceTicket | ✓ | MAINTENANCE:UPDATE |  | ✓ |
| GET | `/api/admin/contact-messages` | getContactMessages | ✓ | COMPLAINTS:VIEW | 200 | unused |
| PATCH | `/api/admin/contact-messages/:id/status` | updateContactStatus | ✓ | COMPLAINTS:UPDATE |  | ✓ |
| DELETE | `/api/admin/contact-messages/:id` | deleteContactMessage | ✓ | COMPLAINTS:DELETE |  | ✓ |
| GET | `/api/admin/booking-enquiries` | getBookingEnquiries | ✓ | ENQUIRIES:VIEW | 200 | ✓ |
| POST | `/api/admin/booking-enquiries` | createAdminEnquiry | ✓ | ENQUIRIES:CREATE |  | ✓ |
| GET | `/api/admin/booking-enquiries/:id` | getBookingEnquiryById | ✓ | ENQUIRIES:VIEW | 200 | ✓ |
| PATCH | `/api/admin/booking-enquiries/:id` | updateBookingEnquiry | ✓ | ENQUIRIES:EDIT |  | unused |
| PATCH | `/api/admin/booking-enquiries/:id/status` | updateBookingEnquiryStatus | ✓ | ENQUIRIES:EDIT |  | ✓ |
| POST | `/api/admin/booking-enquiries/:id/follow-up` | addFollowUp | ✓ | ENQUIRIES:EDIT |  | ✓ |
| POST | `/api/admin/booking-enquiries/:id/convert` | convertEnquiryToBooking | ✓ | ENQUIRIES:EDIT |  | ✓ |
| DELETE | `/api/admin/booking-enquiries/:id` | deleteBookingEnquiry | ✓ | ENQUIRIES:DELETE |  | ✓ |
| GET | `/api/admin/reviews` | getAllReviews | ✓ | COMPLAINTS:VIEW | 200 | ✓ |
| PATCH | `/api/admin/reviews/:id/status` | moderateReview | ✓ | COMPLAINTS:UPDATE |  | ✓ |
| GET | `/api/admin/room-categories` | getAllCategories | ✓ | ROOM_CATEGORIES:VIEW | 200 | ✓ |
| GET | `/api/admin/room-categories/:id` | getCategoryById | ✓ | ROOM_CATEGORIES:VIEW | 404 | ✓ |
| POST | `/api/admin/room-categories` | createCategory | ✓ | ROOM_CATEGORIES:CREATE |  | ✓ |
| PATCH | `/api/admin/room-categories/:id` | updateCategory | ✓ | ROOM_CATEGORIES:EDIT |  | ✓ |
| DELETE | `/api/admin/room-categories/:id` | deleteCategory | ✓ | ROOM_CATEGORIES:DELETE |  | ✓ |
| GET | `/api/admin/pricing` | getPricingRules | ✓ | ROOM_CATEGORIES:VIEW | 200 | ✓ |
| POST | `/api/admin/pricing` | createPricingRule | ✓ | ROOM_CATEGORIES:CREATE |  | ✓ |
| PATCH | `/api/admin/pricing/:id` | updatePricingRule | ✓ | ROOM_CATEGORIES:EDIT |  | ✓ |
| DELETE | `/api/admin/pricing/:id` | deletePricingRule | ✓ | ROOM_CATEGORIES:DELETE |  | ✓ |
| GET | `/api/admin/master-data/floors` | getFloors | ✓ | SETTINGS:VIEW | 200 | ✓ |
| POST | `/api/admin/master-data/floors` | createFloor | ✓ | SETTINGS:CREATE |  | ✓ |
| PATCH | `/api/admin/master-data/floors/:id` | updateFloor | ✓ | SETTINGS:EDIT |  | ✓ |
| DELETE | `/api/admin/master-data/floors/:id` | deleteFloor | ✓ | SETTINGS:DELETE |  | ✓ |
| GET | `/api/admin/master-data/amenities` | getAmenities | ✓ | SETTINGS:VIEW | 200 | ✓ |
| POST | `/api/admin/master-data/amenities` | createAmenity | ✓ | SETTINGS:CREATE |  | ✓ |
| PATCH | `/api/admin/master-data/amenities/:id` | updateAmenity | ✓ | SETTINGS:EDIT |  | ✓ |
| DELETE | `/api/admin/master-data/amenities/:id` | deleteAmenity | ✓ | SETTINGS:DELETE |  | ✓ |
| GET | `/api/admin/master-data/bed-types` | getBedTypes | ✓ | SETTINGS:VIEW | 200 | ✓ |
| POST | `/api/admin/master-data/bed-types` | createBedType | ✓ | SETTINGS:CREATE |  | ✓ |
| PATCH | `/api/admin/master-data/bed-types/:id` | updateBedType | ✓ | SETTINGS:EDIT |  | ✓ |
| DELETE | `/api/admin/master-data/bed-types/:id` | deleteBedType | ✓ | SETTINGS:DELETE |  | ✓ |
| GET | `/api/admin/master-data/room-views` | getRoomViews | ✓ | SETTINGS:VIEW | 200 | ✓ |
| POST | `/api/admin/master-data/room-views` | createRoomView | ✓ | SETTINGS:CREATE |  | ✓ |
| PATCH | `/api/admin/master-data/room-views/:id` | updateRoomView | ✓ | SETTINGS:EDIT |  | ✓ |
| DELETE | `/api/admin/master-data/room-views/:id` | deleteRoomView | ✓ | SETTINGS:DELETE |  | ✓ |
| POST | `/api/payments/create-order` | createOrder | **public** | — |  | ✓ |
| POST | `/api/payments/verify` | verifyPayment | **public** | — |  | ✓ |
| GET | `/api/payments` | getPayments | ✓ | PAYMENTS:VIEW | 200 | ✓ |
| GET | `/api/payments/detail/:id` | getPaymentById | ✓ | PAYMENTS:VIEW | 404 | ✓ |
| GET | `/api/payments/:bookingId` | getPaymentByBooking | ✓ | PAYMENTS:VIEW | 404 | unused |
| POST | `/api/contact` | submitContact | **public** | — |  | ✓ |
| GET | `/api/reviews` | getApprovedReviews | **public** | — | 200 | unused |
| GET | `/api/reviews/my` | getMyReviews | ✓ | — | 200 | ✓ |
| POST | `/api/reviews` | createReview | ✓ | — |  | unused |
| GET | `/api/faqs` | getFAQs | **public** | — | 200 | ✓ |
| POST | `/api/faqs` | createFAQ | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| PATCH | `/api/faqs/:id` | updateFAQ | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| DELETE | `/api/faqs/:id` | deleteFAQ | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| GET | `/api/testimonials` | getTestimonials | **public** | — | 200 | ✓ |
| POST | `/api/testimonials` | createTestimonial | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| PATCH | `/api/testimonials/:id` | updateTestimonial | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| DELETE | `/api/testimonials/:id` | deleteTestimonial | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| GET | `/api/content` | getContentKeys | **public** | — | 200 | ✓ |
| GET | `/api/content/:key` | getContentByKey | **public** | — | 404 | ✓ |
| POST | `/api/content` | createContent | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| PATCH | `/api/content/:id` | updateContent | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| DELETE | `/api/content/:id` | deleteContent | ✓ | roles:...ADMIN_ROLES |  | ✓ |
| GET | `/api/guests/my/profile` | getMyGuestProfile | ✓ | — | 401 | ✓ |
| GET | `/api/guests` | getGuests | ✓ | GUESTS:VIEW | 200 | ✓ |
| POST | `/api/guests` | createGuest | ✓ | GUESTS:CREATE |  | ✓ |
| GET | `/api/guests/:id` | getGuestById | ✓ | GUESTS:VIEW | 200 | ✓ |
| PATCH | `/api/guests/:id` | updateGuest | ✓ | GUESTS:EDIT |  | ✓ |
| PATCH | `/api/guests/:id/block` | toggleGuestBlock | ✓ | GUESTS:EDIT |  | ✓ |
| GET | `/api/refunds` | getRefunds | ✓ | REFUNDS:VIEW | 200 | ✓ |
| POST | `/api/refunds/initiate` | initiateRefund | ✓ | REFUNDS:CREATE |  | ✓ |
| POST | `/api/coupons/validate` | validateCoupon | **public** | — |  | ✓ |
| GET | `/api/coupons` | getCoupons | ✓ | COUPONS:VIEW | 200 | ✓ |
| POST | `/api/coupons` | createCoupon | ✓ | COUPONS:CREATE |  | ✓ |
| PATCH | `/api/coupons/:id` | updateCoupon | ✓ | COUPONS:EDIT |  | ✓ |
| DELETE | `/api/coupons/:id` | deleteCoupon | ✓ | COUPONS:DELETE |  | ✓ |
| GET | `/api/staff` | getStaffList | ✓ | roles:ADMIN,MANAGER | 403 | ✓ |
| POST | `/api/staff` | createStaff | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| PATCH | `/api/staff/:id` | updateStaff | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| POST | `/api/staff/:id/reset-password` | resetStaffPassword | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| GET | `/api/gallery/public` | getGallery | ✓ | roles:ADMIN,MANAGER | 200 | unused |
| GET | `/api/gallery` | getGallery | ✓ | roles:ADMIN,MANAGER | 403 | ✓ |
| POST | `/api/gallery` | uploadGalleryImage | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| PATCH | `/api/gallery/reorder` | reorderGallery | ✓ | roles:ADMIN,MANAGER |  | unused |
| PATCH | `/api/gallery/:id` | updateGalleryImage | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| DELETE | `/api/gallery/:id` | deleteGalleryImage | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| GET | `/api/settings/public` | getSettings | ✓ | roles:ADMIN,MANAGER | 200 | unused |
| GET | `/api/settings` | getSettings | ✓ | roles:ADMIN,MANAGER | 403 | ✓ |
| PATCH | `/api/settings` | updateSettings | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| GET | `/api/public/settings` | (inline) | **public** | — | 200 | ✓ |
| GET | `/api/public/gallery` | (inline) | **public** | — | 200 | ✓ |
| GET | `/api/public/faqs` | (inline) | **public** | — | 200 | ✓ |
| GET | `/api/public/testimonials` | (inline) | **public** | — | 200 | ✓ |
| GET | `/api/public/content/:key` | (inline) | **public** | — | 404 | ✓ |
| GET | `/api/public/rooms` | (inline) | **public** | — | 200 | ✓ |
| GET | `/api/audit-logs` | getAuditLogs | ✓ | AUDIT_LOGS:VIEW | 200 | ✓ |
| POST | `/api/webhooks/razorpay` | handleRazorpayWebhook | **public** | — |  | unused |
| GET | `/api/room-rack` | getRoomRack | ✓ | ROOM_RACK:VIEW | 200 | ✓ |
| GET | `/api/room-rack/availability` | getRoomAvailability | ✓ | ROOM_RACK:VIEW | 400 | unused |
| POST | `/api/room-rack/:id/manual-release` | manualReleaseRoom | ✓ | ROOM_RACK:CREATE |  | ✓ |
| POST | `/api/room-rack/:id/sell-status` | updateRoomSellStatus | ✓ | ROOM_RACK:CREATE |  | ✓ |
| POST | `/api/room-rack/:id/assign-booking` | assignRoomToBooking | ✓ | ROOM_RACK:CREATE |  | ✓ |
| GET | `/api/front-desk/summary` | getFrontDeskSummary | ✓ | FRONT_DESK:VIEW | 200 | ✓ |
| GET | `/api/front-desk/arrivals` | getTodayArrivals | ✓ | FRONT_DESK:VIEW | 200 | unused |
| GET | `/api/front-desk/departures` | getTodayDepartures | ✓ | FRONT_DESK:VIEW | 200 | unused |
| GET | `/api/front-desk/registration/guest-search` | searchGuest | ✓ | GUEST_REGISTRATION:VIEW | 400 | ✓ |
| GET | `/api/front-desk/registration/available-rooms` | getAvailableRoomsForRegistration | ✓ | GUEST_REGISTRATION:VIEW | 400 | ✓ |
| POST | `/api/front-desk/registration/calculate-rate` | calculateRegistrationRate | ✓ | GUEST_REGISTRATION:CREATE |  | ✓ |
| POST | `/api/front-desk/registration/walk-in` | walkInArrivalRegistration | ✓ | GUEST_REGISTRATION:CREATE |  | ✓ |
| POST | `/api/front-desk/registration/:bookingId/check-in` | walkInCheckIn | ✓ | GUEST_REGISTRATION:CREATE |  | ✓ |
| GET | `/api/front-desk/registration/:bookingId/print` | printRegistrationCard | ✓ | GUEST_REGISTRATION:VIEW | 200 | unused |
| GET | `/api/front-desk/registration/report` | getRegistrationReport | ✓ | GUEST_REGISTRATION:VIEW | 200 | unused |
| POST | `/api/advances` | (inline) | ✓ | ADVANCES:CREATE |  | ✓ |
| GET | `/api/advances` | (inline) | ✓ | ADVANCES:VIEW | 200 | ✓ |
| GET | `/api/advances/summary/:bookingId` | (inline) | ✓ | ADVANCES:VIEW | 200 | unused |
| POST | `/api/advances/:id/adjust` | (inline) | ✓ | ADVANCES:CREATE |  | unused |
| POST | `/api/advances/:id/refund` | (inline) | ✓ | ADVANCES:CREATE |  | ✓ |
| GET | `/api/folios/booking/:bookingId` | getFolioByBooking | ✓ | — | SKIPPED (GET has write side effect) | ✓ |
| PUT | `/api/folios/booking/:bookingId/bill-edit` | updateBookingBill | ✓ | — |  | ✓ |
| POST | `/api/folios/:folioId/charges` | postFolioCharge | ✓ | — |  | ✓ |
| DELETE | `/api/folios/:folioId/lines/:lineId` | deleteFolioLine | ✓ | — |  | ✓ |
| POST | `/api/folios/:folioId/reconcile` | reconcileFolio | ✓ | — |  | unused |
| POST | `/api/folios/:folioId/finalize` | finalizeFolioHandler | ✓ | — |  | unused |
| POST | `/api/folios/:folioId/settle` | settleFolioHandler | ✓ | — |  | unused |
| GET | `/api/night-audit/status` | getNightAuditStatus | ✓ | NIGHT_AUDIT:VIEW | 500 | ✓ |
| GET | `/api/night-audit/preview` | getNightAuditPreview | ✓ | NIGHT_AUDIT:VIEW | 400 | unused |
| GET | `/api/night-audit/history` | getNightAuditHistory | ✓ | NIGHT_AUDIT:VIEW | 200 | unused |
| POST | `/api/night-audit/run` | runNightAudit | ✓ | NIGHT_AUDIT:CREATE |  | ✓ |
| GET | `/api/reports/revenue-trend` | getRevenueTrend | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/department-pl` | getDepartmentPL | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/occupancy-heatmap` | getOccupancyHeatmap | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/executive-summary` | getExecutiveSummary | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/in-house-list` | getInHouseList | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/day-summary` | getDaySummary | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/monthly-mis` | getMonthlyMIS | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/reports/:reportId` | getDynamicReport | ✓ | REPORTS_LAYOUT:VIEW | 200 | ✓ |
| GET | `/api/cashier-shifts/cashiers` | getCashierStaffList | ✓ | CASHIER_SHIFTS:VIEW | 200 | unused |
| GET | `/api/cashier-shifts/current` | getCurrentShift | ✓ | CASHIER_SHIFTS:VIEW | 200 | ✓ |
| GET | `/api/cashier-shifts` | getAllShifts | ✓ | CASHIER_SHIFTS:VIEW | 200 | unused |
| GET | `/api/cashier-shifts/:id/details` | getShiftDetails | ✓ | CASHIER_SHIFTS:VIEW | 200 | ✓ |
| POST | `/api/cashier-shifts/open` | openShift | ✓ | CASHIER_SHIFTS:CREATE |  | ✓ |
| POST | `/api/cashier-shifts/:id/paid-out` | recordPaidOut | ✓ | CASHIER_SHIFTS:CREATE |  | ✓ |
| POST | `/api/cashier-shifts/:id/handover/initiate` | initiateHandover | ✓ | CASHIER_SHIFTS:CREATE |  | ✓ |
| POST | `/api/cashier-shifts/:id/handover/confirm` | confirmHandover | ✓ | CASHIER_SHIFTS:CREATE |  | ✓ |
| POST | `/api/cashier-shifts/:id/close` | closeShift | ✓ | CASHIER_SHIFTS:CREATE |  | ✓ |
| GET | `/api/rate-plans` | getRatePlans | **public** | — | 200 | ✓ |
| POST | `/api/rate-plans` | createRatePlan | ✓ | RATE_PLANS:CREATE |  | ✓ |
| PATCH | `/api/rate-plans/:id` | updateRatePlan | ✓ | RATE_PLANS:EDIT |  | unused |
| POST | `/api/rate-plans/evaluate-rate` | evaluateRatePreview | **public** | — |  | unused |
| GET | `/api/corporate-accounts` | getCorporateAccounts | ✓ | CORPORATE_ACCOUNTS:VIEW | 200 | ✓ |
| POST | `/api/corporate-accounts` | createCorporateAccount | ✓ | CORPORATE_ACCOUNTS:CREATE |  | ✓ |
| GET | `/api/corporate-accounts/:id` | getCorporateAccountById | ✓ | CORPORATE_ACCOUNTS:VIEW | 200 | unused |
| PUT | `/api/corporate-accounts/:id` | updateCorporateAccount | ✓ | CORPORATE_ACCOUNTS:EDIT |  | unused |
| POST | `/api/corporate-accounts/:id/check-credit` | checkCorporateCreditAvailability | ✓ | CORPORATE_ACCOUNTS:CREATE |  | unused |
| GET | `/api/group-bookings` | getGroupBookings | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST | 403 | ✓ |
| GET | `/api/group-bookings/:id` | getGroupBookingById | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST | 403 | unused |
| POST | `/api/group-bookings` | createGroupBooking | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST |  | ✓ |
| PATCH | `/api/group-bookings/:id/status` | updateGroupStatus | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST |  | ✓ |
| PATCH | `/api/group-bookings/:id/advance` | recordGroupAdvance | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST |  | ✓ |
| GET | `/api/inspections/templates` | getInspectionTemplates | ✓ | HOUSEKEEPING:VIEW | 200 | unused |
| POST | `/api/inspections/submit` | submitInspectionResult | ✓ | HOUSEKEEPING:CREATE |  | unused |
| POST | `/api/inspections/release` | releaseRoom | ✓ | HOUSEKEEPING:CREATE |  | unused |
| GET | `/api/inspections/room/:roomId` | getRoomInspectionHistory | ✓ | HOUSEKEEPING:VIEW | 200 | unused |
| GET | `/api/accounting/summary` | getAccountingSummary | ✓ | ACCOUNTING:VIEW | 200 | unused |
| GET | `/api/accounting/aging` | getCorporateCreditAging | ✓ | ACCOUNTING:VIEW | 200 | unused |
| GET | `/api/banquets` | getBanquetBookings | ✓ | BANQUETS:VIEW | 200 | ✓ |
| POST | `/api/banquets` | createBanquetBooking | ✓ | BANQUETS:CREATE |  | ✓ |
| PATCH | `/api/banquets/:id/status` | updateBanquetStatus | ✓ | BANQUETS:EDIT |  | ✓ |
| GET | `/api/ancillary` | getAncillaryServices | ✓ | FRONT_DESK:VIEW | 200 | ✓ |
| POST | `/api/ancillary` | createAncillaryService | ✓ | FRONT_DESK:CREATE |  | ✓ |
| GET | `/api/complaints/my` | getMyComplaints | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST,HOUSEKEEPING,MAINTENANCE | 200 | ✓ |
| POST | `/api/complaints/my` | createMyComplaint | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST,HOUSEKEEPING,MAINTENANCE |  | ✓ |
| GET | `/api/complaints` | getComplaints | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST,HOUSEKEEPING,MAINTENANCE | 403 | ✓ |
| POST | `/api/complaints` | createComplaint | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST,HOUSEKEEPING,MAINTENANCE |  | unused |
| PATCH | `/api/complaints/:id/status` | updateComplaintStatus | ✓ | roles:ADMIN,MANAGER,RECEPTIONIST,HOUSEKEEPING,MAINTENANCE |  | ✓ |
| GET | `/api/properties` | getProperties | ✓ | — | 200 | ✓ |
| POST | `/api/properties` | createProperty | ✓ | MULTI_PROPERTY:CREATE |  | ✓ |
| PATCH | `/api/properties/:id` | updateProperty | ✓ | MULTI_PROPERTY:EDIT |  | unused |
| PATCH | `/api/properties/:id/toggle-active` | togglePropertyActive | ✓ | MULTI_PROPERTY:EDIT |  | ✓ |
| GET | `/api/properties/channels` | getChannelMappings | ✓ | — | 200 | ✓ |
| POST | `/api/properties/channels` | upsertChannelMapping | ✓ | MULTI_PROPERTY:CREATE |  | ✓ |
| DELETE | `/api/properties/channels/:id` | deleteChannelMapping | ✓ | MULTI_PROPERTY:DELETE |  | ✓ |
| POST | `/api/properties/channels/:id/sync` | syncChannelMapping | ✓ | MULTI_PROPERTY:CREATE |  | ✓ |
| GET | `/api/housekeeping/dashboard` | getHousekeepingDashboard | ✓ | HOUSEKEEPING:VIEW | 200 | ✓ |
| PATCH | `/api/housekeeping/rooms/:id/status` | updateRoomHousekeepingStatus | ✓ | HOUSEKEEPING:EDIT |  | ✓ |
| GET | `/api/dashboard/command-center` | getCommandCenterData | ✓ | roles:ADMIN,SUPER_ADMIN,MANAGER,RECEPTIONIST,CASHIER,RESTAURANT,FINANCE,EVENTS,INVENTORY,PROCUREMENT,HOUSEKEEPING,MAINTENANCE | 200 | ✓ |
| GET | `/api/payment-channels` | getPaymentChannels | ✓ | roles:ADMIN,MANAGER | 403 | ✓ |
| GET | `/api/payment-channels/:id` | getPaymentChannel | ✓ | roles:ADMIN,MANAGER | 403 | unused |
| POST | `/api/payment-channels` | createPaymentChannel | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| PATCH | `/api/payment-channels/:id` | updatePaymentChannel | ✓ | roles:ADMIN,MANAGER |  | ✓ |
| DELETE | `/api/payment-channels/:id` | deletePaymentChannel | ✓ | roles:ADMIN,MANAGER |  | unused |
| POST | `/api/task-approvals` | createTaskApproval | ✓ | TASK_APPROVALS:CREATE |  | ✓ |
| GET | `/api/task-approvals` | getTaskApprovals | ✓ | TASK_APPROVALS:VIEW | 200 | ✓ |
| GET | `/api/task-approvals/stats` | getApprovalStats | ✓ | TASK_APPROVALS:VIEW | 200 | unused |
| POST | `/api/task-approvals/:id/approve` | approveTaskApproval | ✓ | TASK_APPROVALS:CREATE |  | ✓ |
| POST | `/api/task-approvals/:id/reject` | rejectTaskApproval | ✓ | TASK_APPROVALS:CREATE |  | ✓ |
| GET | `/api/permissions/pages` | (inline) | ✓ | PERMISSIONS:VIEW | 200 | ✓ |
| GET | `/api/permissions/roles` | (inline) | ✓ | ROLES:VIEW | 200 | ✓ |
| GET | `/api/permissions/roles/:roleId/permissions` | (inline) | ✓ | PERMISSIONS:VIEW | 200 | ✓ |
| PUT | `/api/permissions/roles/:roleId/permissions` | (inline) | ✓ | PERMISSIONS:EDIT |  | ✓ |
| GET | `/api/permissions/users/:userId/overrides` | (inline) | ✓ | PERMISSIONS:VIEW | 200 | unused |
| PUT | `/api/permissions/users/:userId/overrides` | (inline) | ✓ | PERMISSIONS:EDIT |  | unused |
| GET | `/api/permissions/users/:userId/effective` | (inline) | ✓ | — | 200 | ✓ |
| GET | `/api/health` | (inline) | **public** | — | 200 | unused |
| GET | `/api/ready` | (inline) | **public** | — | 200 | unused |
