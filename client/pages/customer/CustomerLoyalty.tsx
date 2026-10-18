import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import Footer from "@/components/hotel/Footer";
import { Award, Clock } from "lucide-react";
import { format } from "date-fns";

export default function CustomerLoyalty() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["myGuestProfile"],
    queryFn: async () => {
      const res = await fetch("/api/guests/my/profile", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      return res.json();
    },
    enabled: !!user,
  });

  const stats = data?.data?.stats;
  const transactions = data?.data?.loyaltyTransactions || [];

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl text-hotel-black mb-2">My Stays with Us</h1>
            <p className="text-hotel-black/60">Your stays and spend at YES HOTELS.</p>
          </div>
          <Award className="text-hotel-gold hidden sm:block" size={48} />
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-40 bg-hotel-black/5" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-hotel-white border border-hotel-black/10 p-8 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-2">Completed Stays</p>
                <h2 className="font-serif text-4xl text-hotel-black">{stats?.totalStays ?? 0}</h2>
                <p className="text-xs text-hotel-black/40 mt-2">{stats?.totalBookings ?? 0} booking{(stats?.totalBookings ?? 0) === 1 ? "" : "s"} in total</p>
              </div>
              <div className="bg-hotel-white border border-hotel-black/10 p-8 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-2">Total Spent</p>
                <h2 className="font-serif text-4xl text-hotel-gold">₹{(stats?.totalSpend ?? 0).toLocaleString("en-IN")}</h2>
                <p className="text-xs text-hotel-black/40 mt-2">From your settled bills</p>
              </div>
              <div className="bg-hotel-white border border-hotel-black/10 p-8 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-2">Last Stay</p>
                <h2 className="font-serif text-2xl text-hotel-black">{stats?.lastStay ? format(new Date(stats.lastStay), "dd MMM yyyy") : "—"}</h2>
                <Link to="/customer/bookings" className="text-xs text-hotel-gold mt-2 hover:underline">View my bookings →</Link>
              </div>
            </div>

            {transactions.length > 0 ? (
              <div className="bg-hotel-white border border-hotel-black/10 p-8">
                <h3 className="font-serif text-2xl text-hotel-black mb-6">Points Activity</h3>
                <div className="divide-y divide-hotel-black/10">
                  {transactions.map((tx: any) => (
                    <div key={tx._id} className="py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-hotel-black">{tx.description || tx.type}</p>
                        <p className="text-xs text-hotel-black/50 mt-1">{format(new Date(tx.date || tx.createdAt), "dd MMM yyyy")}</p>
                      </div>
                      <div className={`font-serif text-xl ${tx.points > 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.points > 0 ? "+" : ""}{tx.points}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-hotel-white border border-hotel-black/10 p-8 text-center">
                <Clock size={28} className="mx-auto text-hotel-black/20 mb-3" />
                <p className="text-hotel-black/60">We don't run a points programme yet. For returning-guest offers, ask the front desk or check Offers on our website.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
