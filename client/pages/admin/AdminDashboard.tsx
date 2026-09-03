import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: !!user,
  });

  const { data: recentBookings, isLoading: loadingRecent } = useQuery({
    queryKey: ["adminRecentBookings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bookings?limit=5", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data.bookings : [];
    },
    enabled: !!user,
  });

  const METRIC_CARDS = [
    { label: "Total Bookings", value: stats?.totalBookings ?? "—", color: "border-l-hotel-gold" },
    { label: "Today's Arrivals", value: stats?.todayArrivals ?? "—", color: "border-l-blue-400" },
    { label: "Today's Departures", value: stats?.todayDepartures ?? "—", color: "border-l-purple-400" },
    { label: "Occupied Rooms", value: stats?.occupiedRooms ?? "—", color: "border-l-green-400" },
    { label: "Available Rooms", value: stats?.availableRooms ?? "—", color: "border-l-emerald-400" },
    { label: "Pending Payments", value: stats?.pendingPayments ?? "—", color: "border-l-orange-400" },
    { label: "Revenue Today", value: stats?.revenueToday ? `₹${stats.revenueToday}` : "—", color: "border-l-hotel-gold" },
    { label: "Monthly Revenue", value: stats?.revenueMonth ? `₹${stats.revenueMonth}` : "—", color: "border-l-amber-400" },
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {METRIC_CARDS.map(({ label, value, color }) => (
          <div key={label} className={`bg-white border-l-4 ${color} rounded-r p-5 shadow-sm`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "New Booking", to: "/admin/bookings", color: "bg-hotel-gold hover:bg-yellow-500" },
          { label: "Check-In Guest", to: "/admin/check-in", color: "bg-green-600 hover:bg-green-700" },
          { label: "Check-Out Guest", to: "/admin/check-out", color: "bg-blue-600 hover:bg-blue-700" },
          { label: "Housekeeping", to: "/admin/housekeeping", color: "bg-purple-600 hover:bg-purple-700" },
        ].map(({ label, to, color }) => (
          <Link key={to} to={to} className={`${color} text-white px-5 py-3 rounded text-sm font-medium text-center transition-colors`}>
            {label}
          </Link>
        ))}
      </div>

      {/* Recent bookings table */}
      <div className="bg-white rounded shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Recent Bookings</h2>
          <Link to="/admin/bookings" className="text-sm text-hotel-gold hover:underline">View all →</Link>
        </div>
        {loadingRecent ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></div>
        ) : recentBookings?.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
            No bookings yet.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <tbody className="divide-y">
              {recentBookings?.map((b: any) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link to={`/admin/bookings/${b._id}`} className="font-medium text-hotel-black hover:text-hotel-gold">
                      {b.bookingReference}
                    </Link>
                    <div className="text-xs text-gray-500">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</div>
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {format(new Date(b.checkInDate), "MMM d")} – {format(new Date(b.checkOutDate), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant="outline">{b.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right font-medium">₹{b.totalAmount?.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
