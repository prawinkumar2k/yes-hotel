import { format, parseISO } from "date-fns";
import type { BookingState } from "./types";

type Props = { booking: BookingState; onConfirm: () => void; submitting: boolean };

export default function BookingSummary({ booking, onConfirm, submitting }: Props) {
  const money = (value?: number) => value == null ? "To be confirmed" : `₹${value.toLocaleString("en-IN")}`;
  return <div className="border-t border-hotel-black/10 bg-hotel-white px-4 py-3 text-sm">
    <p className="font-serif text-lg">Review your booking enquiry</p>
    <dl className="mt-3 space-y-1.5 text-xs text-hotel-black/70">
      <div className="flex justify-between gap-3"><dt>Guest</dt><dd className="text-right text-hotel-black">{booking.guestName}</dd></div>
      <div className="flex justify-between gap-3"><dt>Dates</dt><dd className="text-right text-hotel-black">{format(parseISO(booking.checkIn), "d MMM yyyy")} - {format(parseISO(booking.checkOut), "d MMM yyyy")}</dd></div>
      <div className="flex justify-between gap-3"><dt>Stay</dt><dd className="text-hotel-black">{booking.nights} night{booking.nights === 1 ? "" : "s"}</dd></div>
      <div className="flex justify-between gap-3"><dt>Guests / rooms</dt><dd className="text-right text-hotel-black">{booking.adults} adults, {booking.children} children / {booking.rooms} room{booking.rooms === 1 ? "" : "s"}</dd></div>
      <div className="flex justify-between gap-3"><dt>Room</dt><dd className="text-right text-hotel-black">{booking.roomType}</dd></div>
      <div className="flex justify-between gap-3"><dt>Room subtotal</dt><dd className="text-hotel-black">{money(booking.roomSubtotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Taxes and additional charges</dt><dd className="text-right text-hotel-black">To be confirmed</dd></div>
    </dl>
    <p className="mt-3 border-t border-hotel-black/10 pt-3 text-[11px] text-hotel-black/55">This is a booking enquiry, not a confirmed reservation.</p>
    <button type="button" disabled={submitting} onClick={onConfirm} className="mt-3 w-full bg-hotel-gold px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-hotel-black disabled:cursor-wait disabled:opacity-60">{submitting ? "Sending enquiry..." : "Confirm and send enquiry"}</button>
  </div>;
}