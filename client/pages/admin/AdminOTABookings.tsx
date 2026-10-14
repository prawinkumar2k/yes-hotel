import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Search, ChevronRight, ChevronLeft, Globe } from "lucide-react";
import { format } from "date-fns";

export default function AdminOTABookings() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["adminOTABookings", page, search],
    queryFn: async () => {
      // 50 per page since they want to see all details easily
      const params = new URLSearchParams({ page: String(page), limit: "50", source: "OTA" });
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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <Globe className="text-hotel-gold" /> OTA Bookings Ledger
          </h1>
          <p className="text-sm text-gray-500">OTA reservations entered by the desk from the OTA voucher / extranet (nothing is fetched online)</p>
        </div>
        <Link to="/admin/guest-registration?source=OTA" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm">+ New OTA Booking</Link>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 gap-2 flex-1 min-w-[300px]">
          <Search size={16} className="text-gray-400" />
          <input
            type="text" 
            placeholder="Search by OTA Booking ID, Guest Name..."
            className="text-sm bg-transparent focus:outline-none flex-1"
            value={search} 
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">S.No</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Booking ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Booking Date</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">OTA Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Guest Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Check-In</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Check-Out</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wide">Advance Paid</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wide">Tariff</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wide">GST</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wide">Commission</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wide">Net Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array(5).fill(0).map((_,i) => (
                  <tr key={i}>
                    {Array(10).fill(0).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-400">No OTA bookings found.</td></tr>
              ) : (
                bookings.map((b: any, idx: number) => {
                  const tariff = b.totalAmount - b.taxAmount;
                  return (
                    <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{(page - 1) * 50 + idx + 1}</td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/bookings/${b._id}`} className="font-mono font-medium text-hotel-gold hover:underline">
                          {b.bookingReference}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(b.createdAt), "dd MMM yyyy, HH:mm")}</td>
                      <td className="px-4 py-3 font-medium text-blue-700 bg-blue-50/50 rounded">{b.otaName || "External OTA"}{b.otaConfirmationNumber ? <span className="block text-[11px] font-mono text-gray-500">{b.otaConfirmationNumber}</span> : null}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(b.checkInDate), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(b.checkOutDate), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                          b.status === "CHECKED_IN" ? "bg-emerald-100 text-emerald-700" :
                          b.status === "CHECKED_OUT" ? "bg-purple-100 text-purple-700" :
                          b.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                          b.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {b.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">₹{(b.paidAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{(tariff || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right text-gray-500">₹{(b.taxAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">₹{(b.totalAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {b.otaCommissionPercent != null ? <>₹{(b.otaCommissionAmount || 0).toLocaleString("en-IN")} <span className="text-gray-400">({b.otaCommissionPercent}%)</span></> : <span className="text-amber-600">Terms missing</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {b.otaPaymentModel === "OTA_PREPAID"
                          ? <span title="Guest prepaid the OTA; the OTA owes the hotel">OTA owes ₹{(b.otaReceivable || 0).toLocaleString("en-IN")}</span>
                          : b.otaPaymentModel === "PAY_AT_HOTEL"
                            ? <span title="Guest pays the hotel; the hotel owes the OTA its commission">Hotel owes ₹{(b.otaPayable || 0).toLocaleString("en-IN")}</span>
                            : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-500">Page {page} of {data?.totalPages ?? 1}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white hover:border-hotel-gold transition-colors shadow-sm bg-white">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setPage(p => p+1)} disabled={page >= (data?.totalPages ?? 1)}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white hover:border-hotel-gold transition-colors shadow-sm bg-white">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
