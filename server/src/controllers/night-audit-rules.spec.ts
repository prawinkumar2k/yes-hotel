import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { runNightAudit, getNightAuditStatus } from "./night-audit.controller";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";
import { RoomNight } from "../models/RoomNight";
import { postCharge } from "../services/folio.service";
import { businessDayRange } from "../../../shared/dates";

const AUDIT = "2030-01-10";
const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const rooms = { a: oid(), b: oid(), c: oid() };
const ids: Record<string, mongoose.Types.ObjectId> = {};
let preExisting: any = null;
const created: mongoose.Types.ObjectId[] = [];

function call(handler: any, body: any = {}) {
  const req: any = { body, user: { id: String(oid()), role: "ADMIN" } };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => res);
}

async function stay(key: string, room: mongoose.Types.ObjectId, checkIn: string, checkOut: string, status: string, ratePerNight: number, chargedNights?: "legacy") {
  const b = await Booking.create({
    propertyId: P,
    bookingReference: `NAR-${key}-${oid()}`,
    source: "WALK_IN" as any,
    guestDetails: { firstName: "Audit", lastName: key, email: `nar-${key}@test.local`, phone: "9999999999" },
    roomCategory: oid(),
    assignedRoom: room,
    checkInDate: businessDayRange(checkIn).start,
    checkOutDate: businessDayRange(checkOut).start,
    adults: 1,
    children: 0,
    ratePerNight,
    totalAmount: ratePerNight * 2,
    taxAmount: 0,
    status: status as any,
    paymentStatus: PaymentStatus.UNPAID,
  });
  ids[key] = b._id as any;
  if (status === BookingStatus.CHECKED_IN) {
    const f = await Folio.create({ propertyId: P, booking: b._id, guest: b._id, room, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, status: FolioStatus.OPEN });
    if (chargedNights === "legacy") {
      await FolioLine.create({ folio: f._id, booking: b._id, lineType: FolioLineType.ROOM_CHARGE, direction: FolioLineDirection.DEBIT, description: "Room Tariff (stay)", amount: ratePerNight * 3, date: b.checkInDate, postedBy: "test" });
    }
  }
  return b;
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  await BusinessDate.syncIndexes();
  await RoomNight.syncIndexes();
  preExisting = await BusinessDate.findOne({ isCurrentDate: true });
  if (preExisting) await BusinessDate.updateOne({ _id: preExisting._id }, { isCurrentDate: false });
  const d = await BusinessDate.create({ propertyId: P, date: businessDayRange(AUDIT).start, state: BusinessDateState.OPEN, isCurrentDate: true, openedAt: new Date() });
  created.push(d._id as any);

  await stay("charged", rooms.a, "2030-01-09", "2030-01-12", BookingStatus.CHECKED_IN, 3000, "legacy"); // night 10 already charged at check-in
  await stay("overstay", rooms.b, "2030-01-08", "2030-01-10", BookingStatus.CHECKED_IN, 4000, "legacy"); // due out 10th, still in house
  await stay("noshow", rooms.c, "2030-01-10", "2030-01-11", BookingStatus.CONFIRMED, 2500);
  await RoomNight.create({ room: rooms.c, date: AUDIT, booking: ids.noshow, status: "HELD" });
});

afterAll(async () => {
  const bookingIds = Object.values(ids);
  await FolioLine.deleteMany({ booking: { $in: bookingIds } });
  await Folio.deleteMany({ booking: { $in: bookingIds } });
  await RoomNight.deleteMany({ booking: { $in: bookingIds } });
  await Booking.deleteMany({ _id: { $in: bookingIds } });
  const after = await BusinessDate.find({ $or: [{ _id: { $in: created } }, { propertyId: P }] }).select("_id").lean();
  await BusinessDate.deleteMany({ _id: { $in: after.map((x) => x._id) } });
  if (preExisting) await BusinessDate.updateOne({ _id: preExisting._id }, { isCurrentDate: true });
  await mongoose.connection.close();
});

describe("night audit", () => {
  it("status is read-only and reports the current business date", async () => {
    const before = await BusinessDate.countDocuments();
    const res = await call(getNightAuditStatus);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.businessDateYmd).toBe(AUDIT);
    expect(await BusinessDate.countDocuments()).toBe(before);
  });

  it("charges only uncovered nights: no double charge for a stay charged at check-in; overstay charged once at the booking rate", async () => {
    const res = await call(runNightAudit, { force: true });
    expect(res.statusCode).toBe(200);

    const charged = await FolioLine.find({ booking: ids.charged, lineType: FolioLineType.ROOM_CHARGE }).lean();
    expect(charged).toHaveLength(1); // only the check-in stay line

    const over = await FolioLine.find({ booking: ids.overstay, lineType: FolioLineType.ROOM_CHARGE, coversNights: AUDIT }).lean();
    expect(over).toHaveLength(1);
    expect(over[0].amount).toBe(4000);
    expect(await RoomNight.countDocuments({ booking: ids.overstay, date: AUDIT })).toBe(1);
  });

  it("marks due arrivals NO_SHOW and frees their room-nights", async () => {
    expect((await Booking.findById(ids.noshow))?.status).toBe(BookingStatus.NO_SHOW);
    expect(await RoomNight.countDocuments({ booking: ids.noshow })).toBe(0);
  });

  it("rolls the business date, closes and locks the audited day, and records a summary", async () => {
    const closed = await BusinessDate.findOne({ propertyId: P, date: businessDayRange(AUDIT).start });
    expect(closed?.state).toBe(BusinessDateState.CLOSED);
    expect(closed?.auditSummary?.inHouseCount).toBeGreaterThanOrEqual(2);
    const current = await BusinessDate.findOne({ isCurrentDate: true });
    expect(current?.date.toISOString()).toBe(businessDayRange("2030-01-11").start.toISOString());

    const folio = await Folio.findOne({ booking: ids.charged });
    await expect(
      postCharge(
        { folioId: String(folio!._id), bookingId: String(ids.charged), lineType: FolioLineType.MINIBAR, description: "Backdated", amount: 100, date: new Date(), postedBy: "test", businessDate: businessDayRange(AUDIT).start },
        {},
      ),
    ).rejects.toThrow(/closed by the night audit/);
  });
});
