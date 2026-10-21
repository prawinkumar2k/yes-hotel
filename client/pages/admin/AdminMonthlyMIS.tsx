import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { Loader2, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportPrintHeader from "@/components/admin/ReportPrintHeader";
import { usePrintLayout } from "@/lib/usePrintLayout";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdminMonthlyMIS() {
  usePrintLayout("landscape");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["monthly-mis", month],
    queryFn: async () => {
      const res = await api.get(`/reports/monthly-mis?month=${month}`);
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const columnDefs = useMemo(() => [
    { 
      field: "date", 
      headerName: "Date", 
      valueFormatter: (p: any) => p.value ? format(parseISO(p.value), "dd-MMM-yyyy") : "TOTAL",
      pinned: "left", 
      width: 140 
    },
    { field: "day", headerName: "Day", width: 90, pinned: "left" },
    { field: "cash", headerName: "CASH", width: 120 },
    { field: "card", headerName: "Card", width: 120 },
    { field: "paytm", headerName: "PAYTM", width: 120 },
    { field: "upi", headerName: "UPI", width: 120 },
    { field: "ota", headerName: "All OTAs", width: 120 },
    { field: "otaMmt", headerName: "MakeMyTrip", width: 120 },
    { field: "otaAgoda", headerName: "Agoda", width: 120 },
    { field: "otaBooking", headerName: "Booking.com", width: 120 },
    { field: "otaGoibibo", headerName: "GoIbibo", width: 120 },
    { field: "dayTotal", headerName: "Day Total", width: 140, cellStyle: { backgroundColor: '#fef3c7', fontWeight: 'bold' } },
    { field: "refunds", headerName: "Refunds", width: 130, cellStyle: { color: 'red' } },
    { field: "expenses", headerName: "Expenses", width: 130, cellStyle: { color: 'red' } },
    { field: "grandTotal", headerName: "Grand Total", width: 140, cellStyle: { backgroundColor: '#dcfce7', fontWeight: 'bold' } },
    { field: "salesRoom", headerName: "Room Sales", width: 140 },
    { field: "salesFb", headerName: "F&B Sales", width: 140 },
    { field: "rsEarlyCheckIn", headerName: "Early Check-in", width: 130 },
    { field: "rsWater", headerName: "Water Bottle", width: 120 },
    { field: "rsDental", headerName: "Dental Kit", width: 120 },
    { field: "rsTeaCoffee", headerName: "Tea / Coffee", width: 120 },
    { field: "rsKovaiMess", headerName: "Kovai Kongu Mess", width: 150 },
    { field: "rsOther", headerName: "Other Sales", width: 120 },
    { field: "salesRoomService", headerName: "Room Service Total", width: 160, cellStyle: { backgroundColor: '#fef9c3', fontWeight: 'bold' } },
    { field: "salesTotal", headerName: "Sales Total", width: 140, cellStyle: { backgroundColor: '#dbeafe', fontWeight: 'bold' } },
    { field: "advances", headerName: "All Advances", width: 130 },
    { field: "advancesAdj", headerName: "Adjusted Adv", width: 130 },
    { field: "advancesUnadj", headerName: "Unadjusted Adv", width: 130 },
    { 
      field: "difference", 
      headerName: "Difference", 
      width: 140,
      cellStyle: (params: any) => {
        if (params.value < 0) return { color: 'red', fontWeight: 'bold' };
        if (params.value > 0) return { color: 'green', fontWeight: 'bold' };
        return { fontWeight: 'bold' };
      }
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
  }), []);

  const handlePrint = () => {
    window.print();
  };

  const num = (v: unknown) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handleCsv = () => {
    if (!reportData) return;
    const cols = columnDefs.filter((c: any) => c.field !== "day");
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.map((c: any) => esc(c.headerName)).join(","), ...reportData.map((r: any) => cols.map((c: any) => esc(r[c.field])).join(","))];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-mis-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalsRow = useMemo(() => {
    if (!reportData) return [];
    return [{
      date: "",
      day: "TOTAL",
      cash: reportData.reduce((s: number, r: any) => s + r.cash, 0),
      card: reportData.reduce((s: number, r: any) => s + r.card, 0),
      paytm: reportData.reduce((s: number, r: any) => s + r.paytm, 0),
      upi: reportData.reduce((s: number, r: any) => s + r.upi, 0),
      ota: reportData.reduce((s: number, r: any) => s + r.ota, 0),
      otaMmt: reportData.reduce((s: number, r: any) => s + r.otaMmt, 0),
      otaAgoda: reportData.reduce((s: number, r: any) => s + r.otaAgoda, 0),
      otaBooking: reportData.reduce((s: number, r: any) => s + r.otaBooking, 0),
      otaGoibibo: reportData.reduce((s: number, r: any) => s + r.otaGoibibo, 0),
      dayTotal: reportData.reduce((s: number, r: any) => s + r.dayTotal, 0),
      refunds: reportData.reduce((s: number, r: any) => s + r.refunds, 0),
      expenses: reportData.reduce((s: number, r: any) => s + r.expenses, 0),
      rsEarlyCheckIn: reportData.reduce((s: number, r: any) => s + (r.rsEarlyCheckIn || 0), 0),
      rsWater: reportData.reduce((s: number, r: any) => s + (r.rsWater || 0), 0),
      rsDental: reportData.reduce((s: number, r: any) => s + (r.rsDental || 0), 0),
      rsTeaCoffee: reportData.reduce((s: number, r: any) => s + (r.rsTeaCoffee || 0), 0),
      rsKovaiMess: reportData.reduce((s: number, r: any) => s + (r.rsKovaiMess || 0), 0),
      rsOther: reportData.reduce((s: number, r: any) => s + (r.rsOther || 0), 0),
      salesRoomService: reportData.reduce((s: number, r: any) => s + (r.salesRoomService || 0), 0),
      grandTotal: reportData.reduce((s: number, r: any) => s + r.grandTotal, 0),
      salesRoom: reportData.reduce((s: number, r: any) => s + r.salesRoom, 0),
      salesFb: reportData.reduce((s: number, r: any) => s + r.salesFb, 0),
      salesTotal: reportData.reduce((s: number, r: any) => s + r.salesTotal, 0),
      advances: reportData.reduce((s: number, r: any) => s + r.advances, 0),
      advancesAdj: reportData.reduce((s: number, r: any) => s + r.advancesAdj, 0),
      advancesUnadj: reportData.reduce((s: number, r: any) => s + r.advancesUnadj, 0),
      difference: reportData.reduce((s: number, r: any) => s + r.difference, 0),
    }];
  }, [reportData]);

  return (
    <div className="bg-white p-6 rounded shadow-sm border border-gray-200 overflow-hidden w-full h-[calc(100vh-190px)] min-h-[420px] flex flex-col report-print print:h-auto print:border-0 print:shadow-none print:p-0">
      <ReportPrintHeader title="Monthly MIS Report" period={month} />
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">Monthly MIS Report</h2>
          <p className="text-muted-foreground text-sm">Hotel Operations Monthly Daily Collection & Sales Tracker.</p>
        </div>
        <div className="flex gap-4 items-center">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:ring-hotel-gold"
          />
          <Button onClick={handlePrint} className="bg-hotel-gold hover:bg-yellow-600 text-white">
            <Printer className="mr-2 h-4 w-4" /> Print MIS
          </Button>
          <Button variant="outline" onClick={handleCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12 flex-1">
          <Loader2 className="animate-spin h-8 w-8 text-hotel-gold" />
        </div>
      ) : (
        <div className="ag-theme-alpine flex-1 w-full print:hidden">
          <AgGridReact
            theme="legacy" // the page styles the grid with the ag-theme-alpine CSS file
            modules={[AllCommunityModule]}
            rowData={reportData} 
            columnDefs={columnDefs as any} 
            defaultColDef={defaultColDef}
            pinnedBottomRowData={totalsRow}
          />
        </div>
      )}

      {/* Printed copy: a plain table (the interactive grid cannot paginate) */}
      {reportData && (
        <table className="hidden print:table w-full border border-black text-[9px]">
          <thead>
            <tr>{columnDefs.map((c: any) => <th key={c.field} className="border border-black bg-gray-100 text-right first:text-left">{c.headerName}</th>)}</tr>
          </thead>
          <tbody>
            {reportData.map((r: any) => (
              <tr key={r.date}>
                {columnDefs.map((c: any) => (
                  <td key={c.field} className="border border-black text-right first:text-left whitespace-nowrap">
                    {c.field === "date" ? format(parseISO(r.date), "dd-MMM") : c.field === "day" ? r.day : num(r[c.field])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              {columnDefs.map((c: any) => (
                <td key={c.field} className="border border-black bg-gray-100 text-right first:text-left">
                  {c.field === "date" ? "TOTAL" : c.field === "day" ? "" : num((totalsRow[0] as any)?.[c.field])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
