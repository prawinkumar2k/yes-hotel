import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { useAuth } from "../../context/AuthContext";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { getStoredBookingDetails, hasCompleteGuestContact, saveBookingDetails } from "@/lib/bookingSession";

export default function GuestDetailsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const category = searchParams.get("category");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const adults = searchParams.get("adults");
  const children = searchParams.get("children");

  // A prior step (the concierge chatbot, or a previous visit to this form)
  // may already have full contact details stored for this exact selection —
  // reuse them instead of asking again, only for whatever's still missing.
  const stored = getStoredBookingDetails();
  const storedMatchesSelection = stored && stored.category === category && stored.checkIn === checkIn && stored.checkOut === checkOut;
  const storedGuest = storedMatchesSelection ? stored!.guestDetails : null;

  const [form, setForm] = useState({
    firstName: storedGuest?.firstName || user?.firstName || "",
    lastName: storedGuest?.lastName || user?.lastName || "",
    email: storedGuest?.email || user?.email || "",
    phone: storedGuest?.phone || "",
    specialRequests: "",
  });

  useEffect(() => {
    if (category && checkIn && checkOut && storedMatchesSelection && hasCompleteGuestContact(storedGuest)) {
      navigate("/booking/payment", { replace: true });
    }
    // Only needs to run once on mount for this selection — re-running on every
    // keystroke of `form` would fight the user's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idempotencyKey = stored?.idempotencyKey || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    saveBookingDetails({
      category: category!, checkIn: checkIn!, checkOut: checkOut!, adults: adults!, children: children!,
      guestDetails: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
      specialRequests: form.specialRequests,
      idempotencyKey,
    });
    navigate("/booking/payment");
  };

  if (!category || !checkIn || !checkOut) {
    return <div className="min-h-screen pt-24 text-center">Invalid booking session. <button onClick={() => navigate("/search")}>Start over</button></div>;
  }

  if (storedMatchesSelection && hasCompleteGuestContact(storedGuest)) {
    // Redirecting via the effect above — render nothing for this instant.
    return null;
  }

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-4 text-[10px] sm:text-xs font-medium uppercase tracking-widest mb-8 md:mb-12">
          <span className="text-hotel-black/60">1. Select Room</span>
          <ChevronRight size={14} className="text-hotel-black/20" />
          <span className="text-hotel-gold">2. Guest Details</span>
          <ChevronRight size={14} className="text-hotel-black/20" />
          <span className="text-hotel-black/60">3. Payment</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
          <div className="md:col-span-2">
            <h2 className="font-serif text-xl sm:text-2xl text-hotel-black mb-6">Guest Information</h2>
            <form id="guest-form" onSubmit={handleSubmit} className="bg-hotel-white border border-hotel-black/10 p-4 sm:p-6 md:p-8 space-y-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">First Name *</label>
                  <input type="text" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
                    className="w-full min-h-[44px] bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">Last Name *</label>
                  <input type="text" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
                    className="w-full min-h-[44px] bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">Email Address *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full min-h-[44px] bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-hotel-black/60 mb-2">Phone Number *</label>
                  <input type="tel" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full min-h-[44px] bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold transition-colors" />
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
            <div className="bg-hotel-black text-hotel-white p-4 sm:p-6 static md:sticky md:top-32">
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
              <GoldButton type="submit" form="guest-form" className="w-full min-h-[44px] mt-8 py-3">
                Continue to Payment
              </GoldButton>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
