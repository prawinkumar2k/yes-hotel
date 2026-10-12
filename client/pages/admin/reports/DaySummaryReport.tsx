import { useState } from "react";
import { getStoredAuthToken } from "@/lib/authStorage";
import { useQuery } from "@tanstack/react-query";

const formatAmount = (val: any) => {
  if (val === undefined || val === null || val === "") return "0.00";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
};

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
    <div className="bg-white p-4 sm:p-8 rounded shadow-sm border border-gray-200 overflow-x-auto w-full max-w-4xl mx-auto">
      {/* Header controls (not part of print) */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">Daily Hotel Summary</h2>
        <div className="flex gap-2">
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:ring-hotel-gold outline-none"
          />
          <button 
            onClick={() => window.print()}
            className="bg-[#c9a227] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-yellow-600 transition shadow-sm"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* PAGE 1 - DAILY HOTEL SUMMARY */}
      <div 
        className="print:m-0 p-6 border-2 border-gray-900 text-black text-sm bg-white print:border-2 print:border-black" 
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        <div className="flex justify-between items-center mb-4 border-b-2 border-gray-900 pb-2 font-bold">
          <div className="text-base tracking-wide">YH - Day Sales Summary</div>
          <div>Day: {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div>Date: {date}</div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center font-bold">Loading Data...</div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Rooms Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Rooms</td>
                    <td className="py-1 w-5/12 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Check In</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.checkIn ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Check Out</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.checkOut ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Day Use</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.dayUse ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Occupancy Room</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.occupancy ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Pax</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.pax ?? 0}</td>
                  </tr>
                </tbody>
              </table>

              {/* Status Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Status</td>
                    <td className="py-1 w-5/12 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Cancelled</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.cancelled ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">No Show</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.noShow ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">No. of Inquiry</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.inquiries ?? 0}</td>
                  </tr>
                </tbody>
              </table>

              {/* Reserved Through Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Reserved Through</td>
                    <td className="py-1 w-5/12 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Walkin</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.walkin ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">OTA (Total)</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.ota ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-700 text-left">- Agoda</td>
                    <td className="py-1 text-right text-xs font-mono border-b border-gray-300">{data?.otaAgoda ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-700 text-left">- MakeMyTrip (MMT)</td>
                    <td className="py-1 text-right text-xs font-mono border-b border-gray-300">{data?.otaMmt ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-700 text-left">- Booking.com</td>
                    <td className="py-1 text-right text-xs font-mono border-b border-gray-300">{data?.otaBooking ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-8 text-xs text-gray-700 text-left">- Goibibo</td>
                    <td className="py-1 text-right text-xs font-mono border-b border-gray-300">{data?.otaGoibibo ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Agency</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.agency ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Auto</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{data?.auto ?? 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Receipts Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Receipts</td>
                    <td className="py-1 w-5/12 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Resrv. Adv.</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.resrvAdv)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Room Adv.</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.roomAdv)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Partial</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.partial)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Final</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.final)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Adv. Adjd.</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.advAdjd)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Mode Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Mode</td>
                    <td className="py-1 w-5/12 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Cash</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.cash)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Paytm Card</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.paytm)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">HDFC UPI</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.hdfcUpi)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">OTA Credit</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.otaCredit)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Sales Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Sales</td>
                    <td className="py-1 w-5/12 text-right"></td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Room</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.roomSales)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4 text-left">Misc.</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.miscSales)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Credits Section */}
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-b border-gray-900">
                    <td className="font-bold py-1 w-7/12 text-left">Credits</td>
                    <td className="py-1 text-right font-mono border-b border-gray-300">{formatAmount(data?.credits)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between items-end pt-8 border-t-2 border-gray-900">
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
      <div 
        className="print:m-0 mt-8 p-6 border-2 border-gray-900 text-black text-sm bg-white print:break-before-page print:border-2 print:border-black" 
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        <div className="flex justify-between items-center mb-4 border-b-2 border-gray-900 pb-2 font-bold">
          <div className="text-base tracking-wide">CASH Sheet</div>
          <div>Day: {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div>Date: {date}</div>
        </div>

        <table className="w-full mb-8 border-collapse table-fixed">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="py-2 text-left w-16">S. No.</th>
              <th className="py-2 text-left w-1/3">Party</th>
              <th className="py-2 text-left">Description</th>
              <th className="py-2 text-right w-28">Debit</th>
              <th className="py-2 text-right w-28">Credit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 font-bold">Opening Balance (B/d)</td>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 text-right font-mono">0.00</td>
              <td className="py-2 border-b border-gray-300 text-right font-mono"></td>
            </tr>
            <tr>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 font-bold">Today Cash Inward</td>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 text-right font-mono">{formatAmount(data?.cash)}</td>
              <td className="py-2 border-b border-gray-300 text-right font-mono"></td>
            </tr>
            {/* Blank rows 1 to 10 */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <tr key={num}>
                <td className="py-2 border-b border-gray-200 font-mono">{num}</td>
                <td className="py-2 border-b border-gray-200"></td>
                <td className="py-2 border-b border-gray-200"></td>
                <td className="py-2 border-b border-gray-200 font-mono text-right"></td>
                <td className="py-2 border-b border-gray-200 font-mono text-right"></td>
              </tr>
            ))}
            <tr>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 font-bold">Total</td>
              <td className="py-2 border-b border-gray-300"></td>
              <td className="py-2 border-b border-gray-300 text-right font-mono">{formatAmount(data?.cash)}</td>
              <td className="py-2 border-b border-gray-300 text-right font-mono">{formatAmount(data?.cash)}</td>
            </tr>
            <tr>
              <td className="py-2 border-b-2 border-gray-900"></td>
              <td className="py-2 border-b-2 border-gray-900 font-bold">Closing Balance (C/f)</td>
              <td className="py-2 border-b-2 border-gray-900"></td>
              <td className="py-2 border-b-2 border-gray-900 text-right font-mono"></td>
              <td className="py-2 border-b-2 border-gray-900 text-right font-mono">{formatAmount(data?.cash)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mb-12">
          <div className="font-bold mb-8">Remarks, If any</div>
          <div className="border-b border-gray-400 w-full mb-8"></div>
          <div className="border-b border-gray-400 w-full"></div>
        </div>

        <div className="flex justify-between items-end pt-8 border-t-2 border-gray-900">
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
