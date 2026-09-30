import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function DaySummaryTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports-day-summary"],
    queryFn: async () => {
      const res = await api.get("/reports/day-summary");
      return res.data;
    },
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-hotel-gold" /></div>;
  if (error) return <div className="text-red-500 p-4">Failed to load day summary</div>;

  const d = data?.data;
  if (!d) return <div className="p-4 text-gray-500">No data available</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-8 max-w-4xl mx-auto text-sm">
      <div className="text-center border-b pb-4 mb-6">
        <h2 className="text-2xl font-serif text-hotel-black">YH - Day Sales Summary</h2>
        <p className="text-gray-500">
          Day: {format(new Date(), "EEEE")} &nbsp; | &nbsp; Date: {format(new Date(), "dd/MM/yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Left Column */}
        <div className="space-y-6">
          <table className="w-full text-left border">
            <tbody>
              <tr className="border-b bg-gray-50"><th className="p-2 w-1/2">Rooms</th><th className="p-2">{d.totalRooms}</th></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Check In</td><td className="p-2">{d.checkIns}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Check Out</td><td className="p-2">{d.checkOuts}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Day Use</td><td className="p-2">{d.dayUses}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Occupied Room</td><td className="p-2">{d.occupiedRooms}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Pax</td><td className="p-2">{d.totalPax}</td></tr>
            </tbody>
          </table>

          <table className="w-full text-left border">
            <tbody>
              <tr className="border-b bg-gray-50"><th className="p-2 w-1/2">Status</th><th className="p-2">Count</th></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Cancelled</td><td className="p-2">{d.cancelled}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">No Show</td><td className="p-2">{d.noShows}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">No. of Inquiry</td><td className="p-2">{d.inquiries || 0}</td></tr>
            </tbody>
          </table>

          <table className="w-full text-left border">
            <tbody>
              <tr className="border-b bg-gray-50"><th className="p-2 w-1/2">Through</th><th className="p-2">Count</th></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Walkin</td><td className="p-2">{d.walkins}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Reserved</td><td className="p-2">{d.agencies}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">OTA</td><td className="p-2">{d.otas}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <table className="w-full text-left border">
            <tbody>
              <tr className="border-b bg-gray-50"><th className="p-2 w-1/2">Receipts</th><th className="p-2 font-mono">Amount (₹)</th></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Resrv. Adv.</td><td className="p-2 font-mono">{d.resrvAdv?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Room Adv.</td><td className="p-2 font-mono">{d.roomAdv?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Partial</td><td className="p-2 font-mono">{d.partial?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Final</td><td className="p-2 font-mono">{d.final?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Adv. Adjd.</td><td className="p-2 font-mono">{d.advAdjd?.toLocaleString("en-IN")}</td></tr>
            </tbody>
          </table>

          <table className="w-full text-left border">
            <tbody>
              <tr className="border-b bg-gray-50"><th className="p-2 w-1/2">Mode</th><th className="p-2 font-mono">Amount (₹)</th></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Cash</td><td className="p-2 font-mono">{d.paymentModes?.CASH?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Paytm</td><td className="p-2 font-mono">{d.paymentModes?.PAYTM?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">HDFC UPI</td><td className="p-2 font-mono">{d.paymentModes?.UPI?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Card</td><td className="p-2 font-mono">{d.paymentModes?.CARD?.toLocaleString("en-IN")}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">OTA Credit</td><td className="p-2 font-mono">{d.paymentModes?.OTA_CREDIT?.toLocaleString("en-IN")}</td></tr>
            </tbody>
          </table>
          
          <table className="w-full text-left border">
            <tbody>
              <tr className="border-b bg-gray-50"><th className="p-2 w-1/2">Credits</th><th className="p-2 font-mono">Amount (₹)</th></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Sales Room</td><td className="p-2 font-mono">{d.salesRoom?.toLocaleString("en-IN") || 0}</td></tr>
              <tr className="border-b"><td className="p-2 text-gray-600">Misc.</td><td className="p-2 font-mono">{d.misc?.toLocaleString("en-IN") || 0}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-8 border-t pt-4 text-xs text-gray-400 flex justify-between">
        <span>Prepared by: Night Auditor</span>
        <span>Page 1 of 2</span>
      </div>
    </div>
  );
}
