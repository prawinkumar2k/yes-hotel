import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, FileCheck2, Receipt, ArrowLeft, ArrowRight, Key } from "lucide-react";

// Number to words helper for GST Invoice
function numberToWords(num: number): string {
  const a = ["", "ONE ", "TWO ", "THREE ", "FOUR ", "FIVE ", "SIX ", "SEVEN ", "EIGHT ", "NINE ", "TEN ", "ELEVEN ", "TWELVE ", "THIRTEEN ", "FOURTEEN ", "FIFTEEN ", "SIXTEEN ", "SEVENTEEN ", "EIGHTEEN ", "NINETEEN "];
  const b = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  
  if ((num = Math.floor(num)) === 0) return "ZERO RUPEES ONLY";
  const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  
  let str = "";
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "CRORE " : "";
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "LAKH " : "";
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "THOUSAND " : "";
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "HUNDRED " : "";
  str += (Number(n[5]) !== 0) ? ((str !== "") ? "AND " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) : "";
  return str.trim() + " RUPEES ONLY";
}

export default function AdminBulkDocViewer() {
  const [docType, setDocType] = useState<"BOTH" | "GRC" | "GST">("BOTH");
  const [viewMode, setViewMode] = useState<"PAGED" | "ALL">("PAGED");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // 1. Fetch In-House Stays and Active Bookings
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["bulk-doc-bookings"],
    queryFn: async () => {
      const res = await api.get("/admin/bookings?limit=100&status=CHECKED_IN");
      const list = res.data?.data?.bookings || [];
      if (list.length === 0) {
        const allRes = await api.get("/admin/bookings?limit=50");
        return allRes.data?.data?.bookings || [];
      }
      return list;
    },
    refetchInterval: 10000,
  });

  const bookings = bookingsData || [];

  // Toggle selection for bulk print
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const all: Record<string, boolean> = {};
    bookings.forEach((b: any) => { all[b._id] = true; });
    setSelectedIds(all);
  };

  const deselectAll = () => {
    setSelectedIds({});
  };

  // Filtered list for printing/viewing
  const activeBookingsToRender = useMemo(() => {
    if (viewMode === "PAGED") {
      return bookings[currentIndex] ? [bookings[currentIndex]] : [];
    }
    const hasSelection = Object.values(selectedIds).some(Boolean);
    if (!hasSelection) return bookings;
    return bookings.filter((b: any) => selectedIds[b._id]);
  }, [bookings, viewMode, currentIndex, selectedIds]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 bg-white">
        <Loader2 className="animate-spin text-hotel-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 bg-gray-100 min-h-screen text-black">
      {/* =========================================================================
          TOP TOOLBAR CONTROLS (Hidden on print)
          ========================================================================= */}
      <div className="print:hidden mb-6 bg-white p-4 rounded-xl border border-gray-300 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-xl font-bold font-serif text-gray-900 uppercase tracking-wide">
              GRC &amp; GST Invoices &bull; Bulk &amp; Paged Viewer
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
              Review and print physical Guest Registration Cards (Photo 2) and GST Tax Invoices (Photo 1) individually or in bulk.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-black hover:bg-gray-800 text-white font-bold text-xs uppercase px-5 py-2 flex items-center gap-2 shadow"
            >
              <Printer size={16} className="text-[#c9a227]" />
              {viewMode === "ALL" ? `Print All Selected (${activeBookingsToRender.length})` : "Print Current Document"}
            </Button>
          </div>
        </div>

        {/* CONTROLS ROW */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 text-xs">
          {/* Doc Type Selector */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">Document Type:</span>
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-100">
              <button
                onClick={() => setDocType("BOTH")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${docType === "BOTH" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"}`}
              >
                Both (GRC + GST)
              </button>
              <button
                onClick={() => setDocType("GRC")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${docType === "GRC" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"}`}
              >
                1. GRC Only
              </button>
              <button
                onClick={() => setDocType("GST")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${docType === "GST" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"}`}
              >
                2. GST Invoice Only
              </button>
            </div>
          </div>

          {/* View Mode Selector: One by One vs Bulk All */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">Display:</span>
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-100">
              <button
                onClick={() => setViewMode("PAGED")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === "PAGED" ? "bg-[#c9a227] text-white shadow-sm" : "text-gray-600 hover:text-black"}`}
              >
                One by One (Paged)
              </button>
              <button
                onClick={() => setViewMode("ALL")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === "ALL" ? "bg-[#c9a227] text-white shadow-sm" : "text-gray-600 hover:text-black"}`}
              >
                Bulk All ({bookings.length})
              </button>
            </div>
          </div>

          {/* Paged Navigation (When in One by One Mode) */}
          {viewMode === "PAGED" && bookings.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg border border-gray-300">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                className="p-1 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                title="Previous Stay"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="font-mono font-bold text-gray-800">
                {currentIndex + 1} of {bookings.length}
              </span>
              <button
                disabled={currentIndex >= bookings.length - 1}
                onClick={() => setCurrentIndex(i => Math.min(bookings.length - 1, i + 1))}
                className="p-1 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                title="Next Stay"
              >
                <ArrowRight size={16} />
              </button>
              <span className="text-gray-700 text-xs font-bold font-mono ml-2 border-l border-gray-300 pl-2">
                Room {bookings[currentIndex]?.assignedRoom?.roomNumber || "—"} &bull; {bookings[currentIndex]?.guestDetails?.firstName} {bookings[currentIndex]?.guestDetails?.lastName}
              </span>
            </div>
          )}

          {/* Bulk Select Options (When in Bulk Mode) */}
          {viewMode === "ALL" && (
            <div className="flex items-center gap-3 text-xs">
              <button onClick={selectAll} className="text-[#c9a227] hover:underline font-bold">Select All</button>
              <span className="text-gray-400">|</span>
              <button onClick={deselectAll} className="text-gray-600 hover:underline">Deselect All</button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          DOCUMENT RENDER AREA (Strict Replica of Photo 1 & Photo 2)
          ========================================================================= */}
      {activeBookingsToRender.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-300 max-w-[850px] mx-auto">
          No bookings found to display.
        </div>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {activeBookingsToRender.map((booking: any) => {
            const guest = booking.guestDetails || {};
            const foreign = booking.foreignGuestDetails;
            const nights = differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)) || 1;
            const checkInDate = new Date(booking.checkInDate);
            const checkOutDate = new Date(booking.checkOutDate);
            const roomNum = booking.assignedRoom?.roomNumber || "101";
            const roomCategoryName = booking.roomCategory?.name || "DELUXE";
            const roomCategoryShort = roomCategoryName.substring(0, 3).toUpperCase();
            const billNo = booking.billNumber || booking.bookingReference?.slice(-4) || "267";
            const grcNo = booking.grcNumber || `GI${booking.bookingReference?.slice(-7) || "0006178"}`;
            const dailyTariff = booking.ratePerNight ?? Math.round((booking.totalAmount - (booking.taxAmount || 0)) / nights);
            const advanceAmount = booking.advanceAmount || 0;
            const advanceMethod = (booking.paymentMethod || "CASH").toUpperCase();

            // ID Type detection matching Photo 2
            const idType = (guest.idType || "").toUpperCase();
            const isAadhaar = idType.includes("AAD") || !idType; // default checked like photo
            const isDL = idType.includes("DRIV") || idType.includes("DL");
            const isVoter = idType.includes("VOTER") || idType.includes("ECI") || idType.includes("E.C.I");
            const isGovt = !isAadhaar && !isDL && !isVoter;

            // Invoice calculations matching Photo 1
            const totalTariff = dailyTariff * nights;
            const dailyTaxable = dailyTariff;
            const dailyCgst = Math.round(dailyTaxable * 0.06 * 100) / 100;
            const dailySgst = dailyCgst;
            const totalTaxable = totalTariff;
            const totalCgst = dailyCgst * nights;
            const totalSgst = dailySgst * nights;
            const totalFnb = booking.fnbAmount || 0;
            const grandTotal = totalTaxable + totalCgst + totalSgst + totalFnb;
            const net = Math.max(0, grandTotal - advanceAmount);
            const roundedNet = Math.round(net);
            const roundOff = Number((roundedNet - net).toFixed(2));

            return (
              <div key={booking._id} className="space-y-8 print:space-y-0">
                {/* -------------------------------------------------------------
                    DOCUMENT 1: GUEST REGISTRATION CARD (GRC) — EXACT REPLICA OF PHOTO 2
                    ------------------------------------------------------------- */}
                {(docType === "BOTH" || docType === "GRC") && (
                  <div className="bg-white p-4 print:p-0 mx-auto max-w-[850px] print:m-0 print:break-after-page">
                    <div className="print:hidden flex justify-between items-center mb-2 pb-1 border-b border-gray-300 text-xs">
                      <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck2 size={15} className="text-[#c9a227]" />
                        GRC &bull; Room {roomNum} &bull; {guest.firstName} {guest.lastName}
                      </span>
                      <span className="text-gray-500 font-mono">Bill #{billNo}</span>
                    </div>

                    {/* PHYSICAL GRC CARD (MATCHING PHOTO 2 EXACTLY) */}
                    <div className="border-2 border-black p-3 text-[11px] leading-tight font-sans bg-white">
                      
                      {/* HEADER SECTION (EXACT TO PHOTO 2) */}
                      <div className="border-b-2 border-black pb-2">
                        <div className="flex justify-between items-start">
                          {/* Hotel Name & Address */}
                          <div className="w-7/12">
                            <h1 className="text-2xl font-black tracking-widest font-serif uppercase text-black leading-none">
                              YES HOTELS
                            </h1>
                            <p className="text-[9.5px] text-gray-800 font-normal mt-1 leading-snug">
                              No. 51, Khata No. 749, Singasandra, Hosa Road Junction, Parappana Agrahara,<br />
                              Electronic City Ph-2, Bengaluru-560100.
                            </p>
                          </div>

                          {/* ID Proof Checkboxes & Bill No on Top Right */}
                          <div className="w-5/12 text-right space-y-1">
                            <div className="flex items-center justify-end gap-2 text-[10px] font-bold">
                              <span>ID :</span>
                              <label className="inline-flex items-center gap-0.5">
                                <input type="checkbox" checked={isAadhaar} readOnly className="accent-black w-3 h-3" />
                                <span>AAD</span>
                              </label>
                              <label className="inline-flex items-center gap-0.5">
                                <input type="checkbox" checked={isDL} readOnly className="accent-black w-3 h-3" />
                                <span>D.L</span>
                              </label>
                              <label className="inline-flex items-center gap-0.5">
                                <input type="checkbox" checked={isVoter} readOnly className="accent-black w-3 h-3" />
                                <span>E.C.I</span>
                              </label>
                              <label className="inline-flex items-center gap-0.5">
                                <input type="checkbox" checked={isGovt} readOnly className="accent-black w-3 h-3" />
                                <span>Govt. ID</span>
                              </label>
                            </div>

                            <div className="text-[10px] font-bold flex justify-end items-center gap-1">
                              <span>ID No. :</span>
                              <span className="font-mono font-bold tracking-wider">{guest.idNumber || "9861 9814 4009"}</span>
                            </div>

                            <div className="text-[11px] font-bold flex justify-end items-center gap-1 pt-0.5">
                              <span>Bill No.</span>
                              <span className="text-red-700 text-base font-black font-mono ml-1">{billNo}</span>
                            </div>
                          </div>
                        </div>

                        {/* Title Bar */}
                        <div className="mt-2 pt-1 border-t border-black text-center">
                          <h2 className="text-sm font-black uppercase tracking-wider">
                            GUEST REGISTRATION CARD
                          </h2>
                          <p className="text-[8.5px] font-bold text-gray-700 uppercase tracking-tight">
                            THE REGISTRATION OF FOREIGNERS RULES - 1939 FORM - C HOTEL ARRIVAL REPORT, RULE 14, ID PROOF IS REQUIRED FOR CHECK - IN
                          </p>
                        </div>
                      </div>

                      {/* MAIN TWO-COLUMN BODY (EXACT TO PHOTO 2) */}
                      <div className="grid grid-cols-12 border-b-2 border-black">
                        
                        {/* LEFT COLUMN (5 COLS): For Foreigners Only + For Office Use Only + Signatures */}
                        <div className="col-span-5 border-r-2 border-black p-2 space-y-2 flex flex-col justify-between">
                          <div className="space-y-2">
                            {/* BOX 1: For Foreigners Only */}
                            <div className="border border-black p-1.5 bg-white text-[10px]">
                              <div className="font-black uppercase text-center border-b border-black pb-0.5 mb-1 text-[9.5px]">
                                For Foreigners Only
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between border-b border-gray-300 pb-0.5">
                                  <span className="text-gray-700">Passport No.</span>
                                  <span className="font-mono font-bold">{foreign?.passportNumber || "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-300 pb-0.5">
                                  <span className="text-gray-700">Place of Issue</span>
                                  <span>{foreign?.passportIssuePlace || "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-300 pb-0.5">
                                  <span className="text-gray-700">Date of issue</span>
                                  <span>{foreign?.passportIssueDate ? format(new Date(foreign.passportIssueDate), "dd/MM/yyyy") : "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-300 pb-0.5">
                                  <span className="text-gray-700">Visa No.</span>
                                  <span className="font-mono font-bold">{foreign?.visaNumber || "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-300 pb-0.5">
                                  <span className="text-gray-700">Date of Expiry</span>
                                  <span>{foreign?.passportExpiryDate ? format(new Date(foreign.passportExpiryDate), "dd/MM/yyyy") : "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-300 pb-0.5">
                                  <span className="text-gray-700">Place</span>
                                  <span>{foreign?.visaPlace || "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-700">Visa Date</span>
                                  <span>{foreign?.visaDate ? format(new Date(foreign.visaDate), "dd/MM/yyyy") : "—"}</span>
                                </div>
                              </div>
                            </div>

                            {/* BOX 2: For Office Use Only */}
                            <div className="border border-black p-1.5 bg-white text-[10px]">
                              <div className="font-black uppercase text-center border-b border-black pb-0.5 mb-1 text-[9.5px]">
                                For Office Use Only
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                                  <span className="font-bold">Room No.</span>
                                  <span className="font-black text-xs font-mono">{roomNum}</span>
                                  <span className="font-bold ml-2">Tariff</span>
                                  <span className="font-black font-mono">{dailyTariff}/-</span>
                                </div>
                                <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                                  <span className="font-bold">Bill No.</span>
                                  <span className="font-mono">{billNo}</span>
                                  <span className="font-bold ml-2">Extra Bed</span>
                                  <span className="font-mono">{booking.extraPersonsWithBed ? "YES" : "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                                  <span className="font-bold">Advance</span>
                                  <span className="font-black font-mono">{advanceAmount}/-</span>
                                  <span className="font-bold ml-2">Receipt No.</span>
                                  <span className="font-mono">—</span>
                                </div>

                                <div className="pt-0.5">
                                  <div className="font-bold text-[9px] uppercase text-gray-700">Billing Instruction / Credit Card Details</div>
                                  <div className="flex flex-wrap gap-2 mt-0.5 text-[9.5px]">
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={advanceMethod === "CASH"} readOnly className="accent-black w-2.5 h-2.5" /> Cash
                                    </label>
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={advanceMethod === "CARD"} readOnly className="accent-black w-2.5 h-2.5" /> Card / DD
                                    </label>
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={false} readOnly className="accent-black w-2.5 h-2.5" /> Reserved
                                    </label>
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={booking.paymentStatus === "PAID"} readOnly className="accent-black w-2.5 h-2.5" /> Net Pay
                                    </label>
                                  </div>
                                </div>

                                <div className="pt-0.5 border-t border-dotted border-gray-400">
                                  <div className="font-bold text-[9px] uppercase text-gray-700">Type of Plan</div>
                                  <div className="flex justify-between mt-0.5 text-[9.5px]">
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={booking.ratePlan === "EP" || !booking.ratePlan} readOnly className="accent-black w-2.5 h-2.5" /> EP
                                    </label>
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={booking.ratePlan === "CP"} readOnly className="accent-black w-2.5 h-2.5" /> CP
                                    </label>
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={booking.ratePlan === "MAP"} readOnly className="accent-black w-2.5 h-2.5" /> MAP
                                    </label>
                                    <label className="flex items-center gap-1">
                                      <input type="checkbox" checked={booking.ratePlan === "AP"} readOnly className="accent-black w-2.5 h-2.5" /> AP
                                    </label>
                                  </div>
                                </div>

                                <div className="pt-0.5 flex justify-between font-bold text-[9.5px]">
                                  <span>B/ID No.</span>
                                  <span className="font-mono">{booking.source || "walk in"}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Receptionist & Front Office Manager Signatures */}
                          <div className="flex justify-between items-end pt-6 pb-1 text-[9.5px] font-bold">
                            <div className="text-center">
                              <div className="h-6"></div>
                              <div className="border-t border-black pt-0.5">Receptionist</div>
                            </div>
                            <div className="text-center">
                              <div className="h-6"></div>
                              <div className="border-t border-black pt-0.5">Front Office Manager</div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN (7 COLS): GUEST DETAILS FORM (EXACT TO PHOTO 2) */}
                        <div className="col-span-7 p-2.5 space-y-2 text-[10.5px] flex flex-col justify-between">
                          <div className="space-y-2">
                            {/* Name & GSTIN */}
                            <div className="border-b border-dotted border-black pb-1">
                              <span className="font-bold">Name (in capital Letters)</span>
                              <span className="font-black text-sm uppercase font-serif ml-3 tracking-wide">
                                {guest.firstName} {guest.lastName}
                              </span>
                            </div>

                            <div className="border-b border-dotted border-black pb-1 flex justify-between">
                              <div>
                                <span className="font-bold">Designation :</span>
                                <span className="ml-2">{guest.designation || "—"}</span>
                              </div>
                              <div>
                                <span className="font-bold">GSTIN :</span>
                                <span className="font-mono ml-2">{guest.gstin || "—"}</span>
                              </div>
                            </div>

                            <div className="border-b border-dotted border-black pb-1">
                              <span className="font-bold">Name of the Organization :</span>
                              <span className="ml-2">{guest.organization || "—"}</span>
                            </div>

                            <div className="border-b border-dotted border-black pb-1">
                              <span className="font-bold">Address :</span>
                              <span className="ml-2 font-medium">{guest.address || "Bengaluru, Karnataka"}</span>
                            </div>

                            <div className="border-b border-dotted border-black pb-1 flex justify-between">
                              <div>
                                <span className="font-bold">Mob :</span>
                                <span className="font-mono font-bold ml-2">{guest.phone || "—"}</span>
                              </div>
                              <div>
                                <span className="font-bold">Vech. Reg. No. :</span>
                                <span className="font-mono uppercase ml-2">{guest.vehicleNumber || "—"}</span>
                              </div>
                            </div>

                            <div className="border-b border-dotted border-black pb-1">
                              <span className="font-bold">Email :</span>
                              <span className="font-mono ml-2">{guest.email || "—"}</span>
                            </div>

                            <div className="border-b border-dotted border-black pb-1 flex justify-between text-[10px]">
                              <div>
                                <span className="font-bold">Nationality :</span>
                                <span className="ml-1">{guest.nationality || "INDIAN"}</span>
                              </div>
                              <div>
                                <span className="font-bold">DOB :</span>
                                <span className="ml-1">{guest.dateOfBirth ? format(new Date(guest.dateOfBirth), "dd/MM/yyyy") : "—"}</span>
                              </div>
                              <div>
                                <span className="font-bold">Age :</span>
                                <span className="ml-1">{guest.age || "—"}</span>
                              </div>
                            </div>

                            <div className="border-b border-dotted border-black pb-1 flex justify-between text-[10px]">
                              <div>
                                <span className="font-bold">No. of Persons :</span>
                                <span className="ml-1 font-bold">{booking.adults || 1}</span>
                              </div>
                              <div>
                                <span className="font-bold">Child :</span>
                                <span className="ml-1">{booking.children || 0}</span>
                              </div>
                              <div>
                                <span className="font-bold">No. of Days :</span>
                                <span className="ml-1 font-bold">{nights}</span>
                              </div>
                            </div>

                            <div className="border-b border-dotted border-black pb-1 flex justify-between text-[10px]">
                              <div>
                                <span className="font-bold">Date of Arr :</span>
                                <span className="ml-1 font-mono font-bold">{format(checkInDate, "dd/MM/yy")}</span>
                                <span className="ml-2 font-bold">Time :</span>
                                <span className="ml-1">{booking.arrivalTime || "12:00 PM"}</span>
                              </div>
                              <div>
                                <span className="font-bold">Date Dep :</span>
                                <span className="ml-1 font-mono font-bold">{format(checkOutDate, "dd/MM/yy")}</span>
                                <span className="ml-2 font-bold">Time :</span>
                                <span className="ml-1">{booking.departureTime || "11:00 AM"}</span>
                              </div>
                            </div>

                            <div className="border-b border-dotted border-black pb-1 flex justify-between text-[10px]">
                              <div>
                                <span className="font-bold">Purpose of Visit :</span>
                                <span className="ml-1">{guest.purposeOfVisit || "Personal / Business"}</span>
                              </div>
                              <div>
                                <span className="font-bold">Proceeding to :</span>
                                <span className="ml-1">{guest.proceedingTo || "—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Guest Signature Box at Bottom Right */}
                          <div className="flex justify-end pt-4">
                            <div className="border border-black p-2 w-48 h-16 flex flex-col justify-between text-center bg-gray-50/30">
                              <div className="text-[9px] text-gray-400 italic">Signature</div>
                              <div className="border-t border-black pt-0.5 font-bold uppercase text-[10px]">
                                Guest Signature
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    DOCUMENT 2: GST TAX INVOICE — EXACT REPLICA OF PHOTO 1
                    ------------------------------------------------------------- */}
                {(docType === "BOTH" || docType === "GST") && (
                  <div className="bg-white p-4 print:p-0 mx-auto max-w-[850px] print:m-0 print:break-after-page">
                    <div className="print:hidden flex justify-between items-center mb-2 pb-1 border-b border-gray-300 text-xs">
                      <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Receipt size={15} className="text-[#c9a227]" />
                        GST Invoice &bull; Room {roomNum} &bull; Bill #{billNo}
                      </span>
                      <span className="text-gray-500 font-mono">Invoice #{billNo}</span>
                    </div>

                    {/* PHYSICAL GST INVOICE SHEET (MATCHING PHOTO 1 EXACTLY) */}
                    <div className="border border-black text-[10px] leading-tight font-medium bg-white">
                      
                      {/* HEADER SECTION (EXACT TO PHOTO 1) */}
                      <div className="flex border-b border-black">
                        {/* Logo Left */}
                        <div className="w-1/3 p-2 flex items-center justify-center border-r border-black">
                          <div className="text-center">
                            <h1 className="font-serif text-3xl font-black italic tracking-widest uppercase">
                              YES HOTELS
                            </h1>
                          </div>
                        </div>
                        {/* Address Right */}
                        <div className="w-2/3 p-2 text-right text-[9.5px]">
                          <h2 className="font-bold text-xs uppercase">YES HOTELS</h2>
                          <p>No. 51, Khata No. 749, Singasandra, Hosa Road Junction,</p>
                          <p>Parappana Agrahara, Electronic City Ph-2,</p>
                          <p>Bengaluru, Karnataka - 560100</p>
                          <p>Phone : 080-28522333 / 9902391178,</p>
                          <p>Email : SALES@YESHOTELS.COM,</p>
                          <p>Web : WWW.YESHOTELS.COM</p>
                          <p className="font-bold">GST : 29AAAFY1234A1Z5</p>
                        </div>
                      </div>

                      {/* INVOICE TITLE BAR */}
                      <div className="text-center border-b border-black py-1 font-bold text-xs uppercase bg-gray-100 relative">
                        GST INVOICE
                        <div className="absolute right-2 top-1 text-[8.5px] font-normal normal-case">
                          ACCOUNTS COPY - DUPLICATE
                        </div>
                      </div>

                      {/* INFO ROW 1 (3-PART GRID) */}
                      <div className="flex border-b border-black text-[9.5px]">
                        <div className="w-1/2 p-1.5 border-r border-black grid grid-cols-[80px_1fr] gap-0.5">
                          <div>Invoice No.</div><div>: <span className="font-bold font-mono">{billNo}</span></div>
                          <div>Date</div><div>: {format(new Date(), "dd-MMM-yy")}</div>
                          <div>State</div><div>: KARNATAKA</div>
                        </div>
                        <div className="w-1/4 p-1.5 border-r border-black grid grid-cols-[60px_1fr] gap-0.5">
                          <div>GRC #</div><div>: <span className="font-mono">{grcNo}</span></div>
                          <div className="col-span-2">&nbsp;</div>
                          <div>State Code</div><div>: 29</div>
                        </div>
                        <div className="w-1/4 p-1.5 grid grid-cols-[60px_1fr] gap-0.5">
                          <div>SAC Code</div><div>: 996311</div>
                          <div>POS</div><div>: KARNATAKA</div>
                        </div>
                      </div>

                      {/* INFO ROW 2 (GUEST & STAY DETAILS) */}
                      <div className="flex border-b border-black min-h-[5.5rem] text-[9.5px]">
                        {/* Guest Details Left */}
                        <div className="w-1/2 p-1.5 border-r border-black relative">
                          <div className="grid grid-cols-[60px_1fr] gap-0.5">
                            <div>Guest</div><div className="font-bold uppercase">MR/MS {guest.firstName} {guest.lastName}</div>
                            <div>Address</div><div className="uppercase">{guest.address || "Bengaluru, Karnataka"}</div>
                          </div>
                          <div className="absolute bottom-1 w-full grid grid-cols-[80px_1fr] gap-0.5 pr-2">
                            <div>GSTIN / UIN</div><div className="truncate">: {guest.gstin || "—"}</div>
                            <div>State</div><div>: KARNATAKA <span className="float-right mr-3">State Code 29</span></div>
                          </div>
                        </div>
                        {/* Stay Details Right */}
                        <div className="w-1/2 p-1.5 grid grid-cols-[70px_1fr_70px_1fr] gap-0.5 content-start">
                          <div>Arr Date</div><div>: {format(checkInDate, "dd-MMM-yy")}</div>
                          <div>Room No</div><div className="font-bold">: {roomNum}({roomCategoryShort})</div>
                          <div>Arr Time</div><div>: {booking.arrivalTime || "12:00"}</div><div className="col-span-2"></div>
                          <div>Dept Date</div><div>: {format(checkOutDate, "dd-MMM-yy")}</div><div className="col-span-2"></div>
                          <div>Dept Time</div><div>: {booking.departureTime || "11:00"}</div><div className="col-span-2"></div>
                          <div>Stay Days</div><div>: {nights}</div><div className="col-span-2"></div>
                          <div className="col-span-4 mt-1 font-bold">
                            M {booking.adults || 1} F 0 C {booking.children || 0}
                          </div>
                        </div>
                      </div>

                      {/* TABLE OF CHARGES (EXACT COLUMN HEADERS MATCHING PHOTO 1) */}
                      <table className="w-full text-center border-collapse text-[9.5px]">
                        <thead>
                          <tr className="border-b border-black font-semibold">
                            <th className="border-r border-black p-1 w-24" rowSpan={2}>Description</th>
                            <th className="border-r border-black p-1 w-14" rowSpan={2}>Tariff</th>
                            <th className="border-r border-black p-1 w-12" rowSpan={2}>Ext Bed</th>
                            <th className="border-r border-black p-1 w-12" rowSpan={2}>Disc</th>
                            <th className="border-r border-black p-1 w-16" rowSpan={2}>Taxable<br/>Value</th>
                            <th className="border-r border-black p-1" colSpan={2}>CGST</th>
                            <th className="border-r border-black p-1" colSpan={2}>SGST</th>
                            <th className="border-r border-black p-1 w-12" rowSpan={2}>F&amp;B</th>
                            <th className="border-r border-black p-1 w-12" rowSpan={2}>Others</th>
                            <th className="p-1 w-16" rowSpan={2}>Total</th>
                          </tr>
                          <tr className="border-b border-black font-semibold">
                            <th className="border-r border-black p-0.5 border-t border-black w-8">Rate</th>
                            <th className="border-r border-black p-0.5 border-t border-black w-12">Amount</th>
                            <th className="border-r border-black p-0.5 border-t border-black w-8">Rate</th>
                            <th className="border-r border-black p-0.5 border-t border-black w-12">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: nights }).map((_, i) => {
                            const d = new Date(checkInDate);
                            d.setDate(d.getDate() + i);
                            const rowTotal = dailyTaxable + dailyCgst + dailySgst;
                            return (
                              <tr key={i} className="align-middle h-6">
                                <td className="border-r border-black p-1 text-left font-mono font-bold">{roomNum} {format(d, "dd-MMM")}</td>
                                <td className="border-r border-black p-1 text-right font-mono">{dailyTariff.toFixed(2)}</td>
                                <td className="border-r border-black p-1 text-right">-</td>
                                <td className="border-r border-black p-1 text-right">-</td>
                                <td className="border-r border-black p-1 text-right font-mono">{dailyTaxable.toFixed(2)}</td>
                                <td className="border-r border-black p-1 text-center font-mono">6%</td>
                                <td className="border-r border-black p-1 text-right font-mono">{dailyCgst.toFixed(2)}</td>
                                <td className="border-r border-black p-1 text-center font-mono">6%</td>
                                <td className="border-r border-black p-1 text-right font-mono">{dailySgst.toFixed(2)}</td>
                                <td className="border-r border-black p-1 text-right">-</td>
                                <td className="border-r border-black p-1 text-right">-</td>
                                <td className="p-1 text-right font-mono font-bold">{rowTotal.toFixed(2)}</td>
                              </tr>
                            );
                          })}

                          {/* Filler empty rows to give physical ledger appearance */}
                          <tr className="h-10">
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black"></td>
                            <td></td>
                          </tr>

                          {/* SUB TOTAL ROW (EXACT TO PHOTO 1) */}
                          <tr className="border-t border-b border-black font-bold bg-gray-50 h-7">
                            <td className="border-r border-black p-1 text-left font-black">Sub Total</td>
                            <td className="border-r border-black p-1 text-right font-mono font-bold">{totalTariff.toFixed(2)}</td>
                            <td className="border-r border-black p-1 text-right">-</td>
                            <td className="border-r border-black p-1 text-right">-</td>
                            <td className="border-r border-black p-1 text-right font-mono font-bold">{totalTaxable.toFixed(2)}</td>
                            <td className="border-r border-black p-1 text-right font-mono font-bold" colSpan={2}>{totalCgst.toFixed(2)}</td>
                            <td className="border-r border-black p-1 text-right font-mono font-bold" colSpan={2}>{totalSgst.toFixed(2)}</td>
                            <td className="border-r border-black p-1 text-right">{totalFnb ? totalFnb.toFixed(2) : "-"}</td>
                            <td className="border-r border-black p-1 text-right">-</td>
                            <td className="p-1 text-right font-mono font-black">{grandTotal.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* BOTTOM SUMMARY SECTION (EXACT TO PHOTO 1) */}
                      <div className="flex border-b border-black min-h-[7.5rem]">
                        {/* Left Side: Advance & Service Bills Notes */}
                        <div className="w-3/4 border-r border-black p-1.5 flex flex-col justify-between text-[9px]">
                          <div>
                            <div className="flex font-bold">
                              <span className="w-16">Advance</span>
                              <span className="flex-1 font-mono">
                                {advanceAmount > 0 ? (
                                  <span>| {format(checkInDate, "dd.MM")}. Rs.{advanceAmount} (#{billNo}): {advanceMethod}</span>
                                ) : (
                                  <span>— None recorded</span>
                                )}
                              </span>
                            </div>

                            <div className="text-center mt-1.5 font-mono text-blue-900 tracking-tight italic text-[8.5px]">
                              NET TRANSFER Ref.No. Dt.{format(checkInDate, "dd-MM-yy")}<br />
                              Reservation Adv. to be Adjust<br />
                              #{billNo} dt. {format(checkInDate, "dd/MM/yy")}.
                            </div>
                          </div>

                          <div>
                            <div className="font-bold flex">
                              <span className="w-28">Balance Rupees:</span>
                              <span className="uppercase font-mono font-black text-black">{numberToWords(roundedNet)}</span>
                            </div>
                            <div className="mt-0.5">
                              <span className="font-bold">Service Bills:</span>
                              <span className="font-mono ml-1 text-[8.5px]">
                                {totalFnb > 0 ? `| ${format(checkInDate, "dd.MM")}. Rs.${totalFnb} (#POS) |` : "— None recorded"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Advance, Round Off, Net Box */}
                        <div className="w-1/4">
                          <div className="flex h-7 border-b border-black font-bold items-center text-[9.5px]">
                            <div className="w-2/3 p-1 border-r border-black h-full flex items-center">Advance</div>
                            <div className="w-1/3 p-1 text-right font-mono">{advanceAmount.toFixed(2)}</div>
                          </div>
                          <div className="flex h-7 border-b border-black font-bold items-center text-[9.5px]">
                            <div className="w-2/3 p-1 border-r border-black h-full flex items-center">Round Off</div>
                            <div className="w-1/3 p-1 text-right font-mono">{roundOff.toFixed(2)}</div>
                          </div>
                          <div className="flex h-8 font-bold bg-gray-50 items-center text-[10px]">
                            <div className="w-2/3 p-1 border-r border-black h-full flex items-center font-black">Net</div>
                            <div className="w-1/3 p-1 text-right font-black font-mono text-sm">{roundedNet.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      {/* FOOTER SECTION (EXACT TO PHOTO 1) */}
                      <div className="p-2 relative h-32 text-[9px]">
                        <div className="w-1/2 space-y-0.5">
                          <p>*Regardless of the billing instruction, I agree to be held personally liable for the payment of the total amount of bill for my stay in the hotel.</p>
                          <p>*All disputes subject to BENGALURU Jurisdiction.</p>
                        </div>

                        <div className="absolute top-2 right-2 text-right">
                          <p>Certified that the particulars given above are true and correct.</p>
                          <p className="mt-1 font-bold">For YES HOTELS</p>
                        </div>

                        {/* Room Key Icon & Return Notice */}
                        <div className="absolute top-12 w-full text-center flex justify-center items-center gap-1.5 font-bold text-[9.5px]">
                          <Key size={14} className="text-gray-700 rotate-90" />
                          <span>We Request You To Return The Room Key</span>
                        </div>

                        <div className="absolute bottom-6 left-2 font-bold uppercase text-[9.5px]">
                          Guest Signatory
                        </div>

                        <div className="absolute bottom-2 right-2 text-right">
                          <p className="font-bold uppercase text-[9px]">USER</p>
                          <p className="font-bold uppercase text-[9.5px]">Authorised Signatory</p>
                        </div>

                        <div className="absolute bottom-1 w-full text-center font-bold text-[9.5px]">
                          Thank You! Visit Again!
                        </div>

                        <div className="absolute bottom-0 right-1 text-[8px] text-gray-500">
                          E.&amp;O.E.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global Print Styles Injection */}
      <style>{`
        @media print {
          @page { size: portrait; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:break-after-page { page-break-after: always; break-after: page; }
        }
      `}</style>
    </div>
  );
}
