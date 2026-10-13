import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { roomMetrics, nightlyRoomRevenue } from "./metrics.service";
import { businessDayRange } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const ids: unknown[] = [];

async function stay(checkIn: string, checkOut: string, total: number, tax: number, status: BookingStatus, checkedOutAt?: string) {
  const b = await Booking.create({
    propertyId: P,
    bookingReference: `MET-${oid()}`,
    source: "WALK_IN",
    guestDetails: { firstName: "M", lastName: "T", email: "m@t.local", phone: "9999999999" },
    roomCategory: oid(),
    checkInDate: businessDayRange(checkIn).start,
    checkOutDate: businessDayRange(checkOut).start,
    adults: 1,
    totalAmount: total,
    taxAmount: tax,
    status,
    ...(checkedOutAt ? { checkedOutAt: new Date(businessDayRange(checkedOutAt).start.getTime() + 5 * 3600_000) } : {}),
  } as any);
  ids.push(b._id);
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  await stay("2032-05-01", "2032-05-03", 8400, 400, BookingStatus.CHECKED_OUT); // 2 nights × ₹4,000 pre-tax
  await stay("2032-05-02", "2032-05-05", 31860, 4860, BookingStatus.CHECKED_OUT, "2032-05-03"); // ₹9,000/night, left after 1 night
  await stay("2032-05-02", "2032-05-03", 5000, 0, BookingStatus.CANCELLED); // never counted
});

afterAll(async () => {
  await Booking.deleteMany({ _id: { $in: ids as any[] } });
  await mongoose.connection.close();
});

describe("metrics service", () => {
  it("room revenue per night is pre-tax", () => {
    expect(nightlyRoomRevenue({ totalAmount: 8400, taxAmount: 400, checkInDate: businessDayRange("2032-05-01").start, checkOutDate: businessDayRange("2032-05-03").start })).toBe(4000);
  });

  it("ADR = room revenue / rooms sold, RevPAR = room revenue / available rooms, per night; early checkout ends the stay", async () => {
    const m = await roomMetrics("2032-05-01", "2032-05-04", { propertyId: P });
    const day = (d: string) => m.days.find((x) => x.date === d)!;
    expect(m.days).toHaveLength(4);
    expect(day("2032-05-01")).toMatchObject({ roomsSold: 1, roomRevenue: 4000, adr: 4000 });
    expect(day("2032-05-02")).toMatchObject({ roomsSold: 2, roomRevenue: 13000, adr: 6500 });
    expect(day("2032-05-03")).toMatchObject({ roomsSold: 0, roomRevenue: 0 }); // the 9,000 guest left on the 3rd
    expect(m.roomNights).toBe(3);
    expect(m.roomRevenue).toBe(17000);
    expect(m.adr).toBeCloseTo(17000 / 3, 2);
    // No rooms belong to this test property, so RevPAR/occupancy are 0 rather than divided by zero.
    expect(m.revpar).toBe(0);
  });
});
