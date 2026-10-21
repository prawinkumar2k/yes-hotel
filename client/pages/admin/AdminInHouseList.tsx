import { usePrintLayout } from "@/lib/usePrintLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format, subDays, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const formatAmount = (val: any) => {
  if (val === undefined || val === null || val === "" || val === 0) return "-";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num) || num === 0) return "-";
  return num.toFixed(2);
};

export default function AdminInHouseList() {
  usePrintLayout("landscape", 6);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data = [], isLoading } = useQuery({
    queryKey: ["in-house-list", selectedDate],
    queryFn: async () => {
      const res = await api.get(`/reports/in-house-list?date=${selectedDate}`);
      return res.data.data;
    },
    refetchInterval: 5000, // Live auto-sync
  });

  const handlePrint = () => {
    window.print();
  };

  const handlePrevDay = () => {
    setSelectedDate(curr => format(subDays(new Date(curr), 1), "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    setSelectedDate(curr => format(addDays(new Date(curr), 1), "yyyy-MM-dd"));
  };

  const displayDateObj = new Date(selectedDate);

  return (
    <div className="space-y-4 p-2 sm:p-4 bg-gray-50 min-h-screen text-black">
      {/* =========================================================================
          TOP TOOLBAR & CONTROLS (Hidden on print)
          ========================================================================= */}
      <div className="flex flex-wrap justify-between items-center mb-2 gap-3 print:hidden bg-white p-4 rounded-xl border border-gray-300 shadow-sm">
        <div>
          <h1 className="text-xl font-bold font-serif text-gray-900 uppercase tracking-wide">
            YES HOTELS — Guest In-House &amp; Arrival Register
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Physical logbook registry. Entries remain permanently once entered; check-in and check-out update in real-time.
          </p>
        </div>

        {/* Date Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker Navigation */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-300">
            <button
              onClick={handlePrevDay}
              className="p-1 hover:bg-white rounded transition text-gray-700"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar size={14} className="text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-gray-800 outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={handleNextDay}
              className="p-1 hover:bg-white rounded transition text-gray-700"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
              className="text-[10px] font-bold text-[#c9a227] hover:underline px-1.5"
            >
              Today
            </button>
          </div>

          <a
            href="/admin/reports/bulk-docs"
            className="bg-black hover:bg-gray-800 text-[#c9a227] px-3.5 py-2 rounded text-xs font-bold uppercase transition flex items-center gap-1.5 shadow"
          >
            <Printer className="h-3.5 w-3.5" /> GRC &amp; GST Bulk Print
          </a>
          <Button
            onClick={handlePrint}
            className="bg-[#c9a227] hover:bg-yellow-600 text-white font-bold text-xs uppercase px-3.5 py-2 flex items-center gap-1.5 shadow"
          >
            <Printer className="h-3.5 w-3.5" /> Print Logbook
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-16 bg-white rounded-xl border border-gray-300">
          <Loader2 className="animate-spin h-8 w-8 text-[#c9a227]" />
        </div>
      ) : (
        <div className="print:m-0 print:p-0 bg-white text-black p-4 border border-gray-300 rounded-xl shadow-sm print:border-none print:shadow-none">
          {/* HEADER SECTION (EXACT TO PHYSICAL LOGBOOK) */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-black">
            <div className="flex items-center gap-3">
              <div className="font-bold text-2xl tracking-wider uppercase font-serif">YES HOTELS</div>
              <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest hidden sm:block">
                — SAY YES TO TIME —
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider font-serif">
                GUEST IN-HOUSE LIST
              </h2>
            </div>
            <div className="text-right text-xs font-mono space-y-0.5">
              <div>
                <span className="font-bold">Date :</span> {format(displayDateObj, "dd-MM-yyyy")}
              </div>
              <div>
                <span className="font-bold">Day :</span> {format(displayDateObj, "EEEE")}
              </div>
            </div>
          </div>

          {/* TABLE CONTAINER: Horizontal Scroll on Screen, Full Width on Landscape Print */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-[11px] border-collapse border-2 border-black text-black min-w-[1380px] print:min-w-0">
              <thead>
                <tr className="bg-gray-100 print:bg-white text-center font-bold border-b-2 border-black">
                  <th className="border border-black p-1 w-[40px]">S. No.</th>
                  <th className="border border-black p-1 w-[105px]">GRC No.</th>
                  <th className="border border-black p-1 w-[65px]">Room No.</th>
                  <th className="border border-black p-1 min-w-[130px] text-left px-2">Guest Name</th>
                  <th className="border border-black p-1 min-w-[110px] text-left px-2">Company/ Group</th>
                  <th className="border border-black p-1 w-[40px]">Adult</th>
                  <th className="border border-black p-1 w-[40px]">Child</th>
                  <th className="border border-black p-1 w-[40px]">Kids</th>
                  <th className="border border-black p-1 w-[75px] text-right px-1.5">Tariff</th>
                  <th className="border border-black p-1 w-[45px]">Plan</th>
                  <th className="border border-black p-1 w-[55px]">Ex. Bed</th>
                  <th className="border border-black p-1 w-[70px] text-right px-1.5">Food Bill</th>
                  <th className="border border-black p-1 w-[65px] text-right px-1.5">Discount</th>
                  <th className="border border-black p-1 w-[90px]">Checked in</th>
                  <th className="border border-black p-1 w-[90px]">Check out</th>
                  <th className="border border-black p-1 w-[65px]">
                    No. of<br />Nights
                  </th>
                  <th className="border border-black p-1 w-[75px] text-right px-1.5">Advance</th>
                  <th className="border border-black p-1 w-[75px] text-right px-1.5">Balance</th>
                  <th className="border border-black p-1 w-[75px] text-right px-1.5">Settled</th>
                  <th className="border border-black p-1 w-[95px]">
                    Payment<br />Mode
                  </th>
                </tr>
              </thead>
              <tbody className="text-center font-mono">
                {data.map((row: any, i: number) => {
                  const companyDisplay =
                    row.companyGroup?.length > 18 && row.companyGroup?.includes("6acb")
                      ? "Direct"
                      : row.companyGroup || "-";

                  const isCheckedOut = row.status === "CHECKED_OUT";

                  return (
                    <tr
                      key={row._id}
                      className={`hover:bg-yellow-50/50 print:hover:bg-transparent border-b border-gray-400 h-7 print:h-[5.2mm] text-[10.5px] ${isCheckedOut ? "bg-gray-50/70" : ""}`}
                    >
                      <td className="border border-black p-1 font-bold">{i + 1}</td>
                      <td className="border border-black p-1 font-semibold truncate text-[10px]" title={row.grcNo}>
                        {row.grcNo}
                      </td>
                      <td className="border border-black p-1 font-black text-xs font-mono">{row.roomNo}</td>
                      <td className="border border-black p-1 text-left px-2 truncate font-sans font-bold" title={row.guestName}>
                        {row.guestName}
                      </td>
                      <td className="border border-black p-1 text-left px-2 truncate font-sans" title={companyDisplay}>
                        {companyDisplay}
                      </td>
                      <td className="border border-black p-1">{row.adults}</td>
                      <td className="border border-black p-1">{row.childKids}</td>
                      <td className="border border-black p-1">0</td>
                      <td className="border border-black p-1 text-right px-1.5 font-bold">{formatAmount(row.tariff)}</td>
                      <td className="border border-black p-1 font-sans">{row.plan}</td>
                      <td className="border border-black p-1">{row.extraBed ? "YES" : "-"}</td>
                      <td className="border border-black p-1 text-right px-1.5">{formatAmount(row.foodBill)}</td>
                      <td className="border border-black p-1 text-right px-1.5 text-red-700">{formatAmount(row.discountAmount)}</td>
                      
                      {/* Checked in: date & time */}
                      <td className="border border-black p-1 font-sans text-[10px]">
                        {row.checkedIn ? format(new Date(row.checkedIn), "dd/MM HH:mm") : "—"}
                      </td>
                      
                      {/* Check out: date & time with status indicator */}
                      <td className="border border-black p-1 font-sans text-[10px]">
                        {row.checkOut ? (
                          <div className="leading-tight">
                            <span>{format(new Date(row.checkOut), isCheckedOut ? "dd/MM HH:mm" : "dd/MM")}</span>
                            <span className={`block text-[8.5px] font-bold ${isCheckedOut ? "text-gray-500" : "text-green-700"}`}>
                              {isCheckedOut ? "(Out)" : "(In)"}
                            </span>
                          </div>
                        ) : "—"}
                      </td>

                      <td className="border border-black p-1">{row.nights}</td>
                      <td className="border border-black p-1 text-right px-1.5 text-green-800 font-bold">{formatAmount(row.advance)}</td>
                      <td className="border border-black p-1 text-right px-1.5 font-bold">{formatAmount(row.balance)}</td>
                      <td className="border border-black p-1 text-right px-1.5 font-bold">{formatAmount(row.settled)}</td>
                      <td className="border border-black p-1 truncate font-sans text-[9.5px]" title={row.paymentMode}>
                        {row.paymentMode}
                      </td>
                    </tr>
                  );
                })}

                {/* Blank rows up to 25 rows exactly matching physical ledger */}
                {Array.from({ length: Math.max(0, 25 - data.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-7 print:h-[5.2mm] border-b border-gray-400">
                    <td className="border border-black p-1 text-gray-400">{data.length + i + 1}</td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SIGNATURES SECTION */}
          <div className="flex flex-wrap justify-between items-end gap-4 mt-8 pt-4 border-t-2 border-black text-xs font-semibold">
            <div>
              <div className="border-b border-black w-48 mb-2"></div>
              <div>Manager</div>
            </div>
            <div>
              <div className="border-b border-black w-48 mb-2"></div>
              <div>Front Office</div>
            </div>
          </div>
        </div>
      )}

      {/* Global Landscape Print Styles Injection */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .print\\:hidden { display: none !important; }
          table { width: 100% !important; min-width: 100% !important; font-size: 8px !important; table-layout: auto !important; }
          th, td { padding: 1.5px 2px !important; white-space: nowrap !important; line-height: 1.1 !important; }
          td span.block { display: inline !important; margin-left: 3px; }
          td.truncate, td[title] { overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
        }
      `}</style>
    </div>
  );
}
