/**
 * Finds the guest a deposit (or any desk entry) belongs to, so one person is never split into two
 * guest records:
 *   1. same email (case-insensitive), else
 *   2. same mobile number (last 10 digits, however it was typed: "+91 88070 54164", "8807054164"),
 *   3. otherwise a new guest.
 * A walk-in without an email has an internal placeholder address (…@yeshotels.local): when the
 * same person later gives a real email, the record keeps its history and gets the real email.
 * Existing details are never overwritten; only blanks are filled.
 */
import { Guest } from "../models/Guest";

const PLACEHOLDER = /@yes-?hotels\.local$/i;
export const isPlaceholderGuestEmail = (e?: string | null) => !e || PLACEHOLDER.test(String(e).trim());
export const last10 = (p?: string | null) => String(p ?? "").replace(/\D/g, "").slice(-10);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function resolveGuest(input: { name?: string; phone?: string; email?: string }): Promise<{ guest: any; created: boolean; matchedBy: "email" | "phone" | "new" }> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const phoneDigits = last10(input.phone);
  const name = String(input.name ?? "").trim();
  const realEmail = email && !isPlaceholderGuestEmail(email) ? email : "";

  let guest: any = null;
  let matchedBy: "email" | "phone" | "new" = "new";
  if (realEmail) {
    guest = await Guest.findOne({ email: new RegExp(`^${escape(realEmail)}$`, "i") });
    if (guest) matchedBy = "email";
  }
  if (!guest && phoneDigits.length === 10) {
    // The 10 digits in order, allowing spaces / dashes / +91 around them.
    const rx = new RegExp(`${phoneDigits.split("").join("\\D*")}\\D*$`);
    const candidates: any[] = await Guest.find({ phone: rx }).sort({ updatedAt: -1 }).limit(5);
    // Prefer a record that already has a real email (the most complete one).
    guest = candidates.find((g) => !isPlaceholderGuestEmail(g.email)) ?? candidates[0] ?? null;
    if (guest) matchedBy = "phone";
  }

  if (guest) {
    const patch: Record<string, unknown> = {};
    if (!String(guest.fullName ?? "").trim() && name) patch.fullName = name;
    if (!String(guest.phone ?? "").trim() && input.phone) patch.phone = input.phone;
    // A real email replaces the internal placeholder — unless another guest already owns it.
    if (realEmail && isPlaceholderGuestEmail(guest.email) && !(await Guest.exists({ email: realEmail, _id: { $ne: guest._id } }))) patch.email = realEmail;
    if (Object.keys(patch).length) {
      await Guest.updateOne({ _id: guest._id }, { $set: patch });
      guest = await Guest.findById(guest._id);
    }
    return { guest, created: false, matchedBy };
  }

  if (!name || !(input.phone ?? "").trim()) throw new Error("Enter the guest's name and mobile number");
  const useEmail = realEmail || `walkin-${phoneDigits || Date.now()}@yeshotels.local`;
  guest = await Guest.findOneAndUpdate(
    { email: useEmail },
    { $setOnInsert: { email: useEmail, fullName: name, phone: String(input.phone).trim() } },
    { upsert: true, returnDocument: "after" },
  );
  return { guest, created: true, matchedBy: "new" };
}
