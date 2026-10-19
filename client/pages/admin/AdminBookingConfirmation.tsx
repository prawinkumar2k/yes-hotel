import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import HotelDocAddress from "@/components/admin/HotelDocAddress";
import { numberToWords } from "../../lib/numberToWords";
import { getStoredAuthToken } from "../../lib/authStorage";

const inr = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: string) => (d ? d.split("-").reverse().join("-") : "");
const MEAL: Record<string, string> = { EP: "EP", CP: "CP", MAP: "MAP", AP: "AP" };

/** Printable Booking Confirmation for an advance reservation (all rooms of the booking on one page). */
export default function AdminBookingConfirmation() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const t = getStoredAuthToken();
        const r = await fetch(`/api/advances/bookings/${id}/confirmation`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        const j = await r.json();
        if (j.success) setD(j.data);
        else setErr(j.message || "Could not load the booking");
      } catch {
        setErr("Could not load the booking");
      }
    })();
  }, [id]);

  if (err) return <p className="p-6 text-red-600">{err}</p>;
  if (!d) return <p className="p-6 text-gray-500">Loading…</p>;
  const { booking: b, customer: c, item: it, amounts: a, advance: adv } = d;
  const th = "border border-gray-400 px-2 py-1 text-left text-[11px]";
  const td = "border border-gray-400 px-2 py-1 text-[11px]";

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto mb-3 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="px-4 py-2 bg-[#c9a227] text-white rounded-xl text-sm font-bold flex items-center gap-2"><Printer size={16} /> Print</button>
      </div>
      <div className="max-w-3xl mx-auto bg-white text-gray-900 p-8 print:p-4 border border-gray-300 print:border-0 text-xs space-y-4">
        <div className="text-center space-y-0.5"><HotelDocAddress /></div>
        <h1 className="text-center text-base font-bold tracking-wide border-y border-gray-400 py-1">BOOKING CONFIRMATION{b.cancelled ? " — CANCELLED" : ""}</h1>

        <div className="grid grid-cols-3 gap-2">
          <div><b>Booking No</b> : {b.number}{b.rooms > 1 ? ` (+${b.rooms - 1} more)` : ""}</div>
          <div><b>Booking Date</b> : {dmy(b.bookingDate)}</div>
          <div><b>Arrival</b> : {dmy(b.arrivalDate)} {b.arrivalTime}</div>
          <div className="col-span-3"><b>Departure</b> : {dmy(b.departureDate)} {b.departureTime} &nbsp;({b.nights} night{b.nights === 1 ? "" : "s"})</div>
        </div>

        <div className="border border-gray-400 p-2 space-y-0.5">
          <p className="font-bold uppercase">{c.name}</p>
          {c.address && <p>{c.address}</p>}
          <p>Mobile : {c.phone}{c.email ? ` · ${c.email}` : ""}</p>
          {c.gstin && <p>Customer GSTIN : {c.gstin}</p>}
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr><th className={th}>Description</th><th className={th}>SAC</th><th className={th}>Adults</th><th className={th}>Children</th><th className={th}>Rooms</th><th className={th}>Nights</th><th className={th + " text-right"}>Rate</th><th className={th + " text-right"}>Taxable</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>{it.description}</td><td className={td}>{it.sac}</td><td className={td}>{it.adults}</td><td className={td}>{it.children}</td>
              <td className={td}>{it.rooms}</td><td className={td}>{b.nights}</td>
              <td className={td + " text-right"}>{inr(it.ratePerNight)}{it.pricesIncludeTax ? " (incl. GST)" : ""}</td><td className={td + " text-right"}>{inr(a.taxable)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between gap-6">
          <p className="uppercase font-mono text-[10px] flex-1">{numberToWords(a.roundedTotal)}</p>
          <table className="text-[11px] min-w-[16rem]">
            <tbody>
              <tr><td className="pr-4">Taxable Value</td><td className="text-right">{inr(a.taxable)}</td></tr>
              <tr><td>CGST ({a.gstRate / 2}%)</td><td className="text-right">{inr(a.cgst)}</td></tr>
              <tr><td>SGST ({a.gstRate / 2}%)</td><td className="text-right">{inr(a.sgst)}</td></tr>
              <tr><td>Total GST</td><td className="text-right">{inr(a.totalGst)}</td></tr>
              <tr><td>Sub Total</td><td className="text-right">{inr(a.total)}</td></tr>
              <tr><td>Round off</td><td className="text-right">{inr(a.roundOff)}</td></tr>
              <tr className="font-bold border-t border-gray-400"><td>Net Amount</td><td className="text-right">{inr(a.roundedTotal)}</td></tr>
              <tr><td>Advance Paid</td><td className="text-right">{inr(adv.paid)}</td></tr>
              <tr className="font-bold"><td>Balance</td><td className="text-right">{inr(d.balance)}</td></tr>
            </tbody>
          </table>
        </div>

        {adv.receipts.length > 0 && (
          <p className="text-[10px] text-gray-600">Advance receipts: {adv.receipts.map((r: any) => `${r.number} (${r.method}, ₹${inr(r.amount)})`).join(", ")}</p>
        )}
        <p className="text-[10px] text-gray-600">Room numbers are allotted at check-in. The advance is adjusted against the final bill.</p>
        <div className="flex justify-between pt-8 text-[11px]"><span>Guest signature</span><span>For {d.hotel.name}</span></div>
      </div>
    </div>
  );
}
