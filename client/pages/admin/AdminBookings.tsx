import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-green-100 text-green-800",
  CHECKED_OUT: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function AdminBookings() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["adminBookings", page, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (search) params.append("search", search);
      const res = await fetch(`/api/admin/bookings?${params}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data : { bookings: [], totalPages: 1 };
    },
    enabled: !!user,
  });

  const bookings = data?.bookings ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-hotel-black text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/dashboard" className="font-serif text-lg text-hotel-gold uppercase tracking-widest">YES HOTELS</Link>
        <span className="text-white/30">/</span>
        <span className="text-white/70 text-sm">Bookings Management</span>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">All Bookings</h1>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded shadow-sm mb-4 flex flex-wrap gap-4">
          <div className="flex items-center border border-gray-200 rounded px-3 py-2 gap-2 flex-1 min-w-48">
            <Search size={16} className="text-gray-400" />
            <input
              type="text" placeholder="Search by reference, guest name..."
              className="text-sm bg-transparent focus:outline-none flex-1"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-hotel-gold">
            {["ALL","PENDING","CONFIRMED","CHECKED_IN","CHECKED_OUT","CANCELLED"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Reference","Guest","Room Category","Check-In","Check-Out","Amount","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(5).fill(0).map((_,i) => (
                  <tr key={i}>
                    {Array(8).fill(0).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No bookings found.</td></tr>
              ) : (
                bookings.map((b: any) => (
                  <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-800">{b.bookingReference}</td>
                    <td className="px-4 py-3 text-gray-700">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">{b.roomCategory?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(b.checkInDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(b.checkOutDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">₹{b.totalAmount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/bookings/${b._id}`} className="text-hotel-gold hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">Page {page}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="p-2 rounded border border-gray-200 disabled:opacity-40 hover:border-hotel-gold transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => p+1)} disabled={page >= (data?.totalPages ?? 1)}
              className="p-2 rounded border border-gray-200 disabled:opacity-40 hover:border-hotel-gold transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
