import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { ChevronRight, BedDouble, Plus, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-green-100 text-green-800",
  CHECKED_OUT: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function CustomerBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [proof, setProof] = useState({ bookingReference: "", mobile: "" });
  const [linking, setLinking] = useState(false);

  // A stay booked at the desk, by phone or by someone else is added with its booking number and the mobile on it.
  const linkStay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinking(true);
    try {
      const res = await fetch("/api/customer/bookings/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(proof),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Stay added", description: json.message });
        setProof({ bookingReference: "", mobile: "" });
        setAdding(false);
        qc.invalidateQueries({ queryKey: ["myBookings"] });
      } else {
        toast({ title: "Couldn't add the stay", description: json.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["myBookings"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/my", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <div className="bg-hotel-black text-hotel-white px-6 py-4 flex items-center gap-4">
        <Link to="/customer/dashboard" className="font-serif text-lg tracking-widest uppercase text-hotel-gold">YES HOTELS</Link>
        <span className="text-hotel-white/30">/</span>
        <span className="text-hotel-white/70 text-sm">My Bookings</span>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="font-serif text-3xl text-hotel-black">My Bookings</h1>
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-2 text-sm border border-hotel-gold text-hotel-black px-4 py-2 hover:bg-hotel-gold/10 transition-colors">
            <Plus size={16} className="text-hotel-gold" /> Add a stay
          </button>
        </div>
        {adding && (
          <form onSubmit={linkStay} className="bg-hotel-white border border-hotel-black/10 p-6 mb-8 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <p className="sm:col-span-3 text-sm text-hotel-black/60">Booked at the desk, by phone, or by someone else? Enter the booking number and the mobile number on that booking.</p>
            <label className="text-xs text-hotel-black/60">Booking number
              <input required value={proof.bookingReference} onChange={(e) => setProof({ ...proof, bookingReference: e.target.value.toUpperCase() })} className="mt-1 w-full border-b border-hotel-black/20 py-2 bg-transparent font-mono focus:outline-none focus:border-hotel-gold" />
            </label>
            <label className="text-xs text-hotel-black/60">Mobile number
              <input required type="tel" inputMode="numeric" value={proof.mobile} onChange={(e) => setProof({ ...proof, mobile: e.target.value })} className="mt-1 w-full border-b border-hotel-black/20 py-2 bg-transparent focus:outline-none focus:border-hotel-gold" />
            </label>
            <button type="submit" disabled={linking} className="bg-hotel-gold text-hotel-black px-5 py-2.5 text-sm font-medium disabled:opacity-50">
              {linking ? <Loader2 size={16} className="animate-spin" /> : "Add"}
            </button>
          </form>
        )}
        {isLoading ? (
          <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-hotel-black/5"/>)}</div>
        ) : bookings?.length === 0 ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-12 text-center">
            <BedDouble size={40} className="mx-auto text-hotel-black/20 mb-4" />
            <p className="text-hotel-black/50 mb-4">No bookings found.</p>
            <Link to="/rooms" className="text-hotel-gold hover:underline">Explore our rooms →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings?.map((b: any) => (
              <Link to={`/customer/bookings/${b._id}`} key={b._id}
                className="bg-hotel-white border border-hotel-black/10 p-6 flex items-center justify-between hover:border-hotel-gold transition-colors group">
                <div className="space-y-1">
                  <p className="font-medium text-hotel-black">{b.bookingReference}</p>
                  <p className="text-sm text-hotel-black/60">
                    Check-in: {new Date(b.checkInDate).toLocaleDateString()} · Check-out: {new Date(b.checkOutDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-hotel-black/50">{b.adults} adult(s) · ₹{b.totalAmount}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100"}`}>{b.status}</span>
                  <ChevronRight size={16} className="text-hotel-black/30 group-hover:text-hotel-gold transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
