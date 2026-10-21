import { ClientSession } from "mongoose";
import { Booking } from "../models/Booking";
import { todayBusinessDate } from "../../../shared/dates";

/**
 * One booking number format for every booking, whatever its source (walk-in, phone, website, OTA, advance
 * reservation, group): YH-MMDD-NNN, e.g. YH-1021-004. The source is a field on the booking, not part of the number.
 * `_source` is accepted for older callers and ignored. Numbers already issued with an old prefix are not changed.
 */
export const BOOKING_NUMBER_PREFIX = "YH";

export async function generateBookingReference(_source?: string, session?: ClientSession): Promise<string> {
  // MMDD of the business date at the property (Asia/Kolkata).
  const [, month, date] = todayBusinessDate().split("-");
  const prefix = `${BOOKING_NUMBER_PREFIX}-${month}${date}`;

  // Query within the session if provided
  const query = Booking.countDocuments({ bookingReference: { $regex: `^${prefix}-` } });
  if (session) query.session(session);
  let count = await query;
  let seq = count + 1;

  let ref = `${prefix}-${String(seq).padStart(3, "0")}`;
  
  const checkExists = async (r: string) => {
    const q = Booking.exists({ bookingReference: r });
    if (session) q.session(session);
    return await q;
  };

  while (await checkExists(ref)) {
    seq++;
    ref = `${prefix}-${String(seq).padStart(3, "0")}`;
  }
  return ref;
}
