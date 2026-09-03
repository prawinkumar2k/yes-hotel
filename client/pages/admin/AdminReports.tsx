import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminReports() {
  const [dateFrom, setDateFrom] = useState(toInputDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [dateTo, setDateTo] = useState(toInputDate(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["reports-overview", dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/admin/reports/overview?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      return res.data.data;
    },
  });

  const METRIC_CARDS = data
    ? [
        { label: "Revenue", value: `₹${data.revenue.toLocaleString("en-IN")}`, color: "border-l-hotel-gold" },
        { label: "Paid Bookings", value: data.paidBookingsCount, color: "border-l-green-400" },
        { label: "Total Bookings", value: data.bookingsInRange, color: "border-l-blue-400" },
        { label: "Cancellation Rate", value: `${data.cancellationRate}%`, color: "border-l-red-400" },
        { label: "Occupancy Rate", value: `${data.occupancyRate}%`, color: "border-l-purple-400" },
        { label: "ADR (Avg Daily Rate)", value: `₹${data.adr.toLocaleString("en-IN")}`, color: "border-l-amber-400" },
        { label: "RevPAR", value: `₹${data.revPAR.toLocaleString("en-IN")}`, color: "border-l-emerald-400" },
        { label: "Total Rooms", value: data.totalRooms, color: "border-l-gray-400" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-hotel-black">Reports</h1>
        <p className="text-hotel-black/60">Revenue, occupancy, and performance for a selected date range</p>
      </div>

      <div className="flex gap-4 items-end mb-6">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-hotel-gold" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {METRIC_CARDS.map(({ label, value, color }) => (
              <div key={label} className={`bg-white border-l-4 ${color} rounded-r p-5 shadow-sm`}>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Room Category Performance</h2>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Base Price</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Paid Bookings</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.categoryPerformance?.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">No data for this range</td></tr>
                ) : (
                  data?.categoryPerformance?.map((cat: any) => (
                    <tr key={cat._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-hotel-black">{cat.name}</td>
                      <td className="px-4 py-3 text-gray-500">₹{cat.basePrice?.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">{cat.bookingsCount}</td>
                      <td className="px-4 py-3 font-medium">₹{(cat.revenue ?? 0).toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Showing {data?.range && format(new Date(data.range.from), "MMM d, yyyy")} –{" "}
            {data?.range && format(new Date(data.range.to), "MMM d, yyyy")}
          </p>
        </>
      )}
    </div>
  );
}
