import { advanceInfo, settlementKind } from "@/lib/advanceInfo";
import { usePrintLayout } from "@/lib/usePrintLayout";
import { useState, useMemo, useEffect } from "react";
import { buildInvoiceRows } from "@/lib/invoiceRows";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { hotelContactFrom, useHotelSettings } from "@/hooks/usePublicData";
import StayExtensionNote from "@/components/admin/StayExtensionNote";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, FileCheck2, Receipt, ArrowLeft, ArrowRight, Key, ShieldCheck, CheckCircle2, Building2, Search } from "lucide-react";

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

function BookingDocCard({
  booking,
  docType,
}: {
  booking: any;
  docType: "BOTH" | "GRC" | "GST";
}) {
  const [isGroupFolio, setIsGroupFolio] = useState(true);
  const [activeBookingId, setActiveBookingId] = useState<string>(booking._id);
  const { data: hotelSettings } = useHotelSettings();
  const hotelContact = hotelContactFrom(hotelSettings);

  useEffect(() => {
    setActiveBookingId(booking._id);
  }, [booking._id]);

  // Fetch individual booking details (including populated groupBookings)
  const { data: bookingDetailData } = useQuery({
    queryKey: ["adminBooking", activeBookingId],
    queryFn: async () => {
      const res = await api.get(`/admin/bookings/${activeBookingId}`);
      return res.data;
    },
    enabled: !!activeBookingId,
  });

  // Fetch folio data with group=true / single=true support
  const { data: folioData } = useQuery({
    queryKey: ["folio", activeBookingId, isGroupFolio],
    queryFn: async () => {
      const res = await api.get(`/folios/booking/${activeBookingId}${isGroupFolio ? "?group=true" : "?single=true"}`);
      return res.data;
    },
    enabled: !!activeBookingId,
  });

  // Fetch advances
  const { data: advancesData } = useQuery({
    queryKey: ["advancesForBooking", activeBookingId],
    queryFn: async () => {
      const res = await api.get(`/advances?bookingId=${activeBookingId}`);
      return res.data;
    },
    enabled: !!activeBookingId,
  });

  const b = bookingDetailData?.data || booking;
  const guest = b.guestDetails || {};
  const foreign = b.foreignGuestDetails;
  const nights = differenceInDays(new Date(b.checkOutDate), new Date(b.checkInDate)) || 1;
  const checkInDate = new Date(b.checkInDate);
  const checkOutDate = new Date(b.checkOutDate);

  const folio = folioData?.data?.folio;
  const lines = folioData?.data?.lines || [];
  const advancesList: any[] = Array.isArray(advancesData?.data) ? advancesData.data : (advancesData?.data?.advances || []);
  const groupBookings: any[] = folioData?.data?.groupBookings || b.groupBookings || [];
  const isMultiRoomGroup = groupBookings.length > 1 || folioData?.data?.isGroup;

  const defaultRoomNum = b.assignedRoom?.roomNumber || "101";
  const allRoomsStr = groupBookings.length > 0
    ? groupBookings.map((gb: any) => gb.roomNumber || gb.assignedRoom?.roomNumber).filter(Boolean).join(", ")
    : folioData?.data?.roomsSummary || defaultRoomNum;

  const displayRoomHeader = isGroupFolio && isMultiRoomGroup
    ? `${allRoomsStr} (${b.roomCategory?.name?.substring(0, 3).toUpperCase() || "STA"})`
    : `${defaultRoomNum} (${b.roomCategory?.name?.substring(0, 3).toUpperCase() || "STA"})`;

  // The GST invoice number exists only once the folio is settled at checkout. Before that this
  // sheet is a provisional bill and shows no invoice number.
  const issuedFolios: any[] = (isGroupFolio && folioData?.data?.groupFolios?.length ? folioData.data.groupFolios : [folio]).filter(Boolean);
  const issuedInvoiceNos = issuedFolios.map((f: any) => f.invoiceNumber).filter(Boolean);
  const isProvisional = issuedInvoiceNos.length === 0;
  const invoiceNo = isProvisional ? "Issued at checkout" : issuedInvoiceNos.join(" / ");
  const invoiceDate = !isProvisional && issuedFolios.find((f: any) => f.invoiceNumber)?.closedAt ? new Date(issuedFolios.find((f: any) => f.invoiceNumber).closedAt) : new Date();

  const billNo = b.billNumber || "—";
  const grcNo = b.billNumber || b.grcNumber || b.bookingReference || "—";

  // Process rows day-by-day with room number breakdown
  const debitLines = lines.filter((l: any) => l.direction !== "CREDIT");
  const groupedData = useMemo(() => {
    if (debitLines.length > 0) {
      // One row per room and night, with the GST of that night (shared helper).
      return buildInvoiceRows(debitLines, defaultRoomNum);
    }

    const rows = [];
    const checkIn = new Date(b.checkInDate);
    // The booking's own value excluding GST (correct whether or not its prices include GST).
    const dailyTariff = Math.round(((b.totalAmount - (b.taxAmount || 0)) / nights) * 100) / 100;
    const dailyExtBed = 0;
    const dailyTaxable = dailyTariff + dailyExtBed;
    // Tax actually charged on the booking, spread per night (never a guessed rate).
    const dailyCgst = Math.round(((b.cgstAmount ?? (b.taxAmount || 0) / 2) / Math.max(1, nights)) * 100) / 100;
    const dailySgst = Math.round(((b.sgstAmount ?? (b.taxAmount || 0) / 2) / Math.max(1, nights)) * 100) / 100;

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
  }, [lines, b, nights, defaultRoomNum]);

  const totals = groupedData.reduce((acc: any, row: any) => {
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

  const advanceLines = lines.filter((l: any) => l.direction === "CREDIT" && (l.lineType === "ADVANCE_ADJUSTMENT" || l.lineType === "ADVANCE" || l.description?.toLowerCase().includes("adv")));
  const checkoutPaymentLines = lines.filter((l: any) => l.direction === "CREDIT" && (l.lineType === "PAYMENT" || l.description?.toLowerCase().includes("checkout") || l.description?.toLowerCase().includes("settl")));

  const advanceFromAdvanceLines = advanceLines.reduce((s: number, a: any) => s + a.amount, 0);
  const advanceFromList = advancesList.reduce((s: number, a: any) => s + (a.amount || 0), 0);
  const advanceTotal = advanceFromAdvanceLines > 0 ? advanceFromAdvanceLines : (advanceFromList > 0 ? advanceFromList : (b.advanceAmount || 0));

  const checkoutSettledTotal = checkoutPaymentLines.reduce((s: number, a: any) => s + a.amount, 0);
  const totalPaid = advanceTotal + checkoutSettledTotal;

  const net = Math.max(0, grandTotal - totalPaid);
  const roundedNet = Math.round(net);
  const roundOff = Number((roundedNet - net).toFixed(2));

  const creditLines = lines.filter((l: any) => l.direction === "CREDIT");
  const primaryAdvance = creditLines[0] || advancesList[0] || null;

  // ID Type detection matching Photo 2
  const idType = (guest.idType || "").toUpperCase();
  const isAadhaar = idType.includes("AAD") || !idType;
  const isDL = idType.includes("DRIV") || idType.includes("DL");
  const isVoter = idType.includes("VOTER") || idType.includes("ECI") || idType.includes("E.C.I");
  const isGovt = !isAadhaar && !isDL && !isVoter;
  const advanceMethod = primaryAdvance?.method || (b.paymentMethod || "CASH").toUpperCase();
  const dailyTariff = b.ratePerNight ?? Math.round((b.totalAmount - (b.taxAmount || 0)) / nights);
  // Same facts as the single GRC / bill pages: advance receipts, settlement box, extras, discount, stay total, balance.
  const adv = advanceInfo({ advances: advancesList, lines, booking: b });
  const settle = settlementKind(b.billingInstruction, advanceMethod, b.paymentStatus === "PAID");
  const bookingTaxable = Math.max(0, Number(b.totalAmount || 0) - Number(b.taxAmount || 0));
  const extrasAmount = Math.max(0, Math.round((bookingTaxable - Number(b.ratePerNight || 0) * nights) * 100) / 100);
  const stayTotal = Number(b.totalAmount || 0);
  const balanceDue = Math.max(0, stayTotal - adv.total);
  const money = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const planLabel: Record<string, string> = { EP: "Room only", CP: "Breakfast", MAP: "Breakfast + one meal", AP: "All meals" };

  return (
    <div className="space-y-8 print:space-y-0">
      {/* Multi-Room Group Selector Pills (if multi-room group) */}
      {isMultiRoomGroup && (
        <div className="print:hidden bg-white p-3 rounded-xl border border-gray-300 shadow-sm flex flex-wrap items-center gap-2 max-w-[850px] mx-auto">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
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
                Room {gb.roomNumber || gb.assignedRoom?.roomNumber} Only
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENT 1: GUEST REGISTRATION CARD (GRC) — IDENTICAL TO ADMIN GRC PRINT */}
      {(docType === "BOTH" || docType === "GRC") && (
        <div className="bg-white p-4 print:p-0 mx-auto max-w-[850px] print:m-0 print:break-after-page">
          <div className="print:hidden flex justify-between items-center mb-2 pb-1 border-b border-gray-300 text-xs">
            <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck2 size={15} className="text-[#c9a227]" />
              GRC &bull; Room {allRoomsStr} &bull; {guest.firstName} {guest.lastName}
            </span>
            <span className="text-gray-500 font-mono">Bill #{billNo}</span>
          </div>

          <div className="border-2 border-black p-3 text-[11px] leading-tight font-sans bg-white">
            {/* HEADER SECTION */}
            <div className="border-b-2 border-black pb-2 text-center relative">
              <div className="flex items-center justify-between">
                <div className="text-left w-2/3">
                  <h1 className="text-3xl font-black tracking-widest font-serif uppercase text-black">
                    YES HOTELS
                  </h1>
                  <p className="text-[10px] text-gray-800 font-medium mt-0.5 leading-snug">
                    {hotelContact.address}<br />
                    Phone : {hotelContact.phone}{hotelSettings?.gstNumber ? ` · GSTIN : ${hotelSettings.gstNumber}` : ""}
                  </p>
                </div>
                <div className="text-right w-1/3 border-l border-black pl-3 py-1">
                  <div className="text-[11px] font-bold text-gray-800">
                    Bill No. <span className="text-red-700 text-lg font-black font-mono ml-1">{billNo}</span>
                  </div>
                  <div className="text-[9px] font-mono text-gray-600 mt-0.5">
                    Ref: {b.bookingReference}
                  </div>
                </div>
              </div>

              <div className="mt-2 border-t border-black pt-1">
                <h2 className="text-base font-black uppercase tracking-wider">
                  GUEST REGISTRATION CARD
                </h2>
                <p className="text-[9px] font-bold text-gray-700 uppercase tracking-tight">
                  THE REGISTRATION OF FOREIGNERS RULES - 1939 FORM - C HOTEL ARRIVAL REPORT, RULE 14, ID PROOF IS REQUIRED FOR CHECK - IN
                </p>
              </div>
            </div>

            {/* ID PROOF BANNER */}
            <div className="flex border-b border-black py-1.5 px-2 bg-gray-50 text-[11px] font-bold items-center justify-between">
              <div className="flex items-center gap-4">
                <span>ID :</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={isAadhaar} readOnly className="accent-black w-3.5 h-3.5" />
                  <span>AAD</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={isDL} readOnly className="accent-black w-3.5 h-3.5" />
                  <span>DL</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={isVoter} readOnly className="accent-black w-3.5 h-3.5" />
                  <span>E.C.I</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={isGovt} readOnly className="accent-black w-3.5 h-3.5" />
                  <span>Govt. ID</span>
                </label>
              </div>
              <div className="font-mono text-xs font-black">
                ID No. : <span className="tracking-wider bg-white px-2 py-0.5 border border-black">{guest.idNumber || "—"}</span>
              </div>
            </div>

            {/* MAIN 2-COLUMN SECTION */}
            <div className="grid grid-cols-12 border-b border-black">
              {/* LEFT COLUMN: OFFICE USE & FOREIGNERS BOX (5 COLS) */}
              <div className="col-span-5 border-r border-black p-2 space-y-3 bg-gray-50/50">
                {/* BOX 1: FOR OFFICE USE ONLY */}
                <div className="border border-black p-2 bg-white">
                  <div className="text-[10px] font-black uppercase text-center border-b border-black pb-1 mb-2 tracking-wide">
                    For Office Use Only
                  </div>
                  <div className="space-y-1.5 text-[10.5px]">
                    <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                      <span className="font-bold">Room No.</span>
                      <span className="font-black text-sm font-mono">{allRoomsStr}</span>
                      <span className="font-bold ml-2">Tariff</span>
                      <span className="font-black font-mono">₹{money(dailyTariff)}/-</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                      <span className="font-bold">Extra Bed</span>
                      <span className="font-mono">{Number(b.extraPersonsWithBed || 0) + Number(b.extraChildrenWithBed || 0) || "—"}</span>
                      <span className="font-bold ml-2">Bill No.</span>
                      <span className="font-mono">{billNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                      <span className="font-bold">Advance</span>
                      <span className="font-black font-mono text-green-800">₹{money(adv.total || advanceTotal)}/-</span>
                      <span className="font-bold ml-2">Receipt No.</span>
                      <span className="font-mono text-right">{adv.numbers.join(", ") || b.advanceReceiptNo || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                      <span className="font-bold">Stay Total</span>
                      <span className="font-black font-mono">₹{money(stayTotal)}/-</span>
                      <span className="font-bold ml-2">Balance</span>
                      <span className="font-black font-mono">₹{money(balanceDue)}/-</span>
                    </div>
                    {Number(b.discountAmount || 0) > 0 && (
                      <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                        <span className="font-bold">Discount given{b.discountType === "PERCENT" ? ` (${b.discountValue}%)` : ""}</span>
                        <span className="font-black font-mono text-green-800">− ₹{money(b.discountAmount)}/-</span>
                      </div>
                    )}
                    {extrasAmount > 0 && (
                      <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                        <span className="font-bold">Extra persons / children</span>
                        <span className="font-mono">₹{money(extrasAmount)}/-</span>
                      </div>
                    )}

                    <div className="pt-1">
                      <div className="font-bold text-[9px] uppercase text-gray-700">Billing Instruction / Settlement :</div>
                      <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={settle === "CASH"} readOnly className="accent-black w-3 h-3" /> Cash
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={settle === "CARD"} readOnly className="accent-black w-3 h-3" /> Card / DD
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={settle === "UPI"} readOnly className="accent-black w-3 h-3" /> UPI
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={settle === "NET"} readOnly className="accent-black w-3 h-3" /> Net Pay
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-dotted border-gray-400">
                      <div className="font-bold text-[9px] uppercase text-gray-700">Type of Plan :</div>
                      <div className="flex justify-between mt-1 text-[10px]">
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={b.mealPlan === "EP" || b.ratePlan === "EP" || (!b.mealPlan && !b.ratePlan)} readOnly className="accent-black w-3 h-3" /> EP
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={b.mealPlan === "CP" || b.ratePlan === "CP"} readOnly className="accent-black w-3 h-3" /> CP
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={b.mealPlan === "MAP" || b.ratePlan === "MAP"} readOnly className="accent-black w-3 h-3" /> MAP
                        </span>
                        <span className="flex items-center gap-1">
                          <input type="checkbox" checked={b.mealPlan === "AP" || b.ratePlan === "AP"} readOnly className="accent-black w-3 h-3" /> AP
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-between font-bold text-[10px]">
                      <span>B/ID No.</span>
                      <span className="font-mono">{b.otaBookingId || b.otaReference || b.otaConfirmationNumber || b.bookingReference}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold">Booked through</span>
                      <span className="font-mono">{String(b.source || "WALK_IN").replace(/_/g, " ")}{b.otaName ? ` (${b.otaName})` : ""}</span>
                    </div>
                  </div>
                </div>

                {/* BOX 2: FOR FOREIGNERS ONLY */}
                <div className="border border-black p-2 bg-white">
                  <div className="text-[10px] font-black uppercase text-center border-b border-black pb-1 mb-1.5 tracking-wide">
                    For Foreigners Only
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between border-b border-gray-200 pb-0.5">
                      <span className="font-semibold text-gray-700">Passport No.</span>
                      <span className="font-mono font-bold">{foreign?.passportNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-0.5">
                      <span className="font-semibold text-gray-700">Place of Issue</span>
                      <span>{foreign?.passportIssuePlace || "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-0.5">
                      <span className="font-semibold text-gray-700">Date of Issue</span>
                      <span>{foreign?.passportIssueDate ? format(new Date(foreign.passportIssueDate), "dd/MM/yyyy") : "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-0.5">
                      <span className="font-semibold text-gray-700">Date of Expiry</span>
                      <span>{foreign?.passportExpiryDate ? format(new Date(foreign.passportExpiryDate), "dd/MM/yyyy") : "—"}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-0.5">
                      <span className="font-semibold text-gray-700">Visa No.</span>
                      <span className="font-mono font-bold">{foreign?.visaNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-700">Visa Date / Place</span>
                      <span>{foreign?.visaDate ? format(new Date(foreign.visaDate), "dd/MM/yyyy") : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: GUEST DETAILS (7 COLS) */}
              <div className="col-span-7 p-3 space-y-2">
                <div className="border-b border-gray-300 pb-1">
                  <span className="text-[9px] uppercase font-bold text-gray-600 block">Name (in capital Letters)</span>
                  <span className="text-base font-black tracking-wider uppercase">
                    {guest.firstName} {guest.lastName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-gray-300 pb-1">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Designation</span>
                    <span className="font-semibold">{guest.designation || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Name of Organization</span>
                    <span className="font-semibold">{guest.organization || "—"}</span>
                  </div>
                </div>

                <div className="border-b border-gray-300 pb-1">
                  <span className="text-[9px] uppercase font-bold text-gray-600 block">Address</span>
                  <span className="font-medium">{guest.address || "—"}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-gray-300 pb-1">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Mobile No.</span>
                    <span className="font-mono font-bold">{guest.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Email</span>
                    <span className="font-mono text-[10px] truncate block">{guest.email || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-gray-300 pb-1">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Nationality</span>
                    <span className="font-semibold">{guest.nationality || "INDIAN"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">DOB / Age</span>
                    <span>{guest.dateOfBirth ? format(new Date(guest.dateOfBirth), "dd/MM/yyyy") : (guest.age ? `${guest.age} Yrs` : "—")}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Vehicle Reg. No.</span>
                    <span className="font-mono font-bold uppercase">{guest.vehicleNumber || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-gray-300 pb-1">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">No. of Persons</span>
                    <span className="font-bold">Adult: {b.adults || 1}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Child</span>
                    <span>{b.children || 0}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Stay Days</span>
                    <span className="font-bold">{nights} Day(s)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-gray-300 pb-1">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Date of Arr &amp; Time</span>
                    <span className="font-bold">{format(checkInDate, "dd/MM/yyyy")} &bull; {b.arrivalTime || "12:00 PM"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Date of Dep &amp; Time</span>
                    <span className="font-bold">{format(checkOutDate, "dd/MM/yyyy")} &bull; {b.departureTime || "11:00 AM"}</span>
                  </div>
                </div>
                <StayExtensionNote booking={b} className="-mt-1" />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Purpose of Visit</span>
                    <span className="font-semibold">{guest.purposeOfVisit || "Personal / Business"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Proceeding To</span>
                    <span className="font-semibold">{guest.proceedingTo || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-gray-300 pb-1">
                  <div><span className="text-[9px] uppercase font-bold text-gray-600 block">Room Type</span><span className="font-semibold">{b.roomCategory?.name || "—"}</span></div>
                  <div><span className="text-[9px] uppercase font-bold text-gray-600 block">Meal Plan</span><span className="font-semibold">{b.mealPlan || "EP"} ({planLabel[b.mealPlan || "EP"] || ""})</span></div>
                  <div><span className="text-[9px] uppercase font-bold text-gray-600 block">Rooms</span><span className="font-semibold">{groupBookings.length || 1}{allRoomsStr ? ` (${allRoomsStr})` : ""}</span></div>
                </div>
                {b.specialRequests && (
                  <div className="border-b border-gray-300 pb-1">
                    <span className="text-[9px] uppercase font-bold text-gray-600 block">Special requests / notes</span>
                    <span className="font-medium">{b.specialRequests}</span>
                  </div>
                )}

                {guest.gstin && (
                  <div className="pt-1 border-t border-gray-200">
                    <span className="text-[9px] uppercase font-bold text-gray-600">Company GSTIN: </span>
                    <span className="font-mono font-bold">{guest.gstin}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CUSTOMER PHOTO & ID PROOF ATTACHMENTS SECTION */}
            {guest.idProofImages && guest.idProofImages.length > 0 && (
              <div className="border-b border-black p-2 bg-gray-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5 mb-1.5">
                  <FileCheck2 size={13} className="text-black" />
                  Verified Customer KYC Documents &amp; Identity Records:
                </div>
                <div className="flex gap-4 overflow-x-auto py-1">
                  {guest.idProofImages.map((img: string, idx: number) => (
                    <div key={idx} className="border border-black bg-white p-1 rounded shadow-sm text-center">
                      {img.startsWith("data:image") || img.startsWith("http") ? (
                        <img
                          src={img}
                          alt={`Customer Document ${idx + 1}`}
                          className="h-28 w-44 object-contain rounded border border-gray-200"
                        />
                      ) : (
                        <div className="h-24 w-36 bg-gray-100 flex items-center justify-center text-[9px] text-gray-500">
                          ID Document #{idx + 1}
                        </div>
                      )}
                      <span className="text-[9px] font-bold text-gray-600 mt-1 block uppercase">
                        Document #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HOTEL RULES AND REGULATIONS & CONSENT FORM */}
            <div className="border-b border-black p-2.5 text-[9.5px] leading-tight space-y-1.5 bg-gray-50/30">
              <div className="font-black uppercase tracking-wider text-black flex items-center gap-1">
                <ShieldCheck size={13} />
                Hotel Rules, Regulations &amp; Guest Consent Terms:
              </div>
              <ol className="list-decimal pl-4 space-y-0.5 text-gray-800">
                <li><strong>Check-in: 12:00 Noon | Check-out: 11:00 AM.</strong> Extensions or late departures must be approved in advance by front office management.</li>
                <li><strong>Identity Verification:</strong> Valid original Govt Photo ID (Aadhaar / Voter ID / Passport / Driving License) is mandatory for every staying guest as per police directives.</li>
                <li><strong>Valuables:</strong> Guests are requested to deposit cash and jewelry in the hotel safe deposit lockers. Management shall not be responsible for loss of unattended valuables.</li>
                <li><strong>Non-Smoking Policy:</strong> Smoking, consumption of illegal contraband, and hazardous materials are strictly prohibited within rooms and indoor corridors.</li>
                <li><strong>Visitors Policy:</strong> Visitors are permitted strictly in public lobby lounges. Non-resident visitors are not permitted in guest rooms after 10:00 PM without formal registration.</li>
                <li><strong>Property Damages:</strong> Any damage, breakages, or staining to hotel fixtures, electronic equipment, or linen will be charged directly to the guest's folio.</li>
                <li><strong>Payment &amp; Liability:</strong> Regardless of third-party or corporate billing instructions, the undersigned guest agrees to remain personally liable for the full settlement of all bills.</li>
                <li><strong>Key Deposit:</strong> Room key cards must be returned to the reception counter upon check-out.</li>
              </ol>
              <div className="font-bold text-[9px] pt-1 text-black">
                DECLARATION: I hereby declare that all particulars given above are true and correct. I have read, understood, and agree to abide by the rules and regulations of YES HOTELS.
              </div>
            </div>

            {/* SIGNATURES SECTION */}
            <div className="grid grid-cols-3 pt-8 pb-3 text-center font-bold text-[10px] uppercase">
              <div className="px-4">
                <div className="border-t border-black pt-1">Receptionist</div>
              </div>
              <div className="px-4">
                <div className="border-t border-black pt-1">Front Office Manager</div>
              </div>
              <div className="px-4">
                <div className="border-t-2 border-black pt-1 font-black text-[11px]">Guest Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT 2: GST TAX INVOICE — IDENTICAL TO ADMIN FOLIO PRINT */}
      {(docType === "BOTH" || docType === "GST") && (
        <div className="bg-white p-4 print:p-0 mx-auto max-w-[850px] print:m-0 print:break-after-page">
          <div className="print:hidden flex justify-between items-center mb-2 pb-1 border-b border-gray-300 text-xs">
            <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt size={15} className="text-[#c9a227]" />
              GST Invoice &bull; Room {displayRoomHeader} &bull; Bill #{invoiceNo}
            </span>
            <span className="text-gray-500 font-mono">Invoice #{invoiceNo}</span>
          </div>

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
                <div>GRC #</div><div>: {b.billNumber || grcNo}</div>
                <div className="col-span-2">&nbsp;</div>
                <div>State Code</div><div>: 29</div>
              </div>
              <div className="w-1/4 p-1 grid grid-cols-[60px_1fr] gap-1">
                <div>SAC Code</div><div>: 996311</div>
                <div>POS</div><div>: KARNATAKA</div>
              </div>
            </div>

            {/* INFO ROW 2 */}
            <div className="flex border-b border-black min-h-[6rem]">
              <div className="w-1/2 p-1 border-r border-black">
                <div className="grid grid-cols-[80px_1fr] gap-x-1 gap-y-0.5">
                  <div>Guest</div><div className="font-bold uppercase">MR/MS {guest.firstName} {guest.lastName}</div>
                  <div>Address</div><div className="uppercase">{guest.address || "—"}</div>
                  <div>Mobile</div><div>{String(guest.phone || guest.phoneNumber || "").replace(/^[^\d+]+/, "") || "—"}</div>
                  <div>Email</div><div className="break-all">{guest.email && !/@yes-?hotels\.local$/i.test(guest.email) ? guest.email : "—"}</div>
                  <div>GSTIN / UIN</div><div>: {guest.gstin || "—"}</div>
                  <div>State</div><div>: KARNATAKA <span className="float-right mr-4">State Code 29</span></div>
                </div>
              </div>
              <div className="w-1/2 p-1 grid grid-cols-[80px_1fr_80px_1fr] gap-1 content-start pb-2">
                <div>Arr Date</div><div>: {format(checkInDate, "dd-MMM-yy")}</div>
                <div>Room No</div><div className="font-bold">: {displayRoomHeader}</div>
                <div>Arr Time</div><div>: {b.arrivalTime || "12:00"}</div><div className="col-span-2"></div>
                <div>Dept Date</div><div>: {format(checkOutDate, "dd-MMM-yy")}</div><div className="col-span-2"></div>
                <div>Dept Time</div><div>: {b.departureTime || "11:00"}</div><div className="col-span-2"></div>
                <div>Stay Days</div><div>: {nights}</div><div className="col-span-2"></div>
                <div>Meal Plan</div><div>: {b.mealPlan || "EP"}</div><div className="col-span-2"></div>
                <div>Rate/Night</div><div>: {Number(b.ratePerNight || 0).toFixed(2)}{b.pricesIncludeTax ? " (incl. GST)" : ""}</div><div className="col-span-2"></div>
                <div className="col-span-4 mt-1 font-bold">M {b.adults || 1} F 0 C {b.children || 0}</div>
                <StayExtensionNote booking={b} className="col-span-4" />
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
                  <th className="border-r border-black p-1 font-normal" rowSpan={2}>F&amp;B</th>
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
                    : "-%";
                  const sgstRate = rowTaxable > 0 && row.sgst > 0
                    ? `${Number(((row.sgst / rowTaxable) * 100).toFixed(1))}%`
                    : "-%";
                  return (
                    <tr key={i} className="align-top h-8">
                      <td className="border-r border-black p-1 text-left font-mono font-bold">
                      {row.description}
                      {(row.items ?? []).map((it: any, k: number) => (
                        <div key={k} className="font-sans font-normal text-[9px] leading-tight text-gray-800">↳ {it.description} — ₹{Number(it.amount).toFixed(2)}</div>
                      ))}
                    </td>
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
                {/* Empty space filler */}
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
                        <span>| {format(new Date(b.checkInDate), "dd.MM")}. Rs.{advanceTotal} ({primaryAdvance?.advanceNumber || "ADV"}): {primaryAdvance?.method || primaryAdvance?.paymentMode || "—"} </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </div>
                  {Number(b.discountAmount || 0) > 0 && (
                    <div className="flex font-bold mt-0.5 text-[9px]">
                      <div className="w-20">Discount</div>
                      <div className="flex-1 font-mono">Rs.{Number(b.discountAmount).toFixed(2)}{b.discountType === "PERCENT" ? ` (${b.discountValue}%)` : ""} given to the guest, already deducted from the tariff{b.discountReason ? ` — ${b.discountReason}` : ""}</div>
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

              <div className="absolute -bottom-4 right-0 text-[8px]">E.&amp;O.E.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBulkDocViewer() {
  usePrintLayout("portrait", 8);
  const [docType, setDocType] = useState<"BOTH" | "GRC" | "GST">("BOTH");
  const [viewMode, setViewMode] = useState<"PAGED" | "ALL">("PAGED");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // 1. Fetch All Bookings / Stays
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["bulk-doc-bookings", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      const res = await api.get(`/admin/bookings?${params.toString()}`);
      return res.data?.data?.bookings || [];
    },
    refetchInterval: 10000,
  });

  const rawBookings = bookingsData || [];

  // Filter by search query
  const bookings = useMemo(() => {
    if (!searchQuery.trim()) return rawBookings;
    const q = searchQuery.toLowerCase().trim();
    return rawBookings.filter((b: any) => {
      const name = `${b.guestDetails?.firstName || ""} ${b.guestDetails?.lastName || ""}`.toLowerCase();
      const room = (b.assignedRoom?.roomNumber || "").toLowerCase();
      const ref = (b.bookingReference || "").toLowerCase();
      const bill = (b.billNumber || "").toLowerCase();
      const phone = (b.guestDetails?.phone || "").toLowerCase();
      return name.includes(q) || room.includes(q) || ref.includes(q) || bill.includes(q) || phone.includes(q);
    });
  }, [rawBookings, searchQuery]);

  // Reset index when filter or search changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [statusFilter, searchQuery]);

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
              Review and print physical Guest Registration Cards (Photo 2) and GST Tax Invoices (Photo 1) across all guest stays.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-[#1e293b] hover:bg-black font-bold text-xs uppercase px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition cursor-pointer"
              style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
            >
              <Printer size={16} className="text-amber-400" />
              <span style={{ color: "#ffffff", fontWeight: "bold" }}>
                {viewMode === "ALL" ? `Print All Selected (${activeBookingsToRender.length})` : "Print Current Document"}
              </span>
            </button>
          </div>
        </div>

        {/* FILTERS & SEARCH ROW */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 text-xs">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">Filter Status:</span>
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-100">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${statusFilter === "ALL" ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-600 hover:text-black"}`}
              >
                All Bookings ({rawBookings.length})
              </button>
              <button
                onClick={() => setStatusFilter("CHECKED_IN")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${statusFilter === "CHECKED_IN" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:text-black"}`}
                style={statusFilter === "CHECKED_IN" ? { color: "#ffffff", backgroundColor: "#059669" } : {}}
              >
                In-House
              </button>
              <button
                onClick={() => setStatusFilter("CHECKED_OUT")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${statusFilter === "CHECKED_OUT" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-black"}`}
                style={statusFilter === "CHECKED_OUT" ? { color: "#ffffff", backgroundColor: "#2563eb" } : {}}
              >
                Checked Out
              </button>
              <button
                onClick={() => setStatusFilter("CONFIRMED")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${statusFilter === "CONFIRMED" ? "bg-amber-600 text-white shadow-sm" : "text-gray-600 hover:text-black"}`}
                style={statusFilter === "CONFIRMED" ? { color: "#ffffff", backgroundColor: "#d97706" } : {}}
              >
                Confirmed
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="flex items-center border border-gray-300 rounded-lg px-2.5 py-1 bg-gray-50 gap-2 w-64">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search guest, room, bill #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-black text-xs font-bold">
                &times;
              </button>
            )}
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
                className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === "PAGED" ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-600 hover:text-black"}`}
              >
                One by One (Paged)
              </button>
              <button
                onClick={() => setViewMode("ALL")}
                className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === "ALL" ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-600 hover:text-black"}`}
              >
                Bulk All ({bookings.length})
              </button>
            </div>
          </div>

          {/* Paged Navigation (When in One by One Mode) */}
          {viewMode === "PAGED" && bookings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-300">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                className="p-1 rounded bg-white hover:bg-gray-200 border border-gray-300 text-gray-800 disabled:opacity-30 disabled:hover:bg-white shadow-xs cursor-pointer"
                title="Previous Stay"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="font-mono font-bold text-gray-800 px-1">
                {currentIndex + 1} of {bookings.length}
              </span>
              <button
                disabled={currentIndex >= bookings.length - 1}
                onClick={() => setCurrentIndex(i => Math.min(bookings.length - 1, i + 1))}
                className="p-1 rounded bg-white hover:bg-gray-200 border border-gray-300 text-gray-800 disabled:opacity-30 disabled:hover:bg-white shadow-xs cursor-pointer"
                title="Next Stay"
              >
                <ArrowRight size={16} />
              </button>
              
              <span className="text-gray-400">|</span>
              <select
                value={currentIndex}
                onChange={(e) => setCurrentIndex(Number(e.target.value))}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-800 focus:outline-none max-w-xs"
              >
                {bookings.map((b: any, idx: number) => (
                  <option key={b._id} value={idx}>
                    #{idx + 1}: Room {b.assignedRoom?.roomNumber || "—"} &bull; {b.guestDetails?.firstName} {b.guestDetails?.lastName} ({b.status})
                  </option>
                ))}
              </select>
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
          {activeBookingsToRender.map((booking: any) => (
            <BookingDocCard key={booking._id} booking={booking} docType={docType} />
          ))}
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
