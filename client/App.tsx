import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import SmoothScroll from "./components/hotel/SmoothScroll";
import ScrollProgress from "./components/hotel/ScrollProgress";
import CursorFollower from "./components/hotel/CursorFollower";
import RoomHoverPreview from "./components/hotel/RoomHoverPreview";
import PageTransitionOverlay from "./components/hotel/PageTransitionOverlay";

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
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminBookingDetails = lazy(() => import("./pages/admin/AdminBookingDetails"));
const AdminRooms = lazy(() => import("./pages/admin/AdminRooms"));
const AdminRoomCategories = lazy(() => import("./pages/admin/AdminRoomCategories"));
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
const AdminRefunds = lazy(() => import("./pages/admin/AdminRefunds"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminGallery = lazy(() => import("./pages/admin/AdminGallery"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminContactMessages = lazy(() => import("./pages/admin/AdminContactMessages"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));

const CustomerDashboard = lazy(() => import("./pages/customer/CustomerDashboard"));
const CustomerBookings = lazy(() => import("./pages/customer/CustomerBookings"));
const CustomerBookingDetails = lazy(() => import("./pages/customer/CustomerBookingDetails"));
const CustomerProfile = lazy(() => import("./pages/customer/CustomerProfile"));
const CustomerPayments = lazy(() => import("./pages/customer/CustomerPayments"));
const CustomerReviews = lazy(() => import("./pages/customer/CustomerReviews"));

// Placeholder pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="min-h-screen bg-hotel-ivory flex items-center justify-center">
    <div className="text-center">
      <p className="font-serif text-3xl text-hotel-black mb-3">{title}</p>
      <p className="text-hotel-black/50 text-sm">This page is under construction.</p>
    </div>
  </div>
);

const ADMIN_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];
const STAFF_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"];

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
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <SmoothScroll />
            <ScrollProgress />
            <CursorFollower />
            <RoomHoverPreview />
            <PageTransitionOverlay />
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
                <Route path="/customer/profile" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerProfile /></ProtectedRoute>} />
                <Route path="/customer/payments" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerPayments /></ProtectedRoute>} />
                <Route path="/customer/reviews" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerReviews /></ProtectedRoute>} />

                {/* ADMIN ROUTES */}
                <Route path="/admin/dashboard" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/bookings" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Bookings"><AdminBookings /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/bookings/:id" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Booking Details"><AdminBookingDetails /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/calendar" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Calendar"><AdminCalendar /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/check-in" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Check-In"><AdminCheckIn /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/check-out" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Check-Out"><AdminCheckOut /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/rooms" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Rooms"><AdminRooms /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/room-categories" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Room Categories"><AdminRoomCategories /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/pricing" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Pricing"><AdminPricing /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/guests" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminLayout title="Guests"><AdminGuests /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/payments" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Payments"><AdminPayments /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/refunds" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Refunds"><AdminRefunds /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/coupons" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Coupons"><AdminCoupons /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/housekeeping" element={<ProtectedRoute roles={STAFF_ROLES}><AdminLayout title="Housekeeping"><AdminHousekeeping /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/maintenance" element={<ProtectedRoute roles={STAFF_ROLES}><AdminLayout title="Maintenance"><AdminMaintenance /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/staff" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Staff"><AdminStaff /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/gallery" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Gallery"><AdminGallery /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/content" element={<ProtectedRoute roles={["ADMIN"]}><AdminLayout title="Content"><AdminContent /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/faqs" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="FAQs"><AdminFAQs /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/testimonials" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Testimonials"><AdminTestimonials /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/reviews" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Reviews"><AdminReviews /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/contact-messages" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Contact Messages"><AdminContactMessages /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Reports"><AdminReports /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/analytics" element={<Navigate to="/admin/reports" replace />} />
                <Route path="/admin/settings" element={<ProtectedRoute roles={["ADMIN"]}><AdminLayout title="Settings"><AdminSettings /></AdminLayout></ProtectedRoute>} />
                <Route path="/admin/audit-logs" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminLayout title="Audit Logs"><AdminAuditLogs /></AdminLayout></ProtectedRoute>} />

                {/* STAFF ROUTES */}
                <Route path="/staff/housekeeping" element={<ProtectedRoute roles={["HOUSEKEEPING","ADMIN","MANAGER"]}><AdminLayout title="Housekeeping"><AdminHousekeeping /></AdminLayout></ProtectedRoute>} />
                <Route path="/staff/maintenance" element={<ProtectedRoute roles={["MAINTENANCE","ADMIN","MANAGER"]}><AdminLayout title="Maintenance"><AdminMaintenance /></AdminLayout></ProtectedRoute>} />

                {/* CATCH ALL */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
