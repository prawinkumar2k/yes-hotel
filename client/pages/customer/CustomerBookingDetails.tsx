import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import Navbar from "@/components/hotel/Navbar";
import Footer from "@/components/hotel/Footer";
import { GoldButton, OutlineButton } from "@/components/hotel/HotelButtons";
import { format, differenceInDays } from "date-fns";
import { Loader2, ArrowLeft, Download, AlertTriangle, Calendar, User, CreditCard } from "lucide-react";

async function apiFetch(url: string, token?: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

export default function CustomerBookingDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["myBooking", id],
    queryFn: () => apiFetch(`/api/bookings/my/${id}`, user?.token),
    enabled: !!user && !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/api/bookings/${id}/cancel`, user?.token, "POST"),
    onSuccess: (resData) => {
      if (resData.success) {
        toast({ title: "Booking Cancelled", description: "Your booking has been successfully cancelled." });
        queryClient.invalidateQueries({ queryKey: ["myBooking", id] });
        queryClient.invalidateQueries({ queryKey: ["myBookings"] });
        setShowCancelModal(false);
      } else {
        toast({ title: "Error", description: resData.message, variant: "destructive" });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-hotel-ivory pt-24 flex items-center justify-center">
        <Loader2 className="animate-spin text-hotel-gold" size={32} />
      </div>
    );
  }

  if (error || !data?.success || !data?.data) {
    return (
      <div className="min-h-screen bg-hotel-ivory pt-24">
        <Navbar transparent={false} />
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <p className="text-red-500 mb-4">Failed to load booking details.</p>
          <OutlineButton onClick={() => navigate("/customer/bookings")}>Back to My Bookings</OutlineButton>
        </div>
      </div>
    );
  }

  const booking = data.data;
  const nights = differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate));
  const isCancellable = ["PENDING", "CONFIRMED"].includes(booking.status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-amber-100 text-amber-800";
      case "CHECKED_IN": return "bg-blue-100 text-blue-800";
      case "CHECKED_OUT": return "bg-gray-100 text-gray-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to="/customer/bookings" className="flex items-center gap-2 text-sm text-hotel-black/60 hover:text-hotel-black mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to My Bookings
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-hotel-black mb-2">Booking Details</h1>
            <p className="text-hotel-black/60 font-mono">Ref: {booking.bookingReference}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded text-xs font-semibold tracking-wider ${getStatusColor(booking.status)}`}>
              {booking.status}
            </span>
            <OutlineButton
              className="text-xs py-2 h-auto"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/bookings/my/${id}/invoice`, {
                    headers: { Authorization: `Bearer ${user?.token}` },
                  });
                  if (!res.ok) throw new Error("Failed to load invoice");
                  const html = await res.text();
                  const blob = new Blob([html], { type: "text/html" });
                  window.open(URL.createObjectURL(blob), "_blank");
                } catch {
                  toast({ title: "Error", description: "Unable to open invoice.", variant: "destructive" });
                }
              }}
            >
              <Download size={14} className="mr-2" /> Invoice
            </OutlineButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-hotel-white p-6 border border-hotel-black/10">
              <h3 className="font-serif text-xl mb-6 flex items-center gap-2"><Calendar size={20} className="text-hotel-gold"/> Stay Information</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Check-in</p>
                  <p className="font-medium text-lg">{format(new Date(booking.checkInDate), "MMM dd, yyyy")}</p>
                  <p className="text-sm text-hotel-black/60">From 3:00 PM</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Check-out</p>
                  <p className="font-medium text-lg">{format(new Date(booking.checkOutDate), "MMM dd, yyyy")}</p>
                  <p className="text-sm text-hotel-black/60">Until 11:00 AM</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-hotel-black/10">
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Room Category</p>
                <p className="font-medium">{booking.roomCategory?.name || "Unknown Category"}</p>
                <p className="text-sm text-hotel-black/60">{nights} Night{nights !== 1 ? 's' : ''} • {booking.adults} Adult(s), {booking.children} Child(ren)</p>
                {booking.assignedRoom && (
                   <p className="mt-2 text-sm bg-hotel-ivory inline-block px-3 py-1 border border-hotel-black/5">
                     Assigned Room: <strong>{booking.assignedRoom.roomNumber}</strong> (Floor {booking.assignedRoom.floor})
                   </p>
                )}
              </div>
            </div>

            <div className="bg-hotel-white p-6 border border-hotel-black/10">
              <h3 className="font-serif text-xl mb-6 flex items-center gap-2"><User size={20} className="text-hotel-gold"/> Guest Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Name</p>
                  <p className="font-medium">{booking.guestDetails.firstName} {booking.guestDetails.lastName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Contact</p>
                  <p className="font-medium">{booking.guestDetails.email}</p>
                  <p className="text-sm text-hotel-black/60">{booking.guestDetails.phone}</p>
                </div>
              </div>
              {booking.specialRequests && (
                <div className="mt-6 pt-6 border-t border-hotel-black/10">
                  <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-1">Special Requests</p>
                  <p className="text-sm">{booking.specialRequests}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-hotel-black text-hotel-white p-6">
              <h3 className="font-serif text-xl mb-6 text-hotel-gold flex items-center gap-2"><CreditCard size={20}/> Payment Summary</h3>
              <div className="space-y-4 text-sm text-hotel-white/80">
                <div className="flex justify-between">
                  <span>Room Charges</span>
                  <span>₹{(booking.totalAmount - booking.taxAmount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (18% GST)</span>
                  <span>₹{booking.taxAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="border-t border-hotel-white/20 pt-4 mt-2">
                  <div className="flex justify-between items-end">
                    <span className="uppercase tracking-widest text-xs">Total Amount</span>
                    <span className="font-serif text-2xl text-hotel-gold">₹{booking.totalAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="bg-hotel-white/5 p-3 mt-4 flex justify-between items-center text-xs border border-hotel-white/10">
                  <span className="uppercase tracking-widest text-hotel-white/60">Status</span>
                  <span className={`font-semibold ${booking.paymentStatus === 'PAID' ? 'text-green-400' : 'text-amber-400'}`}>
                    {booking.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            {isCancellable && (
              <div className="bg-hotel-white p-6 border border-hotel-black/10 text-center">
                <h3 className="font-serif text-lg mb-2">Need to cancel?</h3>
                <p className="text-sm text-hotel-black/60 mb-4">You can cancel this booking free of charge up to 48 hours before check-in.</p>
                <OutlineButton onClick={() => setShowCancelModal(true)} className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
                  Cancel Booking
                </OutlineButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-hotel-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-hotel-white max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="font-serif text-2xl mb-2">Cancel Booking?</h3>
            <p className="text-hotel-black/70 text-sm mb-8">
              Are you sure you want to cancel booking <strong>{booking.bookingReference}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <OutlineButton onClick={() => setShowCancelModal(false)} className="flex-1">Keep Booking</OutlineButton>
              <GoldButton 
                onClick={() => cancelMutation.mutate()} 
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
              >
                {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Yes, Cancel"}
              </GoldButton>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}
