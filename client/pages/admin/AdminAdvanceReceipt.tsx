import { useParams, Link } from "react-router-dom";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { amountInWords } from "@/lib/amount-in-words";
import { nights as countNights } from "@shared/dates";

/** Advance receipt, laid out like the GST invoice and GRC (same header, ruled sheet). */
export default function AdminAdvanceReceipt() {
  const { id } = useParams();
  // Shown inside a pop-up: hide this page's own toolbar.
  const embedded = typeof window !== "undefined" && window.self !== window.top;

  const { data, isLoading } = useQuery({
    queryKey: ["advance-receipt", id],
    queryFn: async () => (await api.get(`/advances/${id}/receipt`)).data.data,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-hotel-gold" size={32} />
      </div>
    );
  }
  if (!data?.advance) return <div className="p-8 text-center text-red-600 font-bold">Advance receipt not found.</div>;

  const { advance, booking, groupRooms, reservation } = data as { advance: any; booking: any; groupRooms: { bookingReference: string; roomNumber?: string }[]; reservation?: any };
  const realEmail = advance.guest?.email && !/@yes-?hotels\.local$/i.test(advance.guest.email) ? advance.guest.email : "";
  const phone = String(advance.guest?.phone ?? "").replace(/^[^\d+]+/, "");
  const received = new Date(advance.receivedAt || advance.createdAt);
  const stayNights = booking ? Math.max(1, countNights(booking.checkInDate, booking.checkOutDate)) : 0;
  const isGroup = groupRooms.length > 1;
  const groupRoomNumbers = groupRooms.map((g) => g.roomNumber).filter(Boolean).join(", ");
  const receivedBy = advance.receivedBy ? `${advance.receivedBy.firstName ?? ""} ${advance.receivedBy.lastName ?? ""}`.trim() : "—";
  const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-3xl mx-auto bg-white print:max-w-none">
      {!embedded && (
        <div className="print:hidden flex justify-between items-center mb-4 bg-gray-100 p-3 rounded-lg border border-gray-300">
          <Link to="/admin/advances" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black">
            <ArrowLeft size={14} /> Back to Advances
          </Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-black text-[#e5c76b] rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Printer size={14} /> PRINT ADVANCE RECEIPT
          </button>
        </div>
      )}

      <div className="border border-black text-[11px] leading-tight font-medium bg-white">
        {/* HEADER (same as the GST invoice) */}
        <div className="flex border-b border-black">
          <div className="w-1/3 p-2 flex items-center justify-center border-r border-black">
            <img src="/brand/yes-hotels-logo-sm.png" alt="YES HOTELS" className="h-16 w-auto object-contain mb-1 print:h-14" />
            <h1 className="font-serif text-3xl font-black italic tracking-widest uppercase">YES HOTELS</h1>
          </div>
          <div className="w-2/3 p-2 text-right">
            <HotelDocAddress />
          </div>
        </div>

        <div className="text-center border-b border-black py-1 font-bold text-sm bg-gray-100 relative">
          ADVANCE RECEIPT
          <div className="absolute right-2 top-1 text-[9px] font-normal">GUEST COPY</div>
        </div>

        {/* RECEIPT DETAILS */}
        <div className="flex border-b border-black">
          <div className="w-1/2 p-2 border-r border-black grid grid-cols-[95px_1fr] gap-1">
            <div>Receipt No.</div><div className="font-bold">: {advance.advanceNumber}</div>
            <div>Date</div><div>: {format(received, "dd-MMM-yy, hh:mm a")}</div>
            <div>Payment Mode</div><div>: {advance.method}{advance.referenceNumber ? ` (Ref: ${advance.referenceNumber})` : ""}</div>
            <div>Received By</div><div>: {receivedBy}</div>
          </div>
          <div className="w-1/2 p-2 grid grid-cols-[95px_1fr] gap-1">
            <div>Guest</div><div className="font-bold">: MR/MS {String(advance.guest?.fullName ?? "—").toUpperCase()}</div>
            <div>Mobile</div><div>: {phone || "—"}</div>
            {realEmail && (<><div>Email</div><div>: {realEmail}</div></>)}
            {(reservation?.customer?.address || advance.guest?.address) && (<><div>Address</div><div>: {reservation?.customer?.address || advance.guest?.address}</div></>)}
            {reservation?.customer?.gstin && (<><div>GSTIN</div><div>: {reservation.customer.gstin}</div></>)}
          </div>
        </div>

        {/* RESERVATION THIS ADVANCE IS FOR */}
        <div className="border-b border-black">
          <div className="px-2 py-1 font-bold bg-gray-50 border-b border-black">RESERVATION DETAILS</div>
          {booking ? (
            <div className="flex">
              <div className="w-1/2 p-2 border-r border-black grid grid-cols-[95px_1fr] gap-1">
                <div>Reservation</div><div className="font-bold">: {booking.bookingReference}</div>
                <div>Bill No.</div><div>: {booking.billNumber || "—"}</div>
                <div>Room No.</div><div className="font-bold">: {booking.assignedRoom?.roomNumber || "To be assigned"} {booking.roomCategory?.name ? `(${booking.roomCategory.name})` : ""}</div>
                {isGroup && (<><div>Group Rooms</div><div>: {groupRoomNumbers}</div></>)}
              </div>
              <div className="w-1/2 p-2 grid grid-cols-[95px_1fr] gap-1">
                <div>Arrival</div><div className="font-bold">: {format(new Date(booking.checkInDate), "dd-MMM-yy")}</div>
                <div>Departure</div><div className="font-bold">: {format(new Date(booking.checkOutDate), "dd-MMM-yy")}</div>
                <div>{booking.stayType === "HOURLY" ? "Stay" : "Nights"}</div><div>: {booking.stayType === "HOURLY" ? "Day use" : stayNights}</div>
                {reservation ? (
                  <>
                    <div>Rooms</div><div>: {reservation.item.rooms} × {reservation.item.description}</div>
                    <div>Guests</div><div>: {reservation.item.adults} Adult{reservation.item.adults > 1 ? "s" : ""}{reservation.item.children ? `, ${reservation.item.children} Child` : ""}</div>
                    <div>Check-in / out</div><div>: {reservation.booking.arrivalTime} / {reservation.booking.departureTime}</div>
                  </>
                ) : (
                  <><div>Guests</div><div>: {booking.adults ?? 1} Adult{(booking.adults ?? 1) > 1 ? "s" : ""}{booking.children ? `, ${booking.children} Child` : ""}</div></>
                )}
              </div>
            </div>
          ) : (
            <div className="p-2 text-gray-600">Not yet linked to a reservation (unallocated deposit{advance.purpose ? ` — ${advance.purpose}` : ""}).</div>
          )}
        </div>

        {/* AMOUNT */}
        <div className="flex border-b border-black">
          <div className="w-2/3 p-2 border-r border-black">
            <div className="text-gray-600">Amount in words</div>
            <div className="font-bold mt-0.5">{amountInWords(advance.amount)}</div>
            {advance.notes && <div className="mt-2 text-gray-600">Notes: {advance.notes}</div>}
          </div>
          <div className="w-1/3">
            <div className="flex justify-between p-2 border-b border-black"><span>Advance Received</span><span className="font-bold">{inr(advance.amount)}</span></div>
            <div className="flex justify-between p-2 border-b border-black"><span>Adjusted to Bill</span><span>{inr(advance.totalAdjusted)}</span></div>
            {advance.totalRefunded > 0 && <div className="flex justify-between p-2 border-b border-black"><span>Refunded</span><span>{inr(advance.totalRefunded)}</span></div>}
            <div className="flex justify-between p-2 font-bold text-sm"><span>Balance Held</span><span>{inr(advance.remainingBalance)}</span></div>
            {reservation && (
              <>
                <div className="flex justify-between p-2 border-t border-black"><span>Booking Total</span><span>{inr(reservation.amounts.roundedTotal)}</span></div>
                <div className="flex justify-between p-2 border-t border-black"><span>All Advances Paid</span><span>{inr(reservation.advance.paid)}</span></div>
                <div className="flex justify-between p-2 border-t border-black font-bold"><span>Balance Due</span><span>{inr(reservation.balance)}</span></div>
              </>
            )}
          </div>
        </div>

        <div className="p-2 text-[10px] text-gray-700 border-b border-black">
          This is a receipt for an advance deposit. It is adjusted against the final bill; the GST invoice is issued at checkout.
        </div>
        <div className="flex justify-between items-end p-2 pt-10">
          <div className="text-center"><div className="border-t border-black w-40 pt-1">Guest Signature</div></div>
          <div className="text-center"><div className="border-t border-black w-40 pt-1">Cashier / Front Office</div></div>
        </div>
      </div>
    </div>
  );
}
