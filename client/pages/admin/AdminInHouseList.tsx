import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function AdminInHouseList() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["in-house-list"],
    queryFn: async () => {
      const res = await api.get("/reports/in-house-list");
      return res.data.data;
    },
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 p-2 bg-white min-h-screen">
      {/* Hide controls when printing */}
      <div className="flex justify-between items-center mb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-serif text-hotel-black">YES HOTELS — Guest In-House List</h1>
          <p className="text-muted-foreground text-sm">Real-time occupancy report exactly matching the physical logbook.</p>
        </div>
        <Button onClick={handlePrint} className="bg-hotel-gold hover:bg-yellow-600 text-white">
          <Printer className="mr-2 h-4 w-4" /> Print Logbook Page
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin h-8 w-8 text-hotel-gold" />
        </div>
      ) : (
        <div className="print:m-0 print:p-0">
          <div className="hidden print:flex justify-between items-end mb-4 border-b-2 border-hotel-black pb-2">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-widest text-hotel-black">YES HOTELS</h1>
              <h2 className="text-xl font-semibold mt-1">Guest In-House List</h2>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">Date: {format(new Date(), "dd-MM-yyyy")}</p>
              <p className="text-sm font-semibold">Day: {format(new Date(), "EEEE")}</p>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-[11px] border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100 print:bg-white text-center font-bold">
                  <th className="border border-gray-400 p-1 w-8">S. No.</th>
                  <th className="border border-gray-400 p-1 w-16">GRC No.</th>
                  <th className="border border-gray-400 p-1 w-12">Room No.</th>
                  <th className="border border-gray-400 p-1 w-32">Guest Name</th>
                  <th className="border border-gray-400 p-1 w-24">Company/Group</th>
                  <th className="border border-gray-400 p-1">Adult/Child/Kids</th>
                  <th className="border border-gray-400 p-1 w-16">Tariff</th>
                  <th className="border border-gray-400 p-1 w-12">Plan</th>
                  <th className="border border-gray-400 p-1">Ex. Bed</th>
                  <th className="border border-gray-400 p-1 w-16">Food Bill</th>
                  <th className="border border-gray-400 p-1 w-20">Checked in</th>
                  <th className="border border-gray-400 p-1 w-20">Check out</th>
                  <th className="border border-gray-400 p-1">No. of Nights</th>
                  <th className="border border-gray-400 p-1 w-16">Advance</th>
                  <th className="border border-gray-400 p-1 w-16">Balance</th>
                  <th className="border border-gray-400 p-1 w-16">Settled</th>
                  <th className="border border-gray-400 p-1 w-20">Payment Mode</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {data.map((row: any, i: number) => (
                  <tr key={row._id} className="hover:bg-gray-50 print:hover:bg-transparent">
                    <td className="border border-gray-400 p-1 font-mono">{i + 1}</td>
                    <td className="border border-gray-400 p-1 font-mono">{row.grcNo}</td>
                    <td className="border border-gray-400 p-1 font-bold">{row.roomNo}</td>
                    <td className="border border-gray-400 p-1 text-left px-2 truncate max-w-[120px]" title={row.guestName}>{row.guestName}</td>
                    <td className="border border-gray-400 p-1 text-left px-2 truncate max-w-[100px]">{row.companyGroup}</td>
                    <td className="border border-gray-400 p-1">{row.adults} / {row.childKids} / 0</td>
                    <td className="border border-gray-400 p-1 text-right px-2">{row.tariff}</td>
                    <td className="border border-gray-400 p-1">{row.plan}</td>
                    <td className="border border-gray-400 p-1">{row.extraBed || "-"}</td>
                    <td className="border border-gray-400 p-1 text-right px-2">{row.foodBill > 0 ? row.foodBill : "-"}</td>
                    <td className="border border-gray-400 p-1">{format(new Date(row.checkedIn), "dd/MM HH:mm")}</td>
                    <td className="border border-gray-400 p-1">{format(new Date(row.checkOut), "dd/MM")}</td>
                    <td className="border border-gray-400 p-1">{row.nights}</td>
                    <td className="border border-gray-400 p-1 text-right px-2">{row.advance > 0 ? row.advance : "-"}</td>
                    <td className="border border-gray-400 p-1 text-right px-2 font-semibold text-red-600 print:text-black">{row.balance > 0 ? row.balance : "-"}</td>
                    <td className="border border-gray-400 p-1 text-right px-2 text-green-600 print:text-black">{row.settled > 0 ? row.settled : "-"}</td>
                    <td className="border border-gray-400 p-1 truncate max-w-[80px]">{row.paymentMode}</td>
                  </tr>
                ))}
                
                {/* Print empty rows to fill the page if less than ~25 rows */}
                {Array.from({ length: Math.max(0, 25 - data.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-7">
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                    <td className="border border-gray-400 p-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="hidden print:flex justify-between mt-12 text-sm">
            <div>Manager Signature</div>
            <div>Front Office Signature</div>
          </div>
        </div>
      )}
      
      {/* Global Print Styles Injection */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
