import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { useAuth } from "../../context/AuthContext";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";

export default function GuestDetailsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const category = searchParams.get("category");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const adults = searchParams.get("adults");
  const children = searchParams.get("children");

  const [form, setForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: "",
    specialRequests: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idempotencyKey = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    // In a real app, we might store this in a context or session storage
    // For now, pass via URL state
    sessionStorage.setItem("bookingDetails", JSON.stringify({
      category, checkIn, checkOut, adults, children,
      guestDetails: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
      specialRequests: form.specialRequests,
      idempotencyKey,
    }));
    navigate("/booking/payment");
  };

  if (!category || !checkIn || !checkOut) {
    return <div className="min-h-screen pt-24 text-center">Invalid booking session. <button onClick={() => navigate("/search")}>Start over</button></div>;
  }

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Breadcrumb */}
        <div className="flex items-center justify-center gap-4 text-xs font-medium uppercase tracking-widest mb-12">
          <span className="text-hotel-black/60">1. Select Room</span>
          <ChevronRight size={14} className="text-hotel-black/20" />
          <span className="text-hotel-gold">2. Guest Details</span>
          <ChevronRight size={14} className="text-hotel-black/20" />
          <span className="text-hotel-black/60">3. Payment</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <h2 className="font-serif text-2xl text-hotel-black mb-6">Guest Information</h2>
            <form id="guest-form" onSubmit={handleSubmit} className="bg-hotel-white border border-hotel-black/10 p-8 space-y-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">First Name *</label>
                  <input type="text" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
                    className="w-full bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">Last Name *</label>
                  <input type="text" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
                    className="w-full bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">Email Address *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">Phone Number *</label>
                  <input type="tel" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-hotel-black/60 mb-2">Special Requests (Optional)</label>
                <textarea rows={3} value={form.specialRequests} onChange={e => setForm({...form, specialRequests: e.target.value})}
                  className="w-full bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors resize-none"
                  placeholder="E.g., early check-in, late check-out, specific room view..." />
              </div>
            </form>
          </div>

          <div className="md:col-span-1">
            <div className="bg-hotel-black text-hotel-white p-6 sticky top-32">
              <h3 className="font-serif text-xl text-hotel-gold mb-6">Stay Summary</h3>
              <div className="space-y-4 text-sm text-hotel-white/80">
                <div className="flex justify-between border-b border-hotel-white/10 pb-4">
                  <span>Check In</span>
                  <span className="font-medium text-hotel-white">{format(new Date(checkIn!), "MMM dd, yyyy")}</span>
                </div>
                <div className="flex justify-between border-b border-hotel-white/10 pb-4">
                  <span>Check Out</span>
                  <span className="font-medium text-hotel-white">{format(new Date(checkOut!), "MMM dd, yyyy")}</span>
                </div>
                <div className="flex justify-between border-b border-hotel-white/10 pb-4">
                  <span>Guests</span>
                  <span className="font-medium text-hotel-white">{adults} Adult(s), {children} Child(ren)</span>
                </div>
              </div>
              <GoldButton type="submit" form="guest-form" className="w-full mt-8 py-3">
                Continue to Payment
              </GoldButton>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
