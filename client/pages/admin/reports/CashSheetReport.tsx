import { useState } from "react";
import { getStoredAuthToken } from "@/lib/authStorage";
import { useQuery } from "@tanstack/react-query";
import { todayBusinessDate } from "@shared/dates";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { usePrintLayout } from "@/lib/usePrintLayout";

export default function CashSheetReport() {
  usePrintLayout("portrait");
  const [date, setDate] = useState(todayBusinessDate());

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

  const formatAmount = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '';
    return num.toFixed(2);
  };

  // Ensure we always have 10 rows for the exact format
  const sourceTable = data?.table || [];
  const tableRows = sourceTable.map((t: any, i: number) => ({
    sNo: i + 1,
    party: t.Reference || '',
    description: t.Purpose || '',
    debit: t.Amount != null ? formatAmount(t.Amount) : '',
    credit: ''
  }));
  const displayRows = [...tableRows];
  while (displayRows.length < 10) {
    displayRows.push({ sNo: displayRows.length + 1, party: '', description: '', debit: '', credit: '' });
  }

  const rawCashInward = data?.kpis?.TotalCashVolume ?? 0;
  const cashInward = formatAmount(rawCashInward);
  const totalDebit = cashInward;
  const totalCredit = cashInward; // Matches because closing balance is inserted on credit side
  const closingBalance = cashInward;

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
      <div 
        className="print:m-0 p-6 border-2 border-gray-900 text-black text-sm bg-white print:border-2 print:border-black" 
        style={{ fontFamily: "Inter, 'Segoe UI', Arial, sans-serif" }}
      >
        <div className="flex items-start justify-between gap-4 mb-5 border-b-2 border-gray-900 pb-3">
          <div className="flex items-center gap-3">
            <img src="/brand/yes-hotels-logo-sm.png" alt="" className="h-14 w-auto" />
            <div className="text-[10px] leading-snug"><HotelDocAddress withEmailAndWeb={false} /></div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold uppercase tracking-wide">Cash Sheet</div>
            <div className="text-xs">{new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center tabular-nums">Loading Data...</div>
        ) : (
          <div>
            <table className="w-full mb-8 border-collapse table-fixed">
              <thead>
                <tr className="border-b-2 border-gray-900 font-bold">
                  <th className="py-2 text-left w-16">S. No.</th>
                  <th className="py-2 text-left w-1/3">Party</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right w-28">Debit</th>
                  <th className="py-2 text-right w-28">Credit</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 text-left tabular-nums">{row.sNo || index + 1}</td>
                    <td className="py-2 text-left truncate">{row.party}</td>
                    <td className="py-2 text-left truncate">{row.description}</td>
                    <td className="py-2 text-right tabular-nums">{row.debit}</td>
                    <td className="py-2 text-right tabular-nums">{row.credit}</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="border-b border-gray-900 font-bold">
                  <td className="py-2"></td>
                  <td className="py-2">Total</td>
                  <td className="py-2"></td>
                  <td className="py-2 text-right tabular-nums">{totalDebit}</td>
                  <td className="py-2 text-right tabular-nums">{totalCredit}</td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 mb-12">
              <div>
                <table className="w-full table-fixed border-collapse">
                  <tbody>
                    <tr>
                      <td className="py-2 font-bold w-48 text-left">Opening Balance (B/d)</td>
                      <td className="py-2 border-b border-gray-400 tabular-nums text-right">0.00</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold w-48 text-left">Today Cash Inward</td>
                      <td className="py-2 border-b border-gray-400 tabular-nums text-right">{cashInward}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold w-48 text-left">Closing Balance (C/f)</td>
                      <td className="py-2 border-b border-gray-400 tabular-nums text-right">{closingBalance}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div>
                <div className="font-bold mb-2">Remarks, If any</div>
                <div className="border border-gray-400 h-24 p-2 w-full tabular-nums text-sm">{data?.remarks || ''}</div>
              </div>
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
        )}
      </div>
    </div>
  );
}
