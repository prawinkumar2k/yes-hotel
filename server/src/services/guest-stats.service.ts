/**
 * Guest directory figures (read-only; computing them never writes).
 *
 *   A guest's stays   bookings linked by customer id, by a real email, or by phone (digits).
 *                     Placeholder emails generated for walk-ins (…@yes-hotels.local /
 *                     …@yeshotels.local) never identify a guest.
 *   Spend             Σ of SETTLED/CLOSED folios of those stays: charges + tax − discounts
 *                     (the invoiced amount). Cancelled, no-show and future stays add nothing.
 *   Stays / last stay checked-out stays only.
 */
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";

const PLACEHOLDER_EMAIL = /@(yes-?hotels)\.local$/i;
export const isPlaceholderEmail = (email?: string | null) => !email || PLACEHOLDER_EMAIL.test(email.trim());
export const phoneDigits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function bookingMatchForGuest(g: { _id: unknown; email?: string; phone?: string }) {
  const or: Record<string, unknown>[] = [{ customer: g._id }];
  if (!isPlaceholderEmail(g.email)) or.push({ "guestDetails.email": new RegExp(`^${g.email!.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  const digits = phoneDigits(g.phone);
  if (digits.length >= 7) or.push({ "guestDetails.phone": { $regex: `${digits}$` } });
  return { $or: or };
}

export interface GuestStats {
  totalSpend: number;
  totalStays: number;
  totalBookings: number;
  lastStay?: Date;
}

export async function guestStats(g: { _id: unknown; email?: string; phone?: string }): Promise<GuestStats & { bookingIds: unknown[] }> {
  const bookings = await Booking.find(bookingMatchForGuest(g)).select("_id status checkOutDate checkedOutAt").lean();
  const folios = await Folio.find({ booking: { $in: bookings.map((b) => b._id) }, status: { $in: [FolioStatus.SETTLED, FolioStatus.CLOSED] } })
    .select("totalCharges totalTax totalDiscounts")
    .lean();
  const stays = bookings.filter((b: any) => b.status === BookingStatus.CHECKED_OUT);
  const last = stays.map((b: any) => new Date(b.checkedOutAt ?? b.checkOutDate)).sort((a, b) => +b - +a)[0];
  return {
    totalSpend: r2(folios.reduce((t, f: any) => t + (f.totalCharges || 0) + (f.totalTax || 0) - (f.totalDiscounts || 0), 0)),
    totalStays: stays.length,
    totalBookings: bookings.filter((b: any) => b.status !== BookingStatus.CANCELLED).length,
    lastStay: last,
    bookingIds: bookings.map((b) => b._id),
  };
}
