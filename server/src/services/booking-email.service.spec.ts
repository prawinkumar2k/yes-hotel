/**
 * After a booking, the guest is emailed the booking details and how to sign in (no password).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { composeBookingEmail, sendBookingCreatedEmail } from "./booking-email.service";

const tag = new mongoose.Types.ObjectId().toString().slice(-6);
const categoryId = new mongoose.Types.ObjectId();
const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
const email = `mail-guest-${tag}@example.com`;
const db = () => mongoose.connection.db!;

const booking = (_id: mongoose.Types.ObjectId, ref: string, guestEmail: string, extra: Record<string, unknown> = {}) => ({
  _id,
  bookingReference: ref,
  guestDetails: { firstName: "Asha", lastName: "Rao", email: guestEmail, phone: "+91 98450 12345" },
  roomCategory: categoryId,
  checkInDate: new Date("2026-11-10T00:00:00Z"),
  checkOutDate: new Date("2026-11-12T00:00:00Z"),
  adults: 2,
  children: 0,
  status: "CONFIRMED",
  totalAmount: 6300,
  paidAmount: 1000,
  ...extra,
});

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels");
  await db().collection("roomcategories").insertOne({ _id: categoryId, name: `Deluxe ${tag}`, slug: `deluxe-mail-${tag}` });
  await db().collection("bookings").insertMany([
    booking(ids[0], `MAIL-${tag}-1`, email),
    booking(ids[1], `MAIL-${tag}-2`, email.toUpperCase()),
    booking(ids[2], `MAIL-${tag}-3`, `guest+9845012345@guests.yeshotels.local`),
  ]);
});

afterAll(async () => {
  await db().collection("bookings").deleteMany({ _id: { $in: ids } });
  await db().collection("roomcategories").deleteMany({ _id: categoryId });
  await db().collection("notificationlogs").deleteMany({ bookingId: { $in: ids } });
  await mongoose.disconnect();
});

describe("booking email", () => {
  it("sends one email per guest with every room, the booking details and sign-in steps", async () => {
    await sendBookingCreatedEmail(ids);
    const logs = await db().collection("notificationlogs").find({ bookingId: { $in: ids } }).toArray();
    expect(logs).toHaveLength(1);
    const [log] = logs;
    expect(log.type).toBe("BOOKING_CONFIRMATION");
    expect(log.recipientEmail).toBe(email);
    expect(log.subject).toContain("Booking confirmed");
    expect(log.body).toContain(`MAIL-${tag}-1`);
    expect(log.body).toContain(`MAIL-${tag}-2`);
    expect(log.body).toContain(`Deluxe ${tag}`);
    expect(log.body).toContain("2 nights");
    expect(log.body).toContain("Balance: ₹10,600.00");
    expect(log.body).toContain("/login");
    expect(log.body).toContain("Email code");
    expect(log.body).toContain("ending 2345");
    expect(log.body.toLowerCase()).not.toContain("password:");
  });

  it("says 'received' for an unpaid website booking and escapes guest text in the HTML", () => {
    const out = composeBookingEmail(email, [{ ...booking(ids[0], "REF-1", email), status: "PENDING", guestDetails: { firstName: "<b>x</b>", email, phone: "9845012345" } }], { hotelName: "YES Hotels", phone: "+91 1" });
    expect(out.subject).toContain("Booking received");
    expect(out.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(out.html).not.toContain("<b>x</b>");
  });
});
