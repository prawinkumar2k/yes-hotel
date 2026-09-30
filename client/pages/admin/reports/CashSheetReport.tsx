import { useState } from "react";
import { getStoredAuthToken } from "@/lib/authStorage";
import { useQuery } from "@tanstack/react-query";

export default function CashSheetReport() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["report", "cash-sheet", date],
    queryFn: async () => {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/reports/cash-sheet?date=${date}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      return json.success ? json.data : null;
    }
  });

  // Ensure we always have 10 rows for the exact format
  const tableRows = data?.rows || [];
  const displayRows = [...tableRows];
  while (displayRows.length < 10) {
    displayRows.push({ sNo: displayRows.length + 1, party: '', description: '', debit: '', credit: '' });
  }

  return (
    <div className="bg-white p-8 rounded shadow-sm border border-gray-200 overflow-x-auto w-full max-w-4xl mx-auto">
      {/* Header controls (not part of print) */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">Cash Sheet</h2>
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
        <div className="text-center font-bold text-lg mb-4 underline">CASH Sheet</div>
        
        <div className="flex justify-between mb-4 pb-2">
          <div>Day: {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div>Date: {date}</div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">Loading Data...</div>
        ) : (
          <div>
            <table className="w-full border-collapse border border-gray-800 mb-6">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-100">
                  <th className="border-r border-gray-800 p-2 text-center w-12">S. No.</th>
                  <th className="border-r border-gray-800 p-2 text-left">Party</th>
                  <th className="border-r border-gray-800 p-2 text-left">Description</th>
                  <th className="border-r border-gray-800 p-2 text-right w-32">Debit</th>
                  <th className="p-2 text-right w-32">Credit</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => (
                  <tr key={index} className="border-b border-gray-400">
                    <td className="border-r border-gray-800 p-2 text-center">{row.sNo || index + 1}</td>
                    <td className="border-r border-gray-800 p-2">{row.party}</td>
                    <td className="border-r border-gray-800 p-2">{row.description}</td>
                    <td className="border-r border-gray-800 p-2 text-right">{row.debit}</td>
                    <td className="p-2 text-right">{row.credit}</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="border-b-2 border-t-2 border-gray-800 font-bold">
                  <td colSpan={3} className="border-r border-gray-800 p-2 text-right">Total</td>
                  <td className="border-r border-gray-800 p-2 text-right">{data?.totalDebit || ''}</td>
                  <td className="p-2 text-right">{data?.totalCredit || ''}</td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 mb-12">
              <div>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="py-2 font-bold w-48">Opening Balance (B/d)</td>
                      <td className="py-2 border-b border-gray-400">{data?.openingBalance || ''}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold w-48">Today Cash Inward</td>
                      <td className="py-2 border-b border-gray-400">{data?.cashInward || ''}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold w-48">Closing Balance (C/f)</td>
                      <td className="py-2 border-b border-gray-400">{data?.closingBalance || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div>
                <div className="font-bold mb-2">Remarks, If any</div>
                <div className="border border-gray-400 h-24 p-2 w-full">{data?.remarks || ''}</div>
              </div>
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
        )}
      </div>
    </div>
  );
}
