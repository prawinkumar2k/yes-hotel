import { ClientSession } from "mongoose";
import { Booking } from "../models/Booking";
import { todayBusinessDate } from "../../../shared/dates";

export async function generateBookingReference(source: string, session?: ClientSession): Promise<string> {
  // MMDD of the business date at the property (Asia/Kolkata).
  const [, month, date] = todayBusinessDate().split("-");
  
  // Format source (e.g. WALK_IN -> WALKIN)
  const formattedSource = source.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = `${formattedSource}-${month}${date}`;

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
