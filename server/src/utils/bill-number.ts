import { ClientSession } from "mongoose";
import { Booking } from "../models/Booking";
import { todayBusinessDate } from "../../../shared/dates";
import { ensureSequenceAtLeast, nextSequence } from "../services/counter.service";

/**
 * Bill number for a stay: BILL-YYYY-NNNNNN (e.g. BILL-2026-000002), sequential per calendar year.
 * Issued only when the bill is settled at checkout (see settleFolio) — never at booking or check-in.
 * Uses the shared counter (atomic; rolls back with the checkout transaction). The counter is first
 * raised past any bill numbers issued by the older "highest + 1" scheme, so numbers never repeat.
 */
export async function generateBillNumber(session?: ClientSession): Promise<string> {
  const prefix = "BILL";
  const year = todayBusinessDate().slice(0, 4);
  const key = `bill:${year}`;
  const latestQuery = Booking.findOne({ billNumber: new RegExp(`^${prefix}-${year}-\\d+$`) }).sort({ billNumber: -1 }).select("billNumber");
  if (session) latestQuery.session(session);
  const latest = await latestQuery.lean();
  const highest = Number(latest?.billNumber?.split("-")[2] ?? 0);
  if (highest > 0) await ensureSequenceAtLeast(key, highest, session);
  return `${prefix}-${year}-${String(await nextSequence(key, session)).padStart(6, "0")}`;
}

/** Gives the booking its bill number if it doesn't have one yet (idempotent). */
export async function assignBillNumberAtCheckout(bookingId: unknown, session?: ClientSession): Promise<string | undefined> {
  const q = Booking.findById(bookingId).select("billNumber");
  if (session) q.session(session);
  const b = await q.lean();
  if (!b) return undefined;
  if (b.billNumber) return b.billNumber;
  const billNumber = await generateBillNumber(session);
  await Booking.updateOne({ _id: bookingId, billNumber: { $exists: false } }, { $set: { billNumber } }, { session });
  return billNumber;
}
