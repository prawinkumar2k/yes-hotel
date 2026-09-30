import { Booking } from "../models/Booking";

export async function generateBookingReference(source: string): Promise<string> {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  
  // Format source (e.g. WALK_IN -> WALKIN)
  const formattedSource = source.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = `${formattedSource}-${month}${date}`;

  let seq = await Booking.countDocuments({ bookingReference: { $regex: `^${prefix}-` } }) + 1;
  let ref = `${prefix}-${String(seq).padStart(3, "0")}`;
  
  while (await Booking.exists({ bookingReference: ref })) {
    seq++;
    ref = `${prefix}-${String(seq).padStart(3, "0")}`;
  }
  return ref;
}
