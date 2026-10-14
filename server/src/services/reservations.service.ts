/**
 * The one reservation query used by the Calendar and the All Reservations list, so
 * both always show the same bookings for the same window.
 *
 * A booking is in the window [from, to] (business dates, inclusive) when its stay
 * starts before the window ends and either ends after the window starts or is still
 * CHECKED_IN (an overdue stay stays visible until the guest actually checks out).
 */
import { businessDayRange, isBusinessDate, toBusinessDate } from "../../../shared/dates";

export interface ReservationFilter {
  from?: string; // YYYY-MM-DD (or any date string)
  to?: string;
  status?: string; // a BookingStatus, "ALL", or "ACTIVE" (everything except CANCELLED / NO_SHOW)
  source?: string;
  search?: string;
  propertyId?: unknown;
}

export function buildReservationQuery(f: ReservationFilter): Record<string, any> {
  const and: Record<string, any>[] = [];
  if (f.propertyId) and.push({ propertyId: f.propertyId });

  if (f.status === "ACTIVE") and.push({ status: { $nin: ["CANCELLED", "NO_SHOW"] } });
  else if (f.status && f.status !== "ALL") and.push({ status: f.status });

  if (f.source && f.source !== "ALL") and.push({ source: f.source });

  if (f.from || f.to) {
    const fromYmd = f.from ? (isBusinessDate(f.from) ? f.from : toBusinessDate(f.from)) : undefined;
    const toYmd = f.to ? (isBusinessDate(f.to) ? f.to : toBusinessDate(f.to)) : undefined;
    if (toYmd) and.push({ checkInDate: { $lt: businessDayRange(toYmd).end } });
    if (fromYmd) {
      and.push({ $or: [{ checkOutDate: { $gt: businessDayRange(fromYmd).start } }, { status: "CHECKED_IN" }] });
    }
  }

  if (f.search) {
    const escaped = String(f.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    and.push({
      $or: [
        { bookingReference: { $regex: escaped, $options: "i" } },
        { "guestDetails.firstName": { $regex: escaped, $options: "i" } },
        { "guestDetails.lastName": { $regex: escaped, $options: "i" } },
        { "guestDetails.email": { $regex: escaped, $options: "i" } },
        { otaConfirmationNumber: { $regex: escaped, $options: "i" } },
      ],
    });
  }
  return and.length ? { $and: and } : {};
}

/** Default ordering for reservation lists: by stay date, latest first. */
export const RESERVATION_SORT = { checkInDate: -1, _id: -1 } as const;
