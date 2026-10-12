import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Download } from "lucide-react";
import { exportToCSV } from "@/lib/utils";
import { todayBusinessDate } from "@shared/dates";

export default function MonthlyMISTab() {
  const [month, setMonth] = useState(() => todayBusinessDate().slice(0, 7));

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports-monthly-mis", month],
    queryFn: async () => {
      const res = await api.get(`/reports/monthly-mis?month=${month}`);
      return res.data;
    },
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-hotel-gold" /></div>;
  if (error) return <div className="text-red-500 p-4">Failed to load MIS report</div>;

  const rows = data?.data || [];

  // Totals
  const totals = rows.reduce((acc: any, row: any) => {
    acc.cash = (acc.cash || 0) + (row.cash || 0);
    acc.card = (acc.card || 0) + (row.card || 0);
    acc.upi = (acc.upi || 0) + (row.upi || 0);
    acc.paytm = (acc.paytm || 0) + (row.paytm || 0);
    acc.ota = (acc.ota || 0) + (row.ota || 0);
    acc.dayTotal = (acc.dayTotal || 0) + (row.dayTotal || 0);
    acc.expenses = (acc.expenses || 0) + (row.expenses || 0);
    acc.refunds = (acc.refunds || 0) + (row.refunds || 0);
    acc.grandTotal = (acc.grandTotal || 0) + (row.grandTotal || 0);
    return acc;
  }, {});

  const handleExport = () => {
    const csvData = rows.map((r: any) => ({
      Date: r.date,
      Cash: r.cash,
      Card: r.card,
      "Gpay / UPI": r.upi,
      Paytm: r.paytm,
      "OTA Credit": r.ota,
      "Day Total Recd": r.dayTotal,
      Expenses: r.expenses,
      "Refunds / Advance Adjd": r.refunds,
      "Grand Total Net": r.grandTotal,
    }));
    csvData.push({
      Date: "TOTAL",
      Cash: totals.cash,
      Card: totals.card,
      "Gpay / UPI": totals.upi,
      Paytm: totals.paytm,
      "OTA Credit": totals.ota,
      "Day Total Recd": totals.dayTotal,
      Expenses: totals.expenses,
      "Refunds / Advance Adjd": totals.refunds,
      "Grand Total Net": totals.grandTotal,
    });
    exportToCSV(csvData, `MonthlyMIS_${month}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 overflow-hidden text-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-serif text-hotel-black">Monthly MIS & Cash Sheet</h2>
          <p className="text-gray-500">Comprehensive daily financial tracking</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="month" 
            className="border rounded px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button onClick={handleExport} className="flex items-center gap-2 bg-hotel-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-gray-50 border-y text-gray-500 uppercase text-xs">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Day</th>
              <th className="p-3 text-right">Cash</th>
              <th className="p-3 text-right">Card</th>
              <th className="p-3 text-right">UPI</th>
              <th className="p-3 text-right">Paytm</th>
              <th className="p-3 text-right">OTA (Agoda/MMT)</th>
              <th className="p-3 text-right font-bold text-hotel-black">Total Inward</th>
              <th className="p-3 text-right text-red-500">Expenses</th>
              <th className="p-3 text-right text-red-500">Refunds</th>
              <th className="p-3 text-right font-bold text-hotel-black">Net Deposit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row: any) => (
              <tr key={row.date} className="hover:bg-gray-50">
                <td className="p-3">{new Date(row.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}</td>
                <td className="p-3 text-gray-500">{row.day}</td>
                <td className="p-3 text-right">₹{row.cash.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right">₹{row.card.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right">₹{row.upi.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right">₹{row.paytm.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right">₹{row.ota.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-medium text-hotel-black">₹{(row.dayTotal || 0).toLocaleString("en-IN")}</td>
                <td className="p-3 text-right text-red-500">₹{row.expenses.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right text-red-500">₹{row.refunds.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-bold text-hotel-black">₹{(row.grandTotal || 0).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr>
              <td colSpan={2} className="p-3 font-bold">TOTAL</td>
              <td className="p-3 text-right font-bold">₹{(totals.cash || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold">₹{(totals.card || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold">₹{(totals.upi || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold">₹{(totals.paytm || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold">₹{(totals.ota || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold text-hotel-black">₹{(totals.dayTotal || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold text-red-500">₹{(totals.expenses || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold text-red-500">₹{(totals.refunds || 0).toLocaleString("en-IN")}</td>
              <td className="p-3 text-right font-bold text-hotel-black text-lg">₹{(totals.grandTotal || 0).toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
