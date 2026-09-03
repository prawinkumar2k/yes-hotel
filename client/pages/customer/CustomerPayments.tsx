import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CreditCard, Receipt } from "lucide-react";

export default function CustomerPayments() {
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
        <span className="text-hotel-white/70 text-sm">My Payments</span>
      </div>
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl text-hotel-black">Payment History</h1>
          <CreditCard className="text-hotel-gold" size={32} />
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-hotel-black/5"/>)}</div>
        ) : bookings?.length === 0 ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-12 text-center">
            <Receipt size={40} className="mx-auto text-hotel-black/20 mb-4" />
            <p className="text-hotel-black/50">No payment history found.</p>
          </div>
        ) : (
          <div className="bg-hotel-white border border-hotel-black/10 divide-y divide-hotel-black/10">
            {bookings?.map((b: any) => (
              <div key={b._id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-hotel-black/5 transition-colors">
                <div>
                  <p className="font-medium text-hotel-black">Booking #{b.bookingReference}</p>
                  <p className="text-sm text-hotel-black/50">
                    Paid on {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-xl text-hotel-black">₹{b.totalAmount}</p>
                  <p className="text-xs font-medium text-green-700 bg-green-100 inline-block px-2 py-0.5 mt-1 rounded-sm">PAID</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
