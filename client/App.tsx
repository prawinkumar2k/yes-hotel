import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./context/AuthContext";
import { PermissionProvider } from "./context/PermissionContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { PermissionRoute } from "./components/common/PermissionRoute";
import AdminLayout from "./components/admin/AdminLayout";
import SmoothScroll from "./components/hotel/SmoothScroll";
import ScrollProgress from "./components/hotel/ScrollProgress";
import CursorFollower from "./components/hotel/CursorFollower";
import RoomHoverPreview from "./components/hotel/RoomHoverPreview";
import PageTransitionOverlay from "./components/hotel/PageTransitionOverlay";
import Chatbot from "./components/chatbot/Chatbot";

// Eager loads
import Index from "./pages/Index";

// Lazy-loaded pages
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));

const SearchPage = lazy(() => import("./pages/booking/SearchPage"));
const GuestDetailsPage = lazy(() => import("./pages/booking/GuestDetailsPage"));
const PaymentPage = lazy(() => import("./pages/booking/PaymentPage"));
const ConfirmationPage = lazy(() => import("./pages/booking/ConfirmationPage"));

const RoomsPage = lazy(() => import("./pages/public/RoomsPage"));
const RoomDetailsPage = lazy(() => import("./pages/public/RoomDetailsPage"));
const AboutPage = lazy(() => import("./pages/public/AboutPage"));
const ContactPage = lazy(() => import("./pages/public/ContactPage"));
const FAQPage = lazy(() => import("./pages/public/FAQPage"));
const GalleryPage = lazy(() => import("./pages/public/GalleryPage"));
const LegalPage = lazy(() => import("./pages/public/LegalPage"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminFrontDesk = lazy(() => import("./pages/admin/AdminFrontDesk"));
const AdminGuestRegistration = lazy(() => import("./pages/admin/AdminGuestRegistration"));
const AdminRoomRack = lazy(() => import("./pages/admin/AdminRoomRack"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminBookingDetails = lazy(() => import("./pages/admin/AdminBookingDetails"));
const AdminRooms = lazy(() => import("./pages/admin/AdminRooms"));
const AdminRoomCategories = lazy(() => import("./pages/admin/AdminRoomCategories"));
const AdminRatePlans = lazy(() => import("./pages/admin/AdminRatePlans"));
const AdminPaymentChannels = lazy(() => import("./pages/admin/AdminPaymentChannels"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminHousekeeping = lazy(() => import("./pages/admin/AdminHousekeeping"));
const AdminMaintenance = lazy(() => import("./pages/admin/AdminMaintenance"));
const AdminCheckIn = lazy(() => import("./pages/admin/AdminCheckIn"));
const AdminCheckOut = lazy(() => import("./pages/admin/AdminCheckOut"));
const AdminCalendar = lazy(() => import("./pages/admin/AdminCalendar"));
const AdminFAQs = lazy(() => import("./pages/admin/AdminFAQs"));
const AdminTestimonials = lazy(() => import("./pages/admin/AdminTestimonials"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminGuests = lazy(() => import("./pages/admin/AdminGuests"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminAdvances = lazy(() => import("./pages/admin/AdminAdvances"));
const AdminCashierShifts = lazy(() => import("./pages/admin/AdminCashierShifts"));
const AdminRefunds = lazy(() => import("./pages/admin/AdminRefunds"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminGallery = lazy(() => import("./pages/admin/AdminGallery"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminContactMessages = lazy(() => import("./pages/admin/AdminContactMessages"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminReportsLayout = lazy(() => import("./pages/admin/AdminReportsLayout"));
const AdminNightAudit = lazy(() => import("./pages/admin/AdminNightAudit"));
const AdminCorporateAccounts = lazy(() => import("./pages/admin/AdminCorporateAccounts"));
const AdminPOS = lazy(() => import("./pages/admin/AdminPOS"));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu"));
const AdminBanquets = lazy(() => import("./pages/admin/AdminBanquets"));
const AdminAncillary = lazy(() => import("./pages/admin/AdminAncillary"));
const AdminGroupBookings = lazy(() => import("./pages/admin/AdminGroupBookings"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminVendors = lazy(() => import("./pages/admin/AdminVendors"));
const AdminProcurement = lazy(() => import("./pages/admin/AdminProcurement"));
const AdminAccounting = lazy(() => import("./pages/admin/AdminAccounting"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints"));
const AdminExecutiveDashboard = lazy(() => import("./pages/admin/AdminExecutiveDashboard"));
const AdminMultiProperty = lazy(() => import("./pages/admin/AdminMultiProperty"));
const MobileHousekeeping = lazy(() => import("./pages/staff/MobileHousekeeping"));
const FrontDeskDashboard = lazy(() => import("./pages/staff/FrontDeskDashboard"));
const HousekeepingDashboard = lazy(() => import("./pages/staff/HousekeepingDashboard"));
const MaintenanceDashboard = lazy(() => import("./pages/staff/MaintenanceDashboard"));
const CashierDashboard = lazy(() => import("./pages/staff/CashierDashboard"));
const RestaurantDashboard = lazy(() => import("./pages/staff/RestaurantDashboard"));
const FinanceDashboard = lazy(() => import("./pages/staff/FinanceDashboard"));
const AdminInHouseList = lazy(() => import("./pages/admin/AdminInHouseList"));
const AdminDaySalesSummary = lazy(() => import("./pages/admin/AdminDaySalesSummary"));
const AdminMonthlyMIS = lazy(() => import("./pages/admin/AdminMonthlyMIS"));
const AdminEnquiries = lazy(() => import("./pages/admin/AdminEnquiries"));
const AdminTaskApprovals = lazy(() => import("./pages/admin/AdminTaskApprovals"));



const CustomerDashboard = lazy(() => import("./pages/customer/CustomerDashboard"));
const CustomerBookings = lazy(() => import("./pages/customer/CustomerBookings"));
const CustomerBookingDetails = lazy(() => import("./pages/customer/CustomerBookingDetails"));
const CustomerFolio = lazy(() => import("./pages/customer/CustomerFolio"));
const CustomerProfile = lazy(() => import("./pages/customer/CustomerProfile"));
const CustomerPayments = lazy(() => import("./pages/customer/CustomerPayments"));
const CustomerReviews = lazy(() => import("./pages/customer/CustomerReviews"));
const CustomerComplaints = lazy(() => import("./pages/customer/CustomerComplaints"));
const CustomerLoyalty = lazy(() => import("./pages/customer/CustomerLoyalty"));

// Placeholder pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="min-h-screen bg-hotel-ivory flex items-center justify-center">
    <div className="text-center">
      <p className="font-serif text-3xl text-hotel-black mb-3">{title}</p>
      <p className="text-hotel-black/50 text-sm">This page is under construction.</p>
    </div>
  </div>
);

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST"];
const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"];
const ALL_STAFF = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "RESTAURANT", "FINANCE", "EVENTS", "INVENTORY", "PROCUREMENT", "HOUSEKEEPING", "MAINTENANCE"];

function PageLoader() {
  return (
    <div className="min-h-screen bg-hotel-ivory flex items-center justify-center">
      <p className="font-serif text-xl text-hotel-gold animate-pulse">YES HOTELS</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionProvider>
          <TooltipProvider>
          <Toaster />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SmoothScroll />
            <ScrollProgress />
            <CursorFollower />
            <RoomHoverPreview />
            <PageTransitionOverlay />
            <Chatbot />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* PUBLIC ROUTES */}
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/rooms/:slug" element={<RoomDetailsPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/booking" element={<Navigate to="/search" replace />} />
                <Route path="/booking/guest-details" element={<GuestDetailsPage />} />
                <Route path="/booking/payment" element={<PaymentPage />} />
                <Route path="/booking/confirmation" element={<ConfirmationPage />} />
                <Route path="/terms-and-conditions" element={<LegalPage title="Terms & Conditions" contentKey="terms" />} />
                <Route path="/privacy-policy" element={<LegalPage title="Privacy Policy" contentKey="privacy" />} />
                <Route path="/cancellation-and-refund" element={<LegalPage title="Cancellation & Refund Policy" contentKey="cancellation" />} />

                {/* AUTH ROUTES */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* CUSTOMER ROUTES */}
                <Route path="/customer/dashboard" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerDashboard /></ProtectedRoute>} />
                <Route path="/customer/bookings" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerBookings /></ProtectedRoute>} />
                <Route path="/customer/bookings/:id" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerBookingDetails /></ProtectedRoute>} />
                <Route path="/customer/bookings/:id/folio" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerFolio /></ProtectedRoute>} />
                <Route path="/customer/profile" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerProfile /></ProtectedRoute>} />
                <Route path="/customer/payments" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerPayments /></ProtectedRoute>} />
                <Route path="/customer/reviews" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerReviews /></ProtectedRoute>} />
                <Route path="/customer/requests" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerComplaints /></ProtectedRoute>} />
                <Route path="/customer/loyalty" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerLoyalty /></ProtectedRoute>} />

                {/* ADMIN ROUTES */}
                <Route path="/admin/dashboard" element={<PermissionRoute pageKey="DASHBOARD.ADMIN"><AdminDashboard /></PermissionRoute>} />
                <Route path="/admin/front-desk" element={<PermissionRoute pageKey="FRONT_DESK"><AdminLayout title="Front Desk Command Center"><AdminFrontDesk /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/guest-registration" element={<PermissionRoute pageKey="GUEST_REGISTRATION"><AdminLayout title="Guest Registration"><AdminGuestRegistration /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/room-rack" element={<PermissionRoute pageKey="ROOM_RACK"><AdminLayout title="Visual Room Rack"><AdminRoomRack /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/bookings" element={<PermissionRoute pageKey="BOOKINGS"><AdminLayout title="Bookings"><AdminBookings /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/bookings/:id" element={<PermissionRoute pageKey="BOOKINGS"><AdminLayout title="Booking Details"><AdminBookingDetails /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/calendar" element={<PermissionRoute pageKey="CALENDAR"><AdminLayout title="Calendar"><AdminCalendar /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/check-in" element={<PermissionRoute pageKey="CHECK_IN"><AdminLayout title="Check-In"><AdminCheckIn /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/check-out" element={<PermissionRoute pageKey="CHECK_OUT"><AdminLayout title="Check-Out"><AdminCheckOut /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/rooms" element={<PermissionRoute pageKey="ROOMS"><AdminLayout title="Rooms"><AdminRooms /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/room-categories" element={<PermissionRoute pageKey="ROOM_CATEGORIES"><AdminLayout title="Room Categories"><AdminRoomCategories /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/rate-plans" element={<PermissionRoute pageKey="RATE_PLANS"><AdminLayout title="Dynamic Rate Plans & Meal Packages"><AdminRatePlans /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/pricing" element={<PermissionRoute pageKey="PRICING"><AdminLayout title="Pricing"><AdminPricing /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/guests" element={<PermissionRoute pageKey="GUESTS"><AdminLayout title="Guests"><AdminGuests /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/payments" element={<PermissionRoute pageKey="PAYMENTS"><AdminLayout title="Payments"><AdminPayments /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/advances" element={<PermissionRoute pageKey="ADVANCES"><AdminLayout title="Advance Payments Ledger"><AdminAdvances /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/cashier-shifts" element={<PermissionRoute pageKey="CASHIER_SHIFTS"><AdminLayout title="Cashier Shift & Drawer Reconciliation"><AdminCashierShifts /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/refunds" element={<PermissionRoute pageKey="REFUNDS"><AdminLayout title="Refunds"><AdminRefunds /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/coupons" element={<PermissionRoute pageKey="COUPONS"><AdminLayout title="Coupons"><AdminCoupons /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/housekeeping" element={<PermissionRoute pageKey="HOUSEKEEPING"><AdminLayout title="Housekeeping"><AdminHousekeeping /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/task-approvals" element={<PermissionRoute pageKey="TASK_APPROVALS"><AdminLayout title="Task Approvals"><AdminTaskApprovals /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/maintenance" element={<PermissionRoute pageKey="MAINTENANCE"><AdminLayout title="Maintenance"><AdminMaintenance /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/staff" element={<PermissionRoute pageKey="STAFF"><AdminLayout title="Staff"><AdminStaff /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/gallery" element={<PermissionRoute pageKey="CONTENT_MANAGEMENT"><AdminLayout title="Gallery"><AdminGallery /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/content" element={<PermissionRoute pageKey="CONTENT_MANAGEMENT"><AdminLayout title="Content"><AdminContent /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/faqs" element={<PermissionRoute pageKey="CONTENT_MANAGEMENT"><AdminLayout title="FAQs"><AdminFAQs /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/testimonials" element={<PermissionRoute pageKey="CONTENT_MANAGEMENT"><AdminLayout title="Testimonials"><AdminTestimonials /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/reviews" element={<PermissionRoute pageKey="REVIEWS"><AdminLayout title="Reviews"><AdminReviews /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/contact-messages" element={<PermissionRoute pageKey="CONTACT_MESSAGES"><AdminLayout title="Contact Messages"><AdminContactMessages /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/complaints" element={<PermissionRoute pageKey="COMPLAINTS"><AdminLayout title="Complaints & Service Recovery"><AdminComplaints /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/reports/*" element={<PermissionRoute pageKey="REPORTS_LAYOUT"><AdminLayout title="Reports" hidePadding><AdminReportsLayout /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/in-house-list" element={<PermissionRoute pageKey="IN_HOUSE_GUESTS"><AdminLayout title="In-House Guest List"><AdminInHouseList /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/day-sales-summary" element={<PermissionRoute pageKey="DAY_SALES_SUMMARY"><AdminLayout title="Day Sales Summary"><AdminDaySalesSummary /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/monthly-mis" element={<PermissionRoute pageKey="MONTHLY_MIS"><AdminLayout title="Monthly MIS Report"><AdminMonthlyMIS /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/enquiries" element={<PermissionRoute pageKey="ENQUIRIES"><AdminLayout title="Booking Enquiries"><AdminEnquiries /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/executive" element={<PermissionRoute pageKey="DASHBOARD.EXECUTIVE"><AdminLayout title="Executive Command Center"><AdminExecutiveDashboard /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/multi-property" element={<PermissionRoute pageKey="MULTI_PROPERTY"><AdminLayout title="Multi-Property & OTA Channel Manager"><AdminMultiProperty /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/night-audit" element={<PermissionRoute pageKey="NIGHT_AUDIT"><AdminLayout title="Automated Night Audit & Business Date Engine"><AdminNightAudit /></AdminLayout></PermissionRoute>} />
                <Route path="/staff/mobile-housekeeping" element={<PermissionRoute pageKey="HOUSEKEEPING"><AdminLayout title="Mobile Housekeeping"><MobileHousekeeping /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/analytics" element={<Navigate to="/admin/reports" replace />} />
                <Route path="/admin/settings" element={<PermissionRoute pageKey="SETTINGS"><AdminLayout title="Settings"><AdminSettings /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/settings/payment-channels" element={<PermissionRoute pageKey="PAYMENT_CHANNELS"><AdminLayout title="Payment Channels"><AdminPaymentChannels /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/audit-logs" element={<PermissionRoute pageKey="AUDIT_LOGS"><AdminLayout title="Audit Logs"><AdminAuditLogs /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/corporate-accounts" element={<PermissionRoute pageKey="CORPORATE_ACCOUNTS"><AdminLayout title="Corporate Accounts & B2B Billing"><AdminCorporateAccounts /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/pos" element={<PermissionRoute pageKey="RESTAURANT_POS"><AdminLayout title="Restaurant POS & Kitchen Display System"><AdminPOS /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/menu" element={<PermissionRoute pageKey="MENU_MANAGEMENT"><AdminLayout title="Menu Management"><AdminMenu /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/banquets" element={<PermissionRoute pageKey="BANQUETS"><AdminLayout title="Banquets & Events"><AdminBanquets /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/ancillary" element={<PermissionRoute pageKey="FRONT_DESK"><AdminLayout title="Ancillary Services"><AdminAncillary /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/group-bookings" element={<PermissionRoute pageKey="GROUP_BOOKINGS"><AdminLayout title="Group Bookings — MICE & Events"><AdminGroupBookings /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/inventory" element={<PermissionRoute pageKey="INVENTORY"><AdminLayout title="Inventory & Store Management"><AdminInventory /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/vendors" element={<PermissionRoute pageKey="VENDORS"><AdminLayout title="Vendor & Supplier Directory"><AdminVendors /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/procurement" element={<PermissionRoute pageKey="PROCUREMENT"><AdminLayout title="Procurement & Purchase Orders"><AdminProcurement /></AdminLayout></PermissionRoute>} />
                <Route path="/admin/accounting" element={<PermissionRoute pageKey="ACCOUNTING"><AdminLayout title="General Ledger & Accounting Foundation"><AdminAccounting /></AdminLayout></PermissionRoute>} />



                {/* ROLE-SPECIFIC DASHBOARDS */}
                <Route path="/front-desk/dashboard" element={<PermissionRoute pageKey="DASHBOARD.FRONT_DESK"><FrontDeskDashboard /></PermissionRoute>} />
                <Route path="/housekeeping/dashboard" element={<PermissionRoute pageKey="DASHBOARD.HOUSEKEEPING"><HousekeepingDashboard /></PermissionRoute>} />
                <Route path="/maintenance/dashboard" element={<PermissionRoute pageKey="DASHBOARD.MAINTENANCE"><MaintenanceDashboard /></PermissionRoute>} />
                <Route path="/cashier/dashboard" element={<PermissionRoute pageKey="DASHBOARD.CASHIER"><CashierDashboard /></PermissionRoute>} />
                <Route path="/restaurant/dashboard" element={<PermissionRoute pageKey="DASHBOARD.RESTAURANT"><RestaurantDashboard /></PermissionRoute>} />
                <Route path="/finance/dashboard" element={<PermissionRoute pageKey="DASHBOARD.FINANCE"><FinanceDashboard /></PermissionRoute>} />
                {/* Placeholder dashboards for roles pending full implementation */}
                <Route path="/events/dashboard" element={<PermissionRoute pageKey="BANQUETS"><AdminLayout title="Events & Banquets"><AdminBanquets /></AdminLayout></PermissionRoute>} />
                <Route path="/inventory/dashboard" element={<PermissionRoute pageKey="INVENTORY"><AdminLayout title="Inventory"><AdminInventory /></AdminLayout></PermissionRoute>} />
                <Route path="/procurement/dashboard" element={<PermissionRoute pageKey="PROCUREMENT"><AdminLayout title="Procurement"><AdminProcurement /></AdminLayout></PermissionRoute>} />

                {/* STAFF ROUTES (legacy paths — redirect to new role dashboards) */}
                <Route path="/staff/housekeeping" element={<PermissionRoute pageKey="HOUSEKEEPING"><HousekeepingDashboard /></PermissionRoute>} />
                <Route path="/staff/maintenance" element={<PermissionRoute pageKey="MAINTENANCE"><MaintenanceDashboard /></PermissionRoute>} />

                {/* CATCH ALL */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </PermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
