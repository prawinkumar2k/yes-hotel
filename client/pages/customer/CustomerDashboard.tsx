import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, BedDouble, CreditCard, LogOut, User, ChevronRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-green-100 text-green-800",
  CHECKED_OUT: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

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

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const upcoming = bookings?.filter((b: any) => ["CONFIRMED", "PENDING"].includes(b.status)) ?? [];
  const past = bookings?.filter((b: any) => b.status === "CHECKED_OUT") ?? [];

  return (
    <div className="min-h-screen bg-hotel-ivory">
      {/* Header */}
      <div className="bg-hotel-black text-hotel-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-serif text-xl tracking-widest uppercase text-hotel-gold">YES HOTELS</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-hotel-white/70">Hello, {user?.firstName}</span>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-hotel-white/70 hover:text-hotel-gold transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Welcome */}
        <h1 className="font-serif text-3xl text-hotel-black mb-2">Welcome back, {user?.firstName}.</h1>
        <p className="text-hotel-black/60 mb-10">Manage your bookings and profile below.</p>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {[
            { label: "Upcoming Stays", value: upcoming.length, icon: CalendarDays, color: "text-hotel-gold" },
            { label: "Total Bookings", value: bookings?.length ?? 0, icon: BedDouble, color: "text-hotel-black" },
            { label: "Past Stays", value: past.length, icon: CreditCard, color: "text-hotel-black/60" },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={reducedMotion ? undefined : { y: -3 }}
              className="bg-hotel-white border border-hotel-black/10 p-6 flex items-center gap-4"
            >
              <Icon size={28} className={color} />
              <div>
                <p className="text-2xl font-serif text-hotel-black">{value}</p>
                <p className="text-sm text-hotel-black/60">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {[
            { label: "My Bookings", to: "/customer/bookings", desc: "View and manage all your reservations" },
            { label: "My Profile", to: "/customer/profile", desc: "Update your personal information" },
            { label: "Payment History", to: "/customer/payments", desc: "Track all your payments and invoices" },
            { label: "My Reviews", to: "/customer/reviews", desc: "Leave reviews for your completed stays" },
          ].map(({ label, to, desc }) => (
            <Link key={to} to={to} className="bg-hotel-white border border-hotel-black/10 p-6 flex items-center justify-between hover:border-hotel-gold transition-colors group">
              <div>
                <p className="font-medium text-hotel-black">{label}</p>
                <p className="text-sm text-hotel-black/50 mt-1">{desc}</p>
              </div>
              <ChevronRight size={18} className="text-hotel-black/30 group-hover:text-hotel-gold transition-colors" />
            </Link>
          ))}
        </div>

        {/* Recent bookings */}
        <h2 className="font-serif text-xl text-hotel-black mb-4">Recent Bookings</h2>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-hotel-black/5" />)}
          </div>
        ) : bookings?.length === 0 ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-10 text-center">
            <BedDouble size={32} className="mx-auto text-hotel-black/20 mb-3" />
            <p className="text-hotel-black/50">No bookings yet.</p>
            <Link to="/rooms" className="mt-4 inline-block text-hotel-gold hover:underline text-sm">Explore Rooms →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings?.slice(0, 5).map((b: any) => (
              <Link to={`/customer/bookings/${b._id}`} key={b._id}
                className="bg-hotel-white border border-hotel-black/10 p-5 flex items-center justify-between hover:border-hotel-gold transition-colors group">
                <div>
                  <p className="font-medium text-hotel-black">{b.bookingReference}</p>
                  <p className="text-sm text-hotel-black/50">{new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()}</p>
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
