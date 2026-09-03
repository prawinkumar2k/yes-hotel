import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, BedDouble } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-green-100 text-green-800",
  CHECKED_OUT: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function CustomerBookings() {
  const { user } = useAuth();

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
        <h1 className="font-serif text-3xl text-hotel-black mb-8">My Bookings</h1>
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
