import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { RoomNight } from "../models/RoomNight";
import {
  claimRoomNights,
  releaseRoomNights,
  roomsTakenBetween,
  RoomUnavailableError,
  settleRoomNightsOnCheckout,
} from "./room-nights.service";

const oid = () => new mongoose.Types.ObjectId();
const room = oid();
const room2 = oid();
const bookings = Array.from({ length: 6 }, oid);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  await RoomNight.syncIndexes(); // unique (room, date)
});
afterAll(async () => {
  await RoomNight.deleteMany({ room: { $in: [room, room2] } });
  await mongoose.connection.close();
});

describe("room-night inventory", () => {
  it("double-booking race: two concurrent claims for the same room-night, only one succeeds", async () => {
    const attempt = async (b: mongoose.Types.ObjectId) => {
      const s = await mongoose.startSession();
      try {
        await s.withTransaction(() => claimRoomNights({ bookingId: b, roomId: room, checkIn: "2026-11-01", checkOut: "2026-11-03", session: s }));
        return "ok";
      } catch (e) {
        return e instanceof RoomUnavailableError || (e as any)?.code === 11000 || (e as any)?.codeName === "WriteConflict" ? "rejected" : String(e);
      } finally {
        await s.endSession();
      }
    };
    const results = await Promise.all([attempt(bookings[0]), attempt(bookings[1])]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "rejected")).toHaveLength(1);
    expect(await RoomNight.countDocuments({ room, date: { $in: ["2026-11-01", "2026-11-02"] } })).toBe(2);
  });

  it("an overlapping later stay on the same room is rejected; back-to-back stays are fine", async () => {
    await expect(claimRoomNights({ bookingId: bookings[2], roomId: room, checkIn: "2026-11-02", checkOut: "2026-11-04" })).rejects.toBeInstanceOf(RoomUnavailableError);
    await expect(claimRoomNights({ bookingId: bookings[2], roomId: room, checkIn: "2026-11-03", checkOut: "2026-11-05" })).resolves.toEqual(["2026-11-03", "2026-11-04"]);
  });

  it("re-claiming is idempotent, and moving rooms releases the old room's nights", async () => {
    await claimRoomNights({ bookingId: bookings[3], roomId: room, checkIn: "2026-12-01", checkOut: "2026-12-03" });
    await claimRoomNights({ bookingId: bookings[3], roomId: room, checkIn: "2026-12-01", checkOut: "2026-12-03" });
    expect(await RoomNight.countDocuments({ booking: bookings[3] })).toBe(2);
    await claimRoomNights({ bookingId: bookings[3], roomId: room2, checkIn: "2026-12-01", checkOut: "2026-12-03" });
    expect(await RoomNight.countDocuments({ booking: bookings[3], room })).toBe(0);
    expect(await RoomNight.countDocuments({ booking: bookings[3], room: room2 })).toBe(2);
    expect((await roomsTakenBetween("2026-12-02", "2026-12-03")).has(String(room2))).toBe(true);
  });

  it("cancellation releases nights; early checkout consumes stayed nights and frees the rest", async () => {
    await claimRoomNights({ bookingId: bookings[4], roomId: room, checkIn: "2027-01-10", checkOut: "2027-01-12" });
    expect(await releaseRoomNights(bookings[4])).toBe(2);

    await claimRoomNights({ bookingId: bookings[5], roomId: room, checkIn: "2027-02-01", checkOut: "2027-02-05" });
    await settleRoomNightsOnCheckout(bookings[5], "2027-02-03"); // left after 2 of 4 nights
    const left = await RoomNight.find({ booking: bookings[5] }).sort({ date: 1 }).lean();
    expect(left.map((n) => [n.date, n.status])).toEqual([["2027-02-01", "CONSUMED"], ["2027-02-02", "CONSUMED"]]);
  });
});
