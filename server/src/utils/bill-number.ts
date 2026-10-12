import { ClientSession } from "mongoose";
import { Booking } from "../models/Booking";
import { HotelSettings } from "../models/HotelSettings";

/**
 * Generates a unique, sequential bill number for the Guest Registration Card.
 * Format: BILL-YYYY-NNNNNN  (e.g. BILL-2026-000002)
 */
export async function generateBillNumber(session?: ClientSession): Promise<string> {
  const prefix = "BILL";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)`);

  // Query highest existing billNumber for current year to avoid collisions
  const latestQuery = Booking.findOne({ billNumber: pattern }).sort({ billNumber: -1 });
  if (session) latestQuery.session(session);
  const latest = await latestQuery.exec();

  let seqNumber = 1;
  if (latest && latest.billNumber) {
    const match = latest.billNumber.match(pattern);
    if (match && match[1]) {
      seqNumber = Math.max(seqNumber, parseInt(match[1], 10) + 1);
    }
  }

  // Fallback check on count just in case
  const countQuery = Booking.countDocuments({ billNumber: { $exists: true } });
  if (session) countQuery.session(session);
  const count = await countQuery.exec();
  if (count >= seqNumber) {
    seqNumber = count + 1;
  }

  let candidate = `${prefix}-${year}-${String(seqNumber).padStart(6, "0")}`;

  const checkExists = async (bNum: string) => {
    const q = Booking.findOne({ billNumber: bNum }).select("_id");
    if (session) q.session(session);
    return await q.exec();
  };

  while (await checkExists(candidate)) {
    seqNumber++;
    candidate = `${prefix}-${year}-${String(seqNumber).padStart(6, "0")}`;
  }

  return candidate;
}
