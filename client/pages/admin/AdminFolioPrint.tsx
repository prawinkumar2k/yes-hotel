import { usePrintLayout } from "@/lib/usePrintLayout";
import { useEffect, useMemo, useState } from "react";
import { buildInvoiceRows } from "@/lib/invoiceRows";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import StayExtensionNote from "@/components/admin/StayExtensionNote";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format, differenceInDays } from "date-fns";
import { Loader2, Printer, Key, ArrowLeft, FileCheck2, Building2, CheckCircle2 } from "lucide-react";

// Number to words helper
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

export default function AdminFolioPrint() {
  usePrintLayout("portrait", 8);
  // Shown inside the registration pop-up: hide this page's own toolbar.
  const embedded = typeof window !== "undefined" && window.self !== window.top;
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // If URL has ?single=true, start with single room view; otherwise default to group view
  const [isGroupFolio, setIsGroupFolio] = useState(searchParams.get("single") !== "true");
  const [activeBookingId, setActiveBookingId] = useState<string>(id || "");

  useEffect(() => {
    if (id) setActiveBookingId(id);
  }, [id]);

  const { data: bookingData, isLoading: isBookingLoading } = useQuery({
    queryKey: ["adminBooking", activeBookingId],
    queryFn: async () => {
      const res = await api.get(`/admin/bookings/${activeBookingId}`);
      return res.data;
    },
    enabled: !!activeBookingId,
  });

  const { data: folioData, isLoading: isFolioLoading } = useQuery({
    queryKey: ["folio", activeBookingId, isGroupFolio],
    queryFn: async () => {
      const res = await api.get(`/folios/booking/${activeBookingId}${isGroupFolio ? '?group=true' : '?single=true'}`);
      return res.data;
    },
    enabled: !!activeBookingId,
  });

  const { data: advancesData } = useQuery({
    queryKey: ["advancesForBooking", activeBookingId],
    queryFn: async () => {
      const res = await api.get(`/advances?bookingId=${activeBookingId}`);
      return res.data;
    },
    enabled: !!activeBookingId,
  });

  useEffect(() => {
    document.body.classList.add("print-page");
    return () => {
      document.body.classList.remove("print-page");
    };
  }, []);

  const booking = bookingData?.data;
  const folio = folioData?.data?.folio;
  const lines = folioData?.data?.lines || [];
  const advancesList: any[] = Array.isArray(advancesData?.data) ? advancesData.data : (advancesData?.data?.advances || []);
  const groupBookings: any[] = folioData?.data?.groupBookings || booking?.groupBookings || [];
  const isMultiRoomGroup = groupBookings.length > 1 || folioData?.data?.isGroup;

  const nights = booking ? (differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)) || 1) : 1;

  // Process rows day-by-day with room number breakdown
  const groupedData = useMemo(() => {
    if (!booking) return [];

    const debitLines = lines.filter((l: any) => l.direction !== "CREDIT");
    const defaultRoomNum = booking?.assignedRoom?.roomNumber || "—";

    if (debitLines.length > 0) {
      // One row per room and night, with the GST of that night (shared helper).
      return buildInvoiceRows(debitLines, defaultRoomNum);
    }

    // Default: generate itemized day-by-day charges if no ledger lines
    const rows = [];
    const checkIn = new Date(booking.checkInDate);
    // The booking's own value excluding GST (correct whether or not its prices include GST).
    const dailyTariff = Math.round(((booking.totalAmount - (booking.taxAmount || 0)) / nights) * 100) / 100;
    const dailyExtBed = 0;
    const dailyTaxable = dailyTariff + dailyExtBed;
    // Tax actually charged on the booking, spread per night (never a guessed rate).
    const dailyCgst = Math.round(((booking.cgstAmount ?? (booking.taxAmount || 0) / 2) / Math.max(1, nights)) * 100) / 100;
    const dailySgst = Math.round(((booking.sgstAmount ?? (booking.taxAmount || 0) / 2) / Math.max(1, nights)) * 100) / 100;

    for (let i = 0; i < nights; i++) {
      const curr = new Date(checkIn);
      curr.setDate(curr.getDate() + i);
      const dStr = format(curr, "dd-MMM");
      rows.push({
        description: `${defaultRoomNum} ${dStr}`,
        tariff: dailyTariff,
        extBed: dailyExtBed,
        disc: 0,
        cgst: dailyCgst,
        sgst: dailySgst,
        fnb: 0,
        others: 0,
      });
    }
    return rows;
  }, [lines, booking, nights]);

  if (isBookingLoading || isFolioLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="animate-spin text-hotel-gold" size={32} />
      </div>
    );
  }

  if (!booking) {
    return <div className="p-8 text-center text-red-600 font-bold">Booking not found.</div>;
  }

  const totals = groupedData.reduce((acc, row: any) => {
    acc.tariff += row.tariff;
    acc.extBed += row.extBed;
    acc.disc += row.disc;
    acc.cgst += row.cgst;
    acc.sgst += row.sgst;
    acc.fnb += row.fnb;
    acc.others += row.others;
    return acc;
  }, { tariff: 0, extBed: 0, disc: 0, cgst: 0, sgst: 0, fnb: 0, others: 0 });

  const taxableValue = totals.tariff + totals.extBed - totals.disc;
  const grandTotal = taxableValue + totals.cgst + totals.sgst + totals.fnb + totals.others;

  // Separate genuine advance deposits from checkout payments
  const advanceLines = lines.filter((l: any) => l.direction === "CREDIT" && (l.lineType === "ADVANCE_ADJUSTMENT" || l.lineType === "ADVANCE" || l.description?.toLowerCase().includes("adv")));
  const checkoutPaymentLines = lines.filter((l: any) => l.direction === "CREDIT" && (l.lineType === "PAYMENT" || l.description?.toLowerCase().includes("checkout") || l.description?.toLowerCase().includes("settl")));

  const advanceFromAdvanceLines = advanceLines.reduce((s: number, a: any) => s + a.amount, 0);
  const advanceFromList = advancesList.reduce((s: number, a: any) => s + (a.amount || 0), 0);
  const advanceTotal = advanceFromAdvanceLines > 0 ? advanceFromAdvanceLines : (advanceFromList > 0 ? advanceFromList : (booking.advanceAmount || 0));

  const checkoutSettledTotal = checkoutPaymentLines.reduce((s: number, a: any) => s + a.amount, 0);
  const totalPaid = advanceTotal + checkoutSettledTotal;

  // True outstanding balance:
  const net = Math.max(0, grandTotal - totalPaid);
  const roundedNet = Math.round(net);
  const roundOff = Number((roundedNet - net).toFixed(2));

  // Determine display room numbers and invoice numbers
  const allRoomsStr = groupBookings.length > 0 
    ? groupBookings.map(b => b.roomNumber).filter(Boolean).join(", ")
    : folioData?.data?.roomsSummary || booking.assignedRoom?.roomNumber || "—";

  const displayRoomHeader = isGroupFolio && isMultiRoomGroup
    ? `${allRoomsStr} (${booking.roomCategory?.name?.substring(0,3).toUpperCase() || "—"})`
    : `${booking.assignedRoom?.roomNumber || "—"} (${booking.roomCategory?.name?.substring(0,3).toUpperCase() || "—"})`;

  // The GST invoice number exists only once the folio is settled at checkout. Before that this
  // sheet is a provisional bill and shows no invoice number.
  const issuedFolios: any[] = (isGroupFolio && folioData?.data?.groupFolios?.length ? folioData.data.groupFolios : [folio]).filter(Boolean);
  const issuedInvoiceNos = issuedFolios.map((f: any) => f.invoiceNumber).filter(Boolean);
  const isProvisional = issuedInvoiceNos.length === 0;
  const invoiceNo = isProvisional ? "Issued at checkout" : issuedInvoiceNos.join(" / ");
  const invoiceDate = !isProvisional && issuedFolios.find((f: any) => f.invoiceNumber)?.closedAt ? new Date(issuedFolios.find((f: any) => f.invoiceNumber).closedAt) : new Date();

  const creditLines = lines.filter((l: any) => l.direction === "CREDIT");
  const primaryAdvance = creditLines[0] || advancesList[0] || null;

  return (
    <>
      <div className="min-h-screen bg-white text-black p-4 font-sans print:p-0 print:m-0 mx-auto max-w-[850px]">
        {/* Top Control Bar (Hidden on print) */}
        <div className={`print:hidden mb-4 bg-gray-100 p-3 rounded-xl border border-gray-300 shadow-sm space-y-3${embedded ? " hidden" : ""}`}>
          <div className="flex flex-wrap justify-between items-center gap-3">
            <Link
              to={`/admin/front-desk`}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black transition"
            >
              <ArrowLeft size={16} /> Back to Front Desk
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to={`/admin/bookings/${activeBookingId}/grc-print`}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded text-xs font-bold text-gray-800 transition shadow-sm"
              >
                <FileCheck2 size={15} /> View Registration Card (GRC)
              </Link>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-hotel-gold font-bold uppercase text-xs rounded hover:bg-gray-800 transition shadow"
              >
                <Printer size={16} /> Print GST Invoice
              </button>
            </div>
          </div>

          {/* Multi-Room Group Selector Pills */}
          {isMultiRoomGroup && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                <Building2 size={14} className="text-amber-600" />
                Select Bill View:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupFolio(true)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                    isGroupFolio
                      ? "bg-amber-600 text-white shadow"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <CheckCircle2 size={12} className={isGroupFolio ? "inline" : "hidden"} />
                  Combined Group Bill (Rooms {allRoomsStr})
                </button>
                {groupBookings.map((gb: any) => (
                  <button
                    key={gb._id}
                    type="button"
                    onClick={() => {
                      setIsGroupFolio(false);
                      setActiveBookingId(gb._id);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                      !isGroupFolio && activeBookingId === gb._id
                        ? "bg-stone-900 text-white shadow"
                        : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Room {gb.roomNumber} Only
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GST INVOICE SHEET (EXACT REPLICA OF PHOTO 1) */}
        <div className="border border-black text-[10px] sm:text-[11px] leading-tight font-medium bg-white">
          {/* HEADER SECTION */}
          <div className="flex border-b border-black">
            <div className="w-1/3 p-2 flex items-center justify-center border-r border-black">
               <div className="flex flex-col items-center">
                 <img src="/brand/yes-hotels-logo-sm.png" alt="YES HOTELS" className="h-16 w-auto object-contain mb-1 print:h-14" />
                 <h1 className="font-serif text-3xl font-black italic tracking-widest uppercase">YES HOTELS</h1>
               </div>
            </div>
            <div className="w-2/3 p-2 text-right">
               <HotelDocAddress />
            </div>
          </div>

          {/* INVOICE TITLE */}
          <div className="text-center border-b border-black py-1 font-bold text-sm bg-gray-100 relative">
            {isProvisional ? "PROVISIONAL BILL (NOT A TAX INVOICE)" : "GST INVOICE"}
            <div className="absolute right-2 top-1 text-[9px] font-normal">ACCOUNTS COPY - DUPLICATE</div>
          </div>

          {/* INFO ROW 1 */}
          <div className="flex border-b border-black">
            <div className="w-1/2 p-1 border-r border-black grid grid-cols-[80px_1fr] gap-1">
              <div>Invoice No.</div><div>: {invoiceNo}</div>
              <div>Date</div><div>: {format(invoiceDate, "dd-MMM-yy")}</div>
              <div>State</div><div>: KARNATAKA</div>
            </div>
            <div className="w-1/4 p-1 border-r border-black grid grid-cols-[60px_1fr] gap-1">
              <div>GRC #</div><div>: {booking.bookingReference || "—"}</div>
              <div>Bill No.</div><div>: {booking.billNumber || "—"}</div>
              <div>State Code</div><div>: 29</div>
            </div>
            <div className="w-1/4 p-1 grid grid-cols-[60px_1fr] gap-1">
              <div>SAC Code</div><div>: 996311</div>
              <div>POS</div><div>: KARNATAKA</div>
            </div>
          </div>

          {/* INFO ROW 2 */}
          <div className="flex border-b border-black min-h-[8.5rem]">
            <div className="w-1/2 p-1 border-r border-black">
              <div className="grid grid-cols-[80px_1fr] gap-x-1 gap-y-0.5">
                <div>Guest</div><div className="font-bold uppercase">MR/MS {booking.guestDetails.firstName} {booking.guestDetails.lastName}</div>
                <div>Address</div><div className="uppercase">{booking.guestDetails.address || "—"}</div>
                <div>Mobile</div><div>{String(booking.guestDetails.phone || booking.guestDetails.phoneNumber || "").replace(/^[^\d+]+/, "") || "—"}</div>
                <div>Email</div><div className="break-all">{booking.guestDetails.email && !/@yes-?hotels\.local$/i.test(booking.guestDetails.email) ? booking.guestDetails.email : "—"}</div>
                <div>GSTIN / UIN</div><div>: {booking.guestDetails.gstin || "—"}</div>
                <div>State</div><div>: KARNATAKA <span className="float-right mr-4">State Code 29</span></div>
              </div>
            </div>
            <div className="w-1/2 p-1 grid grid-cols-[80px_1fr_80px_1fr] gap-1 content-start pb-2">
               <div>Arr Date</div><div>: {format(new Date(booking.checkInDate), "dd-MMM-yy")}</div>
               <div>Room No</div><div className="font-bold">: {displayRoomHeader}</div>
               <div>Arr Time</div><div>: {booking.arrivalTime || "12:00"}</div><div className="col-span-2"></div>
               <div>Dept Date</div><div>: {format(new Date(booking.checkOutDate), "dd-MMM-yy")}</div><div className="col-span-2"></div>
               <div>Dept Time</div><div>: {booking.departureTime || "11:00"}</div><div className="col-span-2"></div>
               <div>Stay Days</div><div>: {nights}</div><div className="col-span-2"></div>
               <div>Meal Plan</div><div>: {booking.mealPlan || "EP"}</div><div className="col-span-2"></div>
               <div>Rate/Night</div><div>: {Number(booking.ratePerNight || 0).toFixed(2)}{booking.pricesIncludeTax ? " (incl. GST)" : ""}</div><div className="col-span-2"></div>
               <div className="col-span-4 mt-1 font-bold">M {booking.adults || 1} F 0 C {booking.children || 0}</div>
               <StayExtensionNote booking={booking} className="col-span-4" />
            </div>
          </div>

          {/* TABLE */}
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>Description</th>
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>Tariff</th>
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>Ext Bed</th>
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>Disc</th>
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>Taxable<br/>Value</th>
                <th className="border-r border-black p-1 font-normal" colSpan={2}>CGST</th>
                <th className="border-r border-black p-1 font-normal" colSpan={2}>SGST</th>
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>F&B</th>
                <th className="border-r border-black p-1 font-normal" rowSpan={2}>Others</th>
                <th className="p-1 font-normal" rowSpan={2}>Total</th>
              </tr>
              <tr className="border-b border-black">
                <th className="border-r border-black p-1 border-t border-black font-normal">Rate</th>
                <th className="border-r border-black p-1 border-t border-black font-normal">Amount</th>
                <th className="border-r border-black p-1 border-t border-black font-normal">Rate</th>
                <th className="border-r border-black p-1 border-t border-black font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((row: any, i: number) => {
                const rowTaxable = row.tariff + row.extBed - row.disc;
                const rowTotal = rowTaxable + row.cgst + row.sgst + row.fnb + row.others;
                const cgstRate = rowTaxable > 0 && row.cgst > 0
                  ? `${Number(((row.cgst / rowTaxable) * 100).toFixed(1))}%`
                  : "0%";
                const sgstRate = rowTaxable > 0 && row.sgst > 0
                  ? `${Number(((row.sgst / rowTaxable) * 100).toFixed(1))}%`
                  : "0%";
                return (
                  <tr key={i} className="align-top h-8">
                    <td className="border-r border-black p-1 text-left font-mono font-bold">{row.description}</td>
                    <td className="border-r border-black p-1 text-right">{row.tariff ? row.tariff.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1 text-right">{row.extBed ? row.extBed.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1 text-right">{row.disc ? row.disc.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1 text-right">{rowTaxable ? rowTaxable.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1">{cgstRate}</td>
                    <td className="border-r border-black p-1 text-right">{row.cgst > 0 ? row.cgst.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1">{sgstRate}</td>
                    <td className="border-r border-black p-1 text-right">{row.sgst > 0 ? row.sgst.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1 text-right">{row.fnb ? row.fnb.toFixed(2) : "-"}</td>
                    <td className="border-r border-black p-1 text-right">{row.others ? row.others.toFixed(2) : "-"}</td>
                    <td className="p-1 text-right font-bold">{rowTotal ? rowTotal.toFixed(2) : "-"}</td>
                  </tr>
                );
              })}
              {/* Fill empty space to make table look like physical invoice */}
              <tr className="h-16">
                <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
              </tr>
              {/* SUB TOTAL ROW */}
              <tr className="border-t border-b border-black font-bold bg-gray-50">
                <td className="border-r border-black p-1 text-left font-black">Sub Total</td>
                <td className="border-r border-black p-1 text-right font-bold">{totals.tariff.toFixed(2)}</td>
                <td className="border-r border-black p-1 text-right">{totals.extBed ? totals.extBed.toFixed(2) : "-"}</td>
                <td className="border-r border-black p-1 text-right">{totals.disc ? totals.disc.toFixed(2) : "-"}</td>
                <td className="border-r border-black p-1 text-right font-bold">{taxableValue.toFixed(2)}</td>
                <td className="border-r border-black p-1 bg-white font-bold" colSpan={2}>{totals.cgst ? totals.cgst.toFixed(2) : "-"}</td>
                <td className="border-r border-black p-1 bg-white font-bold" colSpan={2}>{totals.sgst ? totals.sgst.toFixed(2) : "-"}</td>
                <td className="border-r border-black p-1 text-right">{totals.fnb ? totals.fnb.toFixed(2) : "-"}</td>
                <td className="border-r border-black p-1 text-right">{totals.others ? totals.others.toFixed(2) : "-"}</td>
                <td className="p-1 text-right font-black">{grandTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* BOTTOM SECTION */}
          <div className="flex h-32">
            {/* Left bottom details */}
            <div className="w-3/4 border-r border-black p-1 relative flex flex-col justify-between">
              <div>
                 <div className="flex font-bold">
                   <div className="w-20">Advance</div>
                   <div className="flex-1 font-mono text-[9px]">
                     {advanceLines.length > 0 ? (
                       advanceLines.map((a: any, i: number) => (
                         <span key={i} className="mr-2">| {format(new Date(a.date), "dd.MM")}. Rs.{a.amount} ({a.paymentReference || "ADV"}): {a.paymentMode || "—"} </span>
                       ))
                     ) : advanceTotal > 0 ? (
                       <span>| {format(new Date(booking.checkInDate), "dd.MM")}. Rs.{advanceTotal} ({primaryAdvance?.advanceNumber || "ADV"}): {primaryAdvance?.method || primaryAdvance?.paymentMode || "—"} </span>
                     ) : (
                       <span>-</span>
                     )}
                   </div>
                 </div>
                 {Number(booking.discountAmount || 0) > 0 && (
                   <div className="flex font-bold mt-0.5 text-[9px]">
                     <div className="w-20">Discount</div>
                     <div className="flex-1 font-mono">Rs.{Number(booking.discountAmount).toFixed(2)}{booking.discountType === "PERCENT" ? ` (${booking.discountValue}%)` : ""} given to the guest, already deducted from the tariff{booking.discountReason ? ` — ${booking.discountReason}` : ""}</div>
                   </div>
                 )}
                 {checkoutPaymentLines.length > 0 && (
                   <div className="flex font-bold mt-0.5 text-[9px]">
                     <div className="w-20 text-gray-700">Settlement</div>
                     <div className="flex-1 font-mono text-green-800">
                       {checkoutPaymentLines.map((p: any, i: number) => (
                         <span key={i} className="mr-2">| {format(new Date(p.date), "dd.MM")}. Rs.{p.amount} ({p.paymentReference || "PAID"}): {p.paymentMode || "—"} </span>
                       ))}
                     </div>
                   </div>
                 )}
                 <div className="mt-1.5 text-[9px]">
                   <span className="font-bold">Mode of Payment: </span>
                   <span className="font-mono">
                     {(() => {
                       // Sum of money received by mode: advances and payments on this bill (from the linked records).
                       const byMode = new Map<string, number>();
                       const add = (mode: string | undefined, amt: number) => byMode.set(mode || "Not recorded", (byMode.get(mode || "Not recorded") || 0) + (Number(amt) || 0));
                       if (advanceLines.length > 0) advanceLines.forEach((l: any) => add(l.paymentMode, l.amount));
                       else advancesList.forEach((x: any) => add(x.method, x.amount));
                       checkoutPaymentLines.forEach((l: any) => add(l.paymentMode, l.amount));
                       return byMode.size === 0
                         ? "— No payment received yet"
                         : [...byMode.entries()].map(([m, v]) => `${m} ₹${v.toLocaleString("en-IN")}`).join("  |  ");
                     })()}
                   </span>
                 </div>
              </div>
              
              <div>
                 <div className="font-bold flex mt-2">
                   <span className="w-32">Balance Rupees:</span>
                   <span className="uppercase font-mono text-[9px]">{numberToWords(roundedNet)}</span>
                 </div>
                 <div className="mt-0.5">
                   <span className="font-bold">Service Bills:</span>
                   <span className="text-[9px] ml-1 font-mono">
                     {totals.fnb > 0 ? `|${format(new Date(), "dd.MM")}. Rs.${totals.fnb} (#POS) |` : "— None recorded"}
                   </span>
                 </div>
              </div>
            </div>
            
            {/* Right bottom totals */}
            <div className="w-1/4">
               <div className="flex h-1/3 border-b border-black font-bold items-center">
                  <div className="w-2/3 p-1 border-r border-black h-full flex items-center">Advance</div>
                  <div className="w-1/3 p-1 text-right">{advanceTotal.toFixed(2)}</div>
               </div>
               <div className="flex h-1/3 border-b border-black font-bold items-center">
                  <div className="w-2/3 p-1 border-r border-black h-full flex items-center">Round Off</div>
                  <div className="w-1/3 p-1 text-right">{roundOff.toFixed(2)}</div>
               </div>
               <div className="flex h-1/3 font-bold bg-gray-50 items-center">
                  <div className="w-2/3 p-1 border-r border-black h-full flex items-center font-black">Net</div>
                  <div className="w-1/3 p-1 text-right font-black text-sm">{roundedNet.toFixed(2)}</div>
               </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-black p-2 relative h-32">
            <div className="text-[9px] w-1/2">
               <p>*Regardless of the billing instruction, I agree to be held personally liable for the payment of the total amount of bill for my stay in the hotel.</p>
               <p>*All disputes subject to BENGALURU Jurisdiction.</p>
            </div>
            <div className="absolute top-2 right-2 text-right">
               <p>Certified that the particulars given above are true and correct.</p>
               <p className="mt-2 font-bold">For YES HOTELS</p>
            </div>
            
            <div className="absolute top-12 w-full text-center flex justify-center items-center gap-2 text-[10px] font-bold">
              <Key size={14} className="text-gray-600 rotate-90" />
              We Request You To Return The Room Key
            </div>
            
            <div className="absolute bottom-6 left-2 font-bold uppercase text-[10px]">
              Guest Signatory
            </div>
            
            <div className="absolute bottom-2 right-2 text-right">
              <p className="font-bold uppercase text-[10px]">USER</p>
              <p className="font-bold uppercase text-[10px]">Authorised Signatory</p>
            </div>
            
            <div className="absolute bottom-0 w-full text-center text-[10px] font-bold">
              Thank You! Visit Again!
            </div>
            
            <div className="absolute -bottom-4 right-0 text-[8px]">E.&.O.E.</div>
          </div>
        </div>
      </div>
    </>
  );
}
