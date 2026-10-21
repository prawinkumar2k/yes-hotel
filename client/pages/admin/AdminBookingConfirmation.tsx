import { usePrintLayout } from "@/lib/usePrintLayout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { api } from "@/lib/api";
import { amountInWords } from "@/lib/amount-in-words";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dmy = (d?: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${day}-${mon}-${y.slice(2)}`;
};
const MEAL: Record<string, string> = { EP: "Room only", CP: "Breakfast", MAP: "Breakfast + one meal", AP: "All meals" };

/** Booking Confirmation for an advance reservation — same ruled-sheet layout as the advance receipt, invoice and GRC. */
export default function AdminBookingConfirmation() {
  usePrintLayout("portrait", 8);
  const { id } = useParams();
  const embedded = typeof window !== "undefined" && window.self !== window.top;
  const { data: d, isLoading, error } = useQuery({
    queryKey: ["booking-confirmation", id],
    queryFn: async () => (await api.get(`/advances/bookings/${id}/confirmation`)).data.data,
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-hotel-gold" size={32} /></div>;
  if (error || !d) return <div className="p-8 text-center text-red-600 font-bold">Booking confirmation not found.</div>;

  const { booking: b, customer: c, item: it, amounts: a, advance: adv } = d;
  const half = a.gstRate / 2;
  const meal = String(it.description).split(" - ")[1] ?? "EP";
  const cell = "border-r border-black p-1.5 last:border-r-0";

  return (
    <div className="max-w-3xl mx-auto bg-white print:max-w-none">
      {!embedded && (
        <div className="print:hidden flex justify-between items-center mb-4 bg-gray-100 p-3 rounded-lg border border-gray-300">
          <Link to="/admin/advances" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black"><ArrowLeft size={14} /> Back to Advances</Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-black text-[#e5c76b] rounded-lg text-xs font-bold flex items-center gap-1.5"><Printer size={14} /> PRINT BOOKING CONFIRMATION</button>
        </div>
      )}

      <div className="border border-black text-[11px] leading-tight font-medium bg-white">
        <div className="flex border-b border-black">
          <div className="w-1/3 p-2 flex items-center justify-center border-r border-black">
            <img src="/brand/yes-hotels-logo-sm.png" alt="YES HOTELS" className="h-16 w-auto object-contain mb-1 print:h-14" />
            <h1 className="font-serif text-3xl font-black italic tracking-widest uppercase">YES HOTELS</h1>
          </div>
          <div className="w-2/3 p-2 text-right"><HotelDocAddress /></div>
        </div>

        <div className="text-center border-b border-black py-1 font-bold text-sm bg-gray-100">BOOKING CONFIRMATION{b.cancelled ? " — CANCELLED" : ""}</div>

        <div className="flex border-b border-black">
          <div className="w-1/2 p-2 border-r border-black grid grid-cols-[95px_1fr] gap-1">
            <div>Booking No.</div><div className="font-bold">: {b.number}{b.rooms > 1 ? ` (+${b.rooms - 1} more)` : ""}</div>
            <div>Booking Date</div><div>: {dmy(b.bookingDate)}</div>
            <div>Status</div><div>: {b.status}</div>
            <div>Rooms</div><div>: {b.rooms} (numbers allotted at check-in)</div>
          </div>
          <div className="w-1/2 p-2 grid grid-cols-[95px_1fr] gap-1">
            <div>Arrival</div><div className="font-bold">: {dmy(b.arrivalDate)}, {b.arrivalTime}</div>
            <div>Departure</div><div className="font-bold">: {dmy(b.departureDate)}, {b.departureTime}</div>
            <div>Nights</div><div>: {b.nights}</div>
            <div>Meal Plan</div><div>: {meal} ({MEAL[meal] ?? meal})</div>
          </div>
        </div>

        <div className="border-b border-black">
          <div className="px-2 py-1 font-bold bg-gray-50 border-b border-black">CUSTOMER DETAILS</div>
          <div className="flex">
            <div className="w-1/2 p-2 border-r border-black grid grid-cols-[95px_1fr] gap-1">
              <div>Name</div><div className="font-bold">: {String(c.name).toUpperCase()}</div>
              <div>Address</div><div>: {c.address || "—"}</div>
            </div>
            <div className="w-1/2 p-2 grid grid-cols-[95px_1fr] gap-1">
              <div>Mobile</div><div>: {String(c.phone).replace(/^[^\d+]+/, "") || "—"}</div>
              {c.email && (<><div>Email</div><div>: {c.email}</div></>)}
              <div>GSTIN</div><div>: {c.gstin || "—"}</div>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border-b border-black">
          <thead className="bg-gray-50">
            <tr className="border-b border-black text-left">
              {["Description", "SAC", "Adults", "Children", "Rooms", "Nights", "Rate / night", "Taxable"].map((h, i) => (
                <th key={h} className={`${cell} font-bold ${i > 5 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cell}>{it.description}</td><td className={cell}>{it.sac}</td><td className={cell}>{it.adults}</td><td className={cell}>{it.children}</td>
              <td className={cell}>{it.rooms}</td><td className={cell}>{b.nights}</td>
              <td className={`${cell} text-right`}>{inr(it.ratePerNight)}{it.pricesIncludeTax ? " (incl. GST)" : ""}</td>
              <td className={`${cell} text-right`}>{inr(a.taxable)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex border-b border-black">
          <div className="w-2/3 p-2 border-r border-black">
            <div className="text-gray-600">Amount in words</div>
            <div className="font-bold mt-0.5">{amountInWords(a.roundedTotal)}</div>
            {adv.receipts.length > 0 && (
              <div className="mt-3 text-gray-700">
                <div className="font-bold">Advance receipts</div>
                {adv.receipts.map((r: any) => <div key={r.number}>{r.number} — {r.method} — {inr(r.amount)}</div>)}
              </div>
            )}
          </div>
          <div className="w-1/3">
            {([
              ["Taxable Value", a.taxable],
              [`CGST (${half}%)`, a.cgst],
              [`SGST (${half}%)`, a.sgst],
              ["Total GST", a.totalGst],
              ["Sub Total", a.total],
              ["Round off", a.roundOff],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex justify-between px-2 py-1 border-b border-black"><span>{k}</span><span>{inr(v)}</span></div>
            ))}
            <div className="flex justify-between px-2 py-1.5 border-b border-black font-bold text-sm"><span>Net Amount</span><span>{inr(a.roundedTotal)}</span></div>
            <div className="flex justify-between px-2 py-1 border-b border-black"><span>Advance Paid</span><span>{inr(adv.paid)}</span></div>
            <div className="flex justify-between px-2 py-1.5 font-bold text-sm"><span>Balance</span><span>{inr(d.balance)}</span></div>
          </div>
        </div>

        <div className="p-2 text-[10px] text-gray-700 border-b border-black">
          Room numbers are allotted at check-in. The advance is adjusted against the final bill; the GST invoice is issued at checkout.
        </div>
        <div className="flex justify-between items-end p-2 pt-10">
          <div className="text-center"><div className="border-t border-black w-40 pt-1">Guest Signature</div></div>
          <div className="text-center"><div className="border-t border-black w-40 pt-1">For {d.hotel.name}</div></div>
        </div>
      </div>
    </div>
  );
}
