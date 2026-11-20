/**
 * A group's advance is shared across its rooms by what each room costs, even for a group booked before shares were saved:
 * 4 rooms, one ₹4,500 advance on the first room -> about ₹1,125 for each room, never the whole amount for the first.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { advanceCapForBooking } from "./advance.service";

const oid = () => new mongoose.Types.ObjectId();
const db = () => mongoose.connection.db!;
const group = oid();
const guest = oid();
const rooms = [oid(), oid(), oid(), oid()];
const totals = [2249.86, 2249.86, 2249.86, 2249.94];
const advanceId = oid();

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  else if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  await db().collection("bookings").insertMany(rooms.map((_id, i) => ({
    _id, groupId: group, bookingReference: `GC-${String(group).slice(-6)}-${i}`, status: "CHECKED_IN", totalAmount: totals[i], guestDetails: { firstName: "Group", lastName: "Cap", phone: "9000000000" },
  })));
  await db().collection("advancepayments").insertOne({
    _id: advanceId, booking: rooms[0], guest, amount: 4500, totalAdjusted: 0, totalRefunded: 0, remainingBalance: 4500, status: "RECEIVED", method: "CASH", advanceNumber: `ADV-GC-${String(group).slice(-6)}`,
  });
});

afterAll(async () => {
  await db().collection("bookings").deleteMany({ groupId: group });
  await db().collection("advancepayments").deleteMany({ _id: advanceId });
  await db().collection("foliolines").deleteMany({ booking: { $in: rooms } });
  await mongoose.connection.close();
});

describe("a group's advance is split across its rooms", () => {
  it("gives every room its own share, and the shares add up to the advance", async () => {
    const caps = await Promise.all(rooms.map((r) => advanceCapForBooking(String(r))));
    expect(caps.every((c) => c.groupSize === 4)).toBe(true);
    const shares = caps.map((c) => c.share);
    expect(Math.round(shares.reduce((t, x) => t + x, 0) * 100) / 100).toBe(4500);
    shares.forEach((s) => expect(s).toBeGreaterThan(1124));
    shares.forEach((s) => expect(s).toBeLessThan(1126));
  });

  it("a room can draw its share only, not the whole advance", async () => {
    const c = await advanceCapForBooking(String(rooms[0]));
    expect(c.cap).toBeCloseTo(c.share, 2);
    expect(c.cap).toBeLessThan(1200);
    expect(c.groupRemaining).toBe(4500);
  });
});
