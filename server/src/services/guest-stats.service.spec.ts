import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Guest } from "../models/Guest";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { guestStats, isPlaceholderEmail } from "./guest-stats.service";
import { getGuests } from "../controllers/guest.controller";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const tag = String(oid()).slice(-6);
const phone = `98${tag.replace(/\D/g, "1").padEnd(8, "7").slice(0, 8)}`;
const ids = { guests: [] as any[], bookings: [] as any[] };

async function booking(status: BookingStatus, total: number, folio?: { status: FolioStatus; charges: number; tax: number; discount?: number }) {
  const b = await Booking.create({
    propertyId: P, bookingReference: `GS-${oid()}`, source: "WALK_IN",
    guestDetails: { firstName: "Gs", lastName: tag, email: `walkin+${phone}@yes-hotels.local`, phone },
    roomCategory: oid(), checkInDate: new Date("2026-01-01"), checkOutDate: new Date("2026-01-03"),
    adults: 1, totalAmount: total, taxAmount: 0, status,
  } as any);
  ids.bookings.push(b._id);
  if (folio) {
    await Folio.create({ propertyId: P, booking: b._id, guest: b._id, room: oid(), checkInDate: new Date(), checkOutDate: new Date(), status: folio.status, totalCharges: folio.charges, totalTax: folio.tax, totalDiscounts: folio.discount ?? 0 } as any);
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const real = await Guest.create({ fullName: `Real ${tag}`, email: `real-${tag}@example.com`, phone } as any);
  const dupe = await Guest.create({ fullName: `Walkin ${tag}`, email: `walkin+${phone}@yes-hotels.local`, phone: `+91 ${phone}` } as any);
  ids.guests.push(real._id, dupe._id);
  await booking(BookingStatus.CHECKED_OUT, 99999, { status: FolioStatus.SETTLED, charges: 4000, tax: 200, discount: 100 });
  await booking(BookingStatus.CANCELLED, 50000);
  await booking(BookingStatus.CONFIRMED, 7000, { status: FolioStatus.OPEN, charges: 7000, tax: 350 });
});

afterAll(async () => {
  await Folio.deleteMany({ booking: { $in: ids.bookings } });
  await Booking.deleteMany({ _id: { $in: ids.bookings } });
  await Guest.deleteMany({ _id: { $in: ids.guests } });
  await mongoose.connection.close();
});

describe("guest directory", () => {
  it("spend is the settled folios only; placeholder emails never identify a guest", async () => {
    expect(isPlaceholderEmail(`walkin+${phone}@yes-hotels.local`)).toBe(true);
    expect(isPlaceholderEmail("someone@example.com")).toBe(false);
    const real = await Guest.findById(ids.guests[0]).lean();
    const s = await guestStats(real as any);
    expect(s.totalSpend).toBe(4100); // 4000 + 200 − 100; cancelled and open stays add nothing
    expect(s.totalStays).toBe(1);
    expect(s.totalBookings).toBe(2); // cancelled excluded
  });

  it("listing is read-only and hides the placeholder duplicate", async () => {
    const before = await Guest.countDocuments();
    const req: any = { query: { search: tag, limit: "50" } };
    const res: any = { statusCode: 200 };
    res.status = vi.fn((c: number) => ((res.statusCode = c), res));
    res.json = vi.fn((d: any) => ((res.body = d), res));
    await getGuests(req, res);
    expect(res.statusCode).toBe(200);
    const names = res.body.data.guests.map((g: any) => g.fullName);
    expect(names).toContain(`Real ${tag}`);
    expect(names).not.toContain(`Walkin ${tag}`);
    expect(await Guest.countDocuments()).toBe(before);
    expect((await Guest.findById(ids.guests[0]).lean())!.totalSpend ?? 0).toBe(0); // not written back
  });
});
