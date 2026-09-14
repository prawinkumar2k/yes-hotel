import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { runNightAudit } from "./night-audit.controller";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels_test";

function mockReqRes(body: any = {}) {
  const req: any = { body, user: { id: new mongoose.Types.ObjectId().toString(), role: "ADMIN" } };
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((data: any) => { res.body = data; return res; });
  return { req, res };
}

describe("runNightAudit concurrency safety (regression for a live-reproduced double-posting bug)", () => {
  let category: any;
  let room: any;
  let booking: any;
  let folio: any;
  let businessDateIds: mongoose.Types.ObjectId[] = [];
  let preExistingCurrentDateId: mongoose.Types.ObjectId | null = null;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await Promise.all([
      Booking.deleteMany({ bookingReference: /^NAC-/ }),
      Room.deleteMany({ roomNumber: /^NAC-/ }),
      RoomCategory.deleteMany({ name: /^NAC Test Category/ }),
      booking?._id ? Folio.deleteMany({ booking: booking._id }) : Promise.resolve(),
      booking?._id ? FolioLine.deleteMany({ booking: booking._id }) : Promise.resolve(),
      businessDateIds.length ? BusinessDate.deleteMany({ _id: { $in: businessDateIds } }) : Promise.resolve(),
    ]);
    // Restore whatever BusinessDate was the real current-date record before
    // this test touched the collection, since it shares the test database
    // with everything else — never leave "no current business date" behind.
    if (preExistingCurrentDateId) {
      await BusinessDate.updateOne({ _id: preExistingCurrentDateId }, { isCurrentDate: true });
    }
    businessDateIds = [];
    preExistingCurrentDateId = null;
  });

  it("never double-posts room charge + GST when two requests race on the same business date", async () => {
    const stamp = new mongoose.Types.ObjectId().toString().slice(-8);

    category = await RoomCategory.create({
      name: `NAC Test Category ${stamp}`,
      slug: `nac-test-${stamp}`,
      description: "test",
      basePrice: 5000,
      capacity: { adults: 2, children: 0 },
      amenities: [],
      images: [],
    });

    room = await Room.create({
      roomNumber: `NAC-${stamp}`,
      floor: "1",
      category: category._id,
      status: RoomStatus.OCCUPIED,
      occupancyStatus: OccupancyStatus.OCCUPIED,
      housekeepingStatus: HousekeepingRoomStatus.CLEAN,
      sellStatus: SellStatus.SELLABLE,
    });

    booking = await Booking.create({
      bookingReference: `NAC-${stamp}`,
      guestDetails: { firstName: "Concurrency", lastName: "Test", email: `nac-${stamp}@test.local`, phone: "9999999999" },
      roomCategory: category._id,
      assignedRoom: room._id,
      checkInDate: new Date(),
      checkOutDate: new Date(Date.now() + 86400000),
      adults: 1,
      children: 0,
      totalAmount: 5000,
      taxAmount: 0,
      status: BookingStatus.CHECKED_IN,
      paymentStatus: PaymentStatus.UNPAID,
    });

    folio = await Folio.create({
      booking: booking._id,
      guest: booking._id, // placeholder ObjectId — this test only checks FolioLine counts, not guest population
      room: room._id,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      status: FolioStatus.OPEN,
    });

    // Neutralize (not delete) any real current-date record so this test's
    // own seeded date can claim isCurrentDate:true under the unique index —
    // restored in afterEach.
    const existing = await BusinessDate.findOne({ isCurrentDate: true });
    if (existing) {
      preExistingCurrentDateId = existing._id as mongoose.Types.ObjectId;
      await BusinessDate.updateOne({ _id: existing._id }, { isCurrentDate: false });
    }

    const seededDate = await BusinessDate.create({
      date: new Date(),
      state: BusinessDateState.OPEN,
      isCurrentDate: true,
      openedAt: new Date(),
    });
    businessDateIds.push(seededDate._id as mongoose.Types.ObjectId);

    const testStart = new Date();

    // Fire two genuinely concurrent audit runs, exactly reproducing the
    // race that previously posted the room charge + CGST + SGST twice.
    const call1 = mockReqRes({ force: true });
    const call2 = mockReqRes({ force: true });
    await Promise.all([
      runNightAudit(call1.req, call1.res),
      runNightAudit(call2.req, call2.res),
    ]);

    const statuses = [call1.res.statusCode, call2.res.statusCode].sort();
    // Exactly one call succeeds; the other is cleanly rejected (409) rather
    // than partially completing and then failing on an unrelated unique-index error.
    expect(statuses).toEqual([200, 409]);

    const lines = await FolioLine.find({ folio: folio._id, businessDate: { $exists: true } }).lean();
    const roomCharges = lines.filter((l) => l.lineType === FolioLineType.ROOM_CHARGE);
    const cgstLines = lines.filter((l) => l.lineType === FolioLineType.TAX_CGST);
    const sgstLines = lines.filter((l) => l.lineType === FolioLineType.TAX_SGST);

    expect(roomCharges.length).toBe(1);
    expect(cgstLines.length).toBe(1);
    expect(sgstLines.length).toBe(1);

    // Only one new BusinessDate should have been opened by the winning
    // audit run — a second, phantom "tomorrow" would mean the race still
    // let both requests complete the rollover.
    const newBusinessDates = await BusinessDate.find({ openedAt: { $gte: testStart } }).lean();
    businessDateIds.push(...newBusinessDates.map((d) => d._id as mongoose.Types.ObjectId));
    expect(newBusinessDates.length).toBe(1);
  });
});
