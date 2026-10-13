import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { GroupBooking } from "../models/GroupBooking";
import { Booking } from "../models/Booking";
import { BookingInventoryDay } from "../models/BookingInventoryDay";
import { RoomCategory } from "../models/RoomCategory";
import { Room } from "../models/Room";
import { AdvancePayment } from "../models/AdvancePayment";
import { Guest } from "../models/Guest";
import { createGroupBooking, updateGroupStatus, pickupGroupRoomHandler, releaseGroupRoomsHandler, getRoomingList, recordGroupAdvance } from "./group-booking.controller";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const P = oid();
let categoryId = "";
let groupId = "";
const roomIds: any[] = [];

function call(handler: any, body: any, params: any = {}) {
  const req: any = { body, params, query: {}, propertyId: P, user: { id: String(oid()), role: "ADMIN" }, headers: {}, ip: "127.0.0.1" };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => res);
}
const reserved = async () => (await BookingInventoryDay.find({ roomCategory: categoryId }).lean()).map((d) => d.reservedCount);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const c = await RoomCategory.create({ slug: `grp-${tag}`, name: `Grp ${tag}`, description: "test", basePrice: 5000, isActive: true } as any);
  categoryId = String(c._id);
  for (const n of [1, 2, 3, 4]) roomIds.push((await Room.create({ propertyId: P, roomNumber: `G${tag}${n}`, category: c._id, floor: "9" } as any))._id);
});

afterAll(async () => {
  const g = await GroupBooking.findById(groupId).lean();
  await AdvancePayment.deleteMany({ _id: { $in: (g?.advanceIds ?? []) as any[] } });
  await Guest.deleteMany({ email: `org-${tag}@test.local` });
  await Booking.deleteMany({ groupId });
  await GroupBooking.deleteMany({ _id: groupId });
  await BookingInventoryDay.deleteMany({ roomCategory: categoryId });
  await Room.deleteMany({ _id: { $in: roomIds } });
  await RoomCategory.deleteMany({ _id: categoryId });
  await mongoose.connection.close();
});

describe("group room blocks", () => {
  it("confirm holds the block; status jumps are refused", async () => {
    const created = await call(createGroupBooking, {
      groupName: `Offsite ${tag}`, organiserName: "Org", organiserEmail: `org-${tag}@test.local`, organiserPhone: "9000000002",
      checkIn: "2031-06-10", checkOut: "2031-06-12", totalRooms: 3, totalPax: 6, advancePaid: 99999,
      roomBlocks: [{ roomCategoryId: categoryId, categoryName: "Grp", roomsRequired: 3, ratePerRoom: 5000 }],
    });
    expect(created.statusCode).toBe(200);
    groupId = String(created.body.data._id);
    expect(created.body.data.advancePaid).toBe(0); // typed-in money is ignored

    expect((await call(updateGroupStatus, { status: "CHECKED_OUT" }, { id: groupId })).statusCode).toBe(400);
    const conf = await call(updateGroupStatus, { status: "CONFIRMED" }, { id: groupId });
    expect(conf.statusCode).toBe(200);
    expect(await reserved()).toEqual([3, 3]);
    expect((await GroupBooking.findById(groupId).lean())!.roomBlocks[0].roomsHeld).toBe(3);
  });

  it("pickup turns a held room into a named, taxed booking without claiming inventory twice", async () => {
    const r = await call(pickupGroupRoomHandler, { blockIndex: 0, firstName: "Asha", lastName: "Rao", phone: "9000000003" }, { id: groupId });
    expect(r.statusCode).toBe(201);
    expect(r.body.data.booking).toMatchObject({ ratePerNight: 5000, taxAmount: 500, totalAmount: 10500 }); // 2 nights × 5,000 at 5%
    expect(await reserved()).toEqual([3, 3]);
    const list = await call(getRoomingList, {}, { id: groupId });
    expect(list.body.data.blocks[0]).toMatchObject({ held: 2, pickedUp: 1 });
    expect(list.body.data.bookings).toHaveLength(1);
  });

  it("release returns unpicked rooms to sale; cancelling releases the rest", async () => {
    const rel = await call(releaseGroupRoomsHandler, { blockIndex: 0, count: 1 }, { id: groupId });
    expect(rel.statusCode).toBe(200);
    expect(await reserved()).toEqual([2, 2]);
    expect((await call(updateGroupStatus, { status: "CANCELLED" }, { id: groupId })).statusCode).toBe(200);
    expect(await reserved()).toEqual([1, 1]); // only the picked-up booking still holds a room
  });

  it("group advances are real AdvancePayments", async () => {
    await GroupBooking.updateOne({ _id: groupId }, { status: "CONFIRMED" }); // advances are refused once cancelled; reopen for this check
    const r = await call(recordGroupAdvance, { amount: 2500, method: "UPI", referenceNumber: "UTR123" }, { id: groupId });
    expect(r.statusCode).toBe(200);
    expect(await AdvancePayment.exists({ _id: r.body.data.advance._id, amount: 2500 })).toBeTruthy();
    expect(r.body.data.group.advancePaid).toBe(2500);
  });
});
