import { useState } from "react";
import { getStoredAuthToken } from "@/lib/authStorage";
import { useQuery } from "@tanstack/react-query";

export default function DaySummaryReport() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["report", "day-summary", date],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/reports/day-summary?date=${date}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      return json.success ? json.data : null;
    }
  });


  return (
    <div className="bg-white p-8 rounded shadow-sm border border-gray-200 overflow-x-auto w-full max-w-4xl mx-auto">
      {/* Header controls (not part of print) */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">Daily Hotel Summary</h2>
        <div className="flex gap-2">
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="border-gray-300 rounded text-sm px-3 py-1.5 focus:ring-hotel-gold"
          />
          <button 
            onClick={() => window.print()}
            className="bg-hotel-gold text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-yellow-600 transition"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Printable Area - EXACT FORMAT */}
      <div className="print:m-0 p-4 border-2 border-gray-800 text-black text-sm bg-white" style={{ fontFamily: 'monospace' }}>
        <div className="flex justify-between mb-4 border-b-2 border-gray-800 pb-2">
          <div className="font-bold">YH - Day Sales Summary</div>
          <div>Day: {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div>Date: {date}</div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">Loading Data...</div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column */}
            <div>
              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Rooms</td>
                    <td className="py-1 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Check In</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.checkIn || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Check Out</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.checkOut || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Day Use</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.dayUse || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Occupancy Room</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.occupancy || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Pax</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.pax || 0}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Status</td>
                    <td className="py-1 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Cancelled</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.cancelled || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">No Show</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.noShow || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">No. of Inquiry</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.inquiries || 0}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Reserved Through</td>
                    <td className="py-1 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Walkin</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.walkin || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">OTA (Total)</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.ota || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-600">- Agoda</td>
                    <td className="py-1 text-right text-xs text-gray-600 border-b border-gray-200">{data?.otaAgoda || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-600">- MakeMyTrip (MMT)</td>
                    <td className="py-1 text-right text-xs text-gray-600 border-b border-gray-200">{data?.otaMmt || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-600">- Booking.com</td>
                    <td className="py-1 text-right text-xs text-gray-600 border-b border-gray-200">{data?.otaBooking || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-600">- Goibibo</td>
                    <td className="py-1 text-right text-xs text-gray-600 border-b border-gray-200">{data?.otaGoibibo || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Agency</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.agency || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Auto</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.auto || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Column */}
            <div>
              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Receipts</td>
                    <td className="py-1 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Resrv. Adv.</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.resrvAdv || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Room Adv.</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.roomAdv || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Partial</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.partial || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Final</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.final || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Adv. Adjd.</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.advAdjd || '0.00'}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Mode</td>
                    <td className="py-1 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Cash</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.cash || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Paytm Card</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.paytm || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">HDFC UPI</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.hdfcUpi || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">OTA Credit</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.otaCredit || '0.00'}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Sales</td>
                    <td className="py-1 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Room</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.roomSales || '0.00'}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">Misc.</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.miscSales || '0.00'}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full mb-4">
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold py-1 w-1/2">Credits</td>
                    <td className="py-1 text-right border-b border-gray-300">{data?.credits || '0.00'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between pt-8 border-t-2 border-gray-800">
          <div>
            <div className="border-b border-black w-48 mb-2"></div>
            <div className="text-center font-bold">Night Auditor</div>
          </div>
          <div className="text-right text-xs">
            Page 1 of 2
          </div>
        </div>
      </div>

      {/* PAGE 2 - CASH SHEET */}
      <div className="print:m-0 mt-8 p-4 border-2 border-gray-800 text-black text-sm bg-white print:break-before-page" style={{ fontFamily: 'monospace' }}>
        <div className="flex justify-between mb-4 border-b-2 border-gray-800 pb-2">
          <div className="font-bold">CASH Sheet</div>
          <div>Day: {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div>Date: {date}</div>
        </div>

        <table className="w-full mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="py-2 text-left w-16">S. No.</th>
              <th className="py-2 text-left">Party</th>
              <th className="py-2 text-left">Description</th>
              <th className="py-2 text-right w-32">Debit</th>
              <th className="py-2 text-right w-32">Credit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 font-bold">Opening Balance (B/d)</td>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 text-right">0.00</td>
              <td className="py-2 border-b border-gray-300 text-right"></td>
            </tr>
            <tr>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 font-bold">Today Cash Inward</td>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 text-right"></td>
              <td className="py-2 border-b border-gray-300 text-right">{data?.cash || '0.00'}</td>
            </tr>
            {/* Blank rows 1 to 10 */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <tr key={num}>
                <td className="py-2 border-b border-gray-200">{num}</td>
                <td className="py-2 border-b border-gray-200"></td>
                <td className="py-2 border-b border-gray-200"></td>
                <td className="py-2 border-b border-gray-200"></td>
                <td className="py-2 border-b border-gray-200"></td>
              </tr>
            ))}
            <tr>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 font-bold">Total</td>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 text-right">0.00</td>
              <td className="py-2 border-b border-gray-300 text-right">{data?.cash || '0.00'}</td>
            </tr>
            <tr>
              <td className="py-2 border-b-2 border-gray-800"></td>
              <td className="py-2 border-b-2 border-gray-800 font-bold">Closing Balance (C/f)</td>
              <td className="py-2 border-b-2 border-gray-800"></td>
              <td className="py-2 border-b-2 border-gray-800 text-right">{data?.cash || '0.00'}</td>
              <td className="py-2 border-b-2 border-gray-800 text-right"></td>
            </tr>
          </tbody>
        </table>

        <div className="mb-12">
          <div className="font-bold mb-8">Remarks, If any</div>
          <div className="border-b border-gray-400 w-full mb-8"></div>
          <div className="border-b border-gray-400 w-full"></div>
        </div>

        <div className="flex justify-between pt-8 border-t-2 border-gray-800">
          <div>
            <div className="border-b border-black w-48 mb-2"></div>
            <div className="text-center font-bold">Night Auditor</div>
          </div>
          <div className="text-right text-xs">
            Page 2 of 2
          </div>
        </div>
      </div>
    </div>
  );
}
