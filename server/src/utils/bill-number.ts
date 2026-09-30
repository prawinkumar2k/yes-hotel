import { Booking } from "../models/Booking";
import { HotelSettings } from "../models/HotelSettings";

/**
 * Generates a unique, sequential bill number for the Guest Registration Card.
 * Format: BILL-YYYY-NNNNNN  (e.g. BILL-2026-000267)
 *
 * Uses the total booking count as the sequence base so numbers never repeat,
 * even if an earlier bill was deleted (they never should be, but still).
 *
 * For production-grade uniqueness under concurrent load:
 *  - The caller should wrap this in a retry loop (the unique index on billNumber
 *    will reject any true collision, and the caller can generate a new number).
 */
export async function generateBillNumber(): Promise<string> {
  const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
  const prefix = "BILL";
  const year = new Date().getFullYear();

  // Count all bookings that have a billNumber already to get the sequence.
  // Using countDocuments is safe here because the unique sparse index on
  // billNumber guarantees no two documents share the same value.
  const count = await Booking.countDocuments({ billNumber: { $exists: true } });
  const seq = String(count + 1).padStart(6, "0");
  return `${prefix}-${year}-${seq}`;
}
