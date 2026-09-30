import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";

export default function AdminDaySalesSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ["day-summary"],
    queryFn: async () => {
      const res = await api.get("/reports/day-summary");
      return res.data.data;
    },
    refetchInterval: 5000, // Live auto-sync
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-hotel-gold" />
      </div>
    );
  }

  if (!data) return null;

  const { page1, page2 } = data;

  return (
    <div className="space-y-4 p-2 bg-white min-h-screen">
      {/* Hide controls when printing */}
      <div className="flex justify-between items-center mb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-serif text-hotel-black">YES HOTELS — Day Sales Summary</h1>
          <p className="text-muted-foreground text-sm">Real-time daily closing report mimicking the physical format.</p>
        </div>
        <Button onClick={handlePrint} className="bg-hotel-gold hover:bg-yellow-600 text-white">
          <Printer className="mr-2 h-4 w-4" /> Print Report
        </Button>
      </div>

      <div className="print:m-0 print:p-0">
        
        {/* PAGE 1 */}
        <div className="page-break-after print:min-h-screen">
          <div className="flex justify-between items-end mb-4 border-b-2 border-hotel-black pb-2">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-widest text-hotel-black">YES HOTELS</h1>
              <h2 className="text-xl font-semibold mt-1">YH - Day Sales Summary</h2>
            </div>
            <div className="text-right flex gap-4">
              <p className="font-semibold">Day: {format(new Date(data.date), "EEEE")}</p>
              <p className="font-semibold">Date: {format(new Date(data.date), "dd-MM-yyyy")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            {/* Left Column */}
            <div className="space-y-6">
              <table className="w-full border-collapse border border-gray-400">
                <tbody>
                  <tr><th colSpan={2} className="border border-gray-400 bg-gray-100 p-1 text-left">Rooms</th></tr>
                  <tr><td className="border border-gray-400 p-1">Check In</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.rooms.checkIn}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Check Out</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.rooms.checkOut}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Day Use</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.rooms.dayUse}</td></tr>
                  
                  <tr><th colSpan={2} className="border border-gray-400 bg-gray-100 p-1 text-left mt-4">Occupancy</th></tr>
                  <tr><td className="border border-gray-400 p-1">Room</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.occupancy.room}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Pax</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.occupancy.pax}</td></tr>
                  
                  <tr><th colSpan={2} className="border border-gray-400 bg-gray-100 p-1 text-left mt-4">Status</th></tr>
                  <tr><td className="border border-gray-400 p-1">Cancelled</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.status.cancelled}</td></tr>
                  <tr><td className="border border-gray-400 p-1">No Show</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.status.noShow}</td></tr>
                  <tr><td className="border border-gray-400 p-1">No. of Inquiry</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.status.noOfInquiry}</td></tr>
                  
                  <tr><th colSpan={2} className="border border-gray-400 bg-gray-100 p-1 text-left mt-4">Through</th></tr>
                  <tr><td className="border border-gray-400 p-1">Walkin</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.through.walkin}</td></tr>
                  <tr><td className="border border-gray-400 p-1">OTA</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.through.ota}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Agency</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.through.agency}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Auto</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.through.auto}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <table className="w-full border-collapse border border-gray-400">
                <tbody>
                  <tr><th colSpan={2} className="border border-gray-400 bg-gray-100 p-1 text-left">Receipts</th></tr>
                  <tr><td className="border border-gray-400 p-1">Resrv. Adv.</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.receipts.resrvAdv}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Room Adv.</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.receipts.roomAdv}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Partial</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.receipts.partial}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Final</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.receipts.final}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Adv. Adjd.</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.receipts.advAdjd}</td></tr>
                  
                  <tr><th colSpan={2} className="border border-gray-400 bg-gray-100 p-1 text-left mt-4">Mode</th></tr>
                  <tr><td className="border border-gray-400 p-1">Cash</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.modes.CASH || 0}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Paytm</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.modes.PAYTM || 0}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Card</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.modes.CARD || 0}</td></tr>
                  <tr><td className="border border-gray-400 p-1">HDFC</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.modes.HDFC || 0}</td></tr>
                  <tr><td className="border border-gray-400 p-1">UPI</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.modes.UPI || 0}</td></tr>
                  <tr><td className="border border-gray-400 p-1">OTA Credit</td><td className="border border-gray-400 p-1 font-mono text-right">{page1.modes.OTA_CREDIT || 0}</td></tr>
                  <tr><td className="border border-gray-400 p-1">Credits</td><td className="border border-gray-400 p-1 font-mono text-right">0</td></tr>
                  <tr><td className="border border-gray-400 p-1">Misc. Sales Room</td><td className="border border-gray-400 p-1 font-mono text-right">0</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-between mt-24 text-sm font-semibold">
            <div>Night Auditor</div>
            <div>Page 1 of 2</div>
          </div>
        </div>

        {/* PAGE 2 */}
        <div className="print:min-h-screen pt-8 print:pt-0">
          <div className="flex justify-between items-end mb-4 border-b-2 border-hotel-black pb-2">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-widest text-hotel-black">YES HOTELS</h1>
              <h2 className="text-xl font-semibold mt-1">CASH Sheet</h2>
            </div>
            <div className="text-right flex gap-4">
              <p className="font-semibold">Day: {format(new Date(data.date), "EEEE")}</p>
              <p className="font-semibold">Date: {format(new Date(data.date), "dd-MM-yyyy")}</p>
            </div>
          </div>

          <div className="flex justify-between mb-4 font-semibold text-sm">
            <div>Opening Balance (B/d): ₹{page2.openingBalance}</div>
            <div>Today Cash Inward: ₹{page2.todayCashInward}</div>
          </div>

          <table className="w-full text-sm border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 w-16">S. No.</th>
                <th className="border border-gray-400 p-2 text-left">Party</th>
                <th className="border border-gray-400 p-2 text-left">Description</th>
                <th className="border border-gray-400 p-2 text-right">Debit</th>
                <th className="border border-gray-400 p-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => {
                const tx = page2.transactions[i];
                return (
                  <tr key={i} className="h-8">
                    <td className="border border-gray-400 p-2 text-center">{i + 1}</td>
                    <td className="border border-gray-400 p-2">{tx?.party || ""}</td>
                    <td className="border border-gray-400 p-2">{tx?.description || ""}</td>
                    <td className="border border-gray-400 p-2 text-right">{tx?.debit ? `₹${tx.debit}` : ""}</td>
                    <td className="border border-gray-400 p-2 text-right font-mono">{tx?.credit ? `₹${tx.credit}` : ""}</td>
                  </tr>
                );
              })}
              <tr className="font-bold bg-gray-50">
                <td colSpan={3} className="border border-gray-400 p-2 text-right">Total</td>
                <td className="border border-gray-400 p-2 text-right">₹0</td>
                <td className="border border-gray-400 p-2 text-right">₹{page2.total}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={4} className="border border-gray-400 p-2 text-right">Closing Balance (C/f)</td>
                <td className="border border-gray-400 p-2 text-right">₹{page2.closingBalance}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8">
            <p className="font-semibold text-sm mb-16">Remarks, If any:</p>
          </div>

          <div className="flex justify-between mt-12 text-sm font-semibold">
            <div>Night Auditor</div>
            <div>Page 2 of 2</div>
          </div>
        </div>

      </div>
      
      <style>{`
        @media print {
          @page { size: portrait; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .page-break-after { page-break-after: always; }
        }
      `}</style>
    </div>
  );
}
