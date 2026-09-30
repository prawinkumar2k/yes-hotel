import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import Footer from "@/components/hotel/Footer";
import { Award, Star, Clock } from "lucide-react";
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

  const guest = data?.data?.guest;
  const transactions = data?.data?.loyaltyTransactions || [];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "PLATINUM": return "text-gray-900 bg-gray-200 border-gray-400";
      case "GOLD": return "text-yellow-800 bg-yellow-100 border-yellow-400";
      case "SILVER": return "text-slate-700 bg-slate-200 border-slate-400";
      default: return "text-hotel-black/70 bg-hotel-black/5 border-hotel-black/20";
    }
  };

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl text-hotel-black mb-2">My Loyalty Rewards</h1>
            <p className="text-hotel-black/60">Manage your points, tier, and exclusive benefits.</p>
          </div>
          <Award className="text-hotel-gold hidden sm:block" size={48} />
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-40 bg-hotel-black/5" />
            <div className="h-64 bg-hotel-black/5" />
          </div>
        ) : !guest ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-12 text-center">
            <Star size={40} className="mx-auto text-hotel-black/20 mb-4" />
            <p className="text-hotel-black/50">Your loyalty profile is not available yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-hotel-black text-hotel-white p-8 border border-hotel-gold/30">
                <p className="text-xs uppercase tracking-widest text-hotel-gold mb-2">Current Tier</p>
                <h2 className="font-serif text-4xl mb-4">{guest.loyaltyTier}</h2>
                <span className={`inline-block text-xs uppercase tracking-widest px-3 py-1 border ${getTierColor(guest.loyaltyTier)}`}>
                  Active Member
                </span>
              </div>
              <div className="bg-hotel-white border border-hotel-black/10 p-8 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-2">Available Points</p>
                <h2 className="font-serif text-4xl text-hotel-gold">{guest.loyaltyPoints?.toLocaleString()}</h2>
                <p className="text-xs text-hotel-black/40 mt-2">Redeemable for stays and dining.</p>
              </div>
              <div className="bg-hotel-white border border-hotel-black/10 p-8 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-widest text-hotel-black/50 mb-2">Total Stays</p>
                <h2 className="font-serif text-4xl text-hotel-black">{guest.totalBookings || 0}</h2>
                <p className="text-xs text-hotel-black/40 mt-2">Total spend: ₹{(guest.totalSpend || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-hotel-white border border-hotel-black/10 p-8">
              <h3 className="font-serif text-2xl text-hotel-black mb-6">Recent Activity</h3>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={32} className="mx-auto text-hotel-black/20 mb-4" />
                  <p className="text-hotel-black/50">No loyalty points activity recorded yet.</p>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
