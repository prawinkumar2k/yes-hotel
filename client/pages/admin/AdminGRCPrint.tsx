import { useEffect, useState } from "react";
import StayExtensionNote from "@/components/admin/StayExtensionNote";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { nights as countNights } from "@shared/dates";
import { Loader2, Printer, ArrowLeft, ShieldCheck, FileCheck2, Eye, X } from "lucide-react";

export default function AdminGRCPrint() {
  // Shown inside the registration pop-up: hide this page's own toolbar.
  const embedded = typeof window !== "undefined" && window.self !== window.top;
  const { id } = useParams();
  const [openDoc, setOpenDoc] = useState<{ src: string; label: string } | null>(null);

  const { data: bookingData, isLoading: isBookingLoading } = useQuery({
    queryKey: ["adminBooking", id],
    queryFn: async () => {
      const res = await api.get(`/admin/bookings/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: advancesData } = useQuery({
    queryKey: ["advancesForBooking", id],
    queryFn: async () => {
      const res = await api.get(`/advances?bookingId=${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const booking = bookingData?.data;

  const { data: groupBookingsData } = useQuery({
    queryKey: ["groupBookings", booking?.groupId],
    queryFn: async () => {
      const res = await api.get(`/admin/bookings?limit=50`);
      const all = res.data?.data?.bookings || [];
      return all.filter((b: any) => b.groupId === booking?.groupId);
    },
    enabled: !!booking?.groupId,
  });

  useEffect(() => {
    document.body.classList.add("print-page");
    return () => {
      document.body.classList.remove("print-page");
    };
  }, []);

  const advances = advancesData?.data?.advances || [];
  const latestAdvance = advances[0];
  const groupBookings = groupBookingsData || [];
  const allRoomNumbers = groupBookings.length > 0
    ? groupBookings.map((b: any) => b.assignedRoom?.roomNumber).filter(Boolean).join(", ")
    : (booking?.assignedRoom?.roomNumber || "—");

  if (isBookingLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="animate-spin text-[#c9a227]" size={36} />
      </div>
    );
  }

  if (!booking) {
    return <div className="p-8 text-center text-red-600 font-bold">Booking record not found.</div>;
  }

  const nights = Math.max(1, countNights(booking.checkInDate, booking.checkOutDate));
  const checkInDate = new Date(booking.checkInDate);
  const checkOutDate = new Date(booking.checkOutDate);

  const guest = booking.guestDetails || {};
  const foreign = booking.foreignGuestDetails;
  const idType = (guest.idType || "").toUpperCase();

  const isAadhaar = idType.includes("AAD");
  const isDL = idType.includes("DRIV") || idType.includes("DL");
  const isVoter = idType.includes("VOTER") || idType.includes("ECI") || idType.includes("E.C.I");
  const isGovt = !isAadhaar && !isDL && !isVoter;

  // The bill number exists only after checkout; until then the card shows none.
  const billNo = booking.billNumber || "Issued at checkout";
  const ratePerNight = booking.ratePerNight ?? (booking.totalAmount / nights);
  const advanceAmount = latestAdvance?.amount ?? (booking.advanceAmount ?? 0);
  const advanceMethod = latestAdvance?.method ?? booking.paymentMethod ?? "CASH";

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans print:p-0 print:m-0 mx-auto max-w-[850px]">
      {/* Top Toolbar (Hidden on Print) */}
      <div className={`print:hidden flex justify-between items-center mb-4 bg-gray-100 p-3 rounded-lg border border-gray-300${embedded ? " hidden" : ""}`}>
        <Link
          to={`/admin/bookings/${id}`}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black transition"
        >
          <ArrowLeft size={16} /> Back to Booking
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/bookings/${id}/folio-print`}
            className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded text-xs font-bold text-gray-800 transition"
          >
            View GST Invoice
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-black text-[#c9a227] font-bold uppercase text-xs rounded hover:bg-gray-900 transition shadow"
          >
            <Printer size={16} /> Print Registration Card (GRC)
          </button>
        </div>
      </div>

      {/* =========================================================================
          PHYSICAL GUEST REGISTRATION CARD (MATCHING USER'S PHOTO 2)
          ========================================================================= */}
      <div className="border-2 border-black p-3 text-[11px] leading-tight font-sans">
        
        {/* HEADER SECTION */}
        <div className="border-b-2 border-black pb-2 text-center relative">
          <div className="flex items-center justify-between">
            <div className="text-left w-2/3">
              <img src="/brand/yes-hotels-logo-sm.png" alt="YES HOTELS" className="h-16 w-auto object-contain" />
              <h1 className="text-3xl font-black tracking-widest font-serif uppercase text-black">
                YES HOTELS
              </h1>
              <p className="text-[10px] text-gray-800 font-medium mt-0.5 leading-snug">
                No. 51, Khata No. 749, Singasandra, Hosa Road Junction, Parappana Agrahara,<br />
                Electronic City Ph-2, Bengaluru-560100.
              </p>
            </div>
            <div className="text-right w-1/3 border-l border-black pl-3 py-1">
              <div className="text-[11px] font-bold text-gray-800">
                Bill No. <span className="text-red-700 text-lg font-black font-mono ml-1">{billNo}</span>
              </div>
              <div className="text-[9px] font-mono text-gray-600 mt-0.5">
                Ref: {booking.bookingReference}
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
                  <span className="font-black text-sm font-mono">{allRoomNumbers}</span>
                  <span className="font-bold ml-2">Tariff</span>
                  <span className="font-black font-mono">₹{ratePerNight}/-</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                  <span className="font-bold">Extra Bed</span>
                  <span className="font-mono">{booking.extraPersonsWithBed || "—"}</span>
                  <span className="font-bold ml-2">Bill No.</span>
                  <span className="font-mono">{billNo}</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-400 pb-0.5">
                  <span className="font-bold">Advance</span>
                  <span className="font-black font-mono text-green-800">₹{advanceAmount}/-</span>
                  <span className="font-bold ml-2">Receipt No.</span>
                  <span className="font-mono">{latestAdvance?.advanceNumber?.slice(-6) || "—"}</span>
                </div>

                <div className="pt-1">
                  <div className="font-bold text-[9px] uppercase text-gray-700">Billing Instruction / Settlement :</div>
                  <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={advanceMethod === "CASH"} readOnly className="accent-black w-3 h-3" /> Cash
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={advanceMethod === "CARD"} readOnly className="accent-black w-3 h-3" /> Card / DD
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={advanceMethod === "UPI"} readOnly className="accent-black w-3 h-3" /> UPI
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={booking.paymentStatus === "PAID"} readOnly className="accent-black w-3 h-3" /> Net Pay
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-dotted border-gray-400">
                  <div className="font-bold text-[9px] uppercase text-gray-700">Type of Plan :</div>
                  <div className="flex justify-between mt-1 text-[10px]">
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={booking.mealPlan === "EP" || !booking.mealPlan} readOnly className="accent-black w-3 h-3" /> EP
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={booking.mealPlan === "CP"} readOnly className="accent-black w-3 h-3" /> CP
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={booking.mealPlan === "MAP"} readOnly className="accent-black w-3 h-3" /> MAP
                    </span>
                    <span className="flex items-center gap-1">
                      <input type="checkbox" checked={booking.mealPlan === "AP"} readOnly className="accent-black w-3 h-3" /> AP
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex justify-between font-bold text-[10px]">
                  <span>B/ID No.</span>
                  <span className="font-mono">{booking.source || "Walk-In"}</span>
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
                <span>{guest.dateOfBirth ? format(new Date(guest.dateOfBirth), "dd/MM/yyyy") : "—"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-600 block">Vehicle Reg. No.</span>
                <span className="font-mono font-bold uppercase">{guest.vehicleNumber || "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-gray-300 pb-1">
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-600 block">No. of Persons</span>
                <span className="font-bold">Adult: {booking.adults || 1}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-600 block">Child</span>
                <span>{booking.children || 0}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-600 block">Stay Days</span>
                <span className="font-bold">{nights} Day(s)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-gray-300 pb-1">
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-600 block">Date of Arr &amp; Time</span>
                <span className="font-bold">{format(checkInDate, "dd/MM/yyyy")} &bull; {booking.arrivalTime || "12:00 PM"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-600 block">Date of Dep &amp; Time</span>
                <span className="font-bold">{format(checkOutDate, "dd/MM/yyyy")} &bull; {booking.departureTime || "11:00 AM"}</span>
              </div>
            </div>
            <StayExtensionNote booking={booking} className="-mt-1" />

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

            {guest.gstin && (
              <div className="pt-1 border-t border-gray-200">
                <span className="text-[9px] uppercase font-bold text-gray-600">Company GSTIN: </span>
                <span className="font-mono font-bold">{guest.gstin}</span>
              </div>
            )}

          </div>
        </div>

        {/* =========================================================================
            CUSTOMER PHOTO & ID PROOF ATTACHMENTS SECTION
            ========================================================================= */}
        {guest.idProofImages && guest.idProofImages.length > 0 && (
          <div className="border-b border-black p-2 bg-gray-50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5 mb-1.5">
              <FileCheck2 size={13} className="text-black" />
              Verified Customer KYC Documents &amp; Identity Records:
            </div>
            {/* Documents open on demand (a button per document), not as thumbnails on the card. */}
            <div className="flex flex-wrap gap-2 py-1">
              {guest.idProofImages.map((img: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setOpenDoc({ src: img, label: `Document #${idx + 1}` })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-black bg-white rounded text-[11px] font-bold uppercase hover:bg-gray-100 print:border-gray-400"
                >
                  <Eye size={13} /> View Document #{idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            HOTEL RULES AND REGULATIONS & CONSENT FORM
            ========================================================================= */}
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
            <div className="border-t border-black pt-1">
              Receptionist
            </div>
          </div>
          <div className="px-4">
            <div className="border-t border-black pt-1">
              Front Office Manager
            </div>
          </div>
          <div className="px-4">
            <div className="border-t-2 border-black pt-1 font-black text-[11px]">
              Guest Signature
            </div>
          </div>
        </div>

      </div>

      <div className="text-center text-[9px] text-gray-500 mt-2 print:mt-1 font-mono">
        Printed via YES HOTELS PMS &bull; Bengaluru &bull; All Rights Reserved
      </div>

      {openDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={openDoc.label}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print:hidden"
          onClick={() => setOpenDoc(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 text-white text-sm font-bold">
              <span>{openDoc.label}</span>
              <button type="button" aria-label="Close" onClick={() => setOpenDoc(null)} className="p-1.5 rounded bg-white/10 hover:bg-white/20">
                <X size={18} />
              </button>
            </div>
            {openDoc.src.startsWith("data:image") || openDoc.src.startsWith("http") ? (
              <img src={openDoc.src} alt={openDoc.label} className="max-h-[85vh] max-w-full object-contain rounded bg-white" />
            ) : (
              <div className="bg-white rounded p-8 text-sm text-gray-600">This document has no viewable image.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
