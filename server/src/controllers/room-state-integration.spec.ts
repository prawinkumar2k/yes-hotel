import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { checkIn } from "./booking.controller";
import { createMaintenanceTicket, updateMaintenanceTicket } from "./maintenance.controller";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus } from "../models/Room";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels_test";

// A real user.id is always a Mongo ObjectId string in production (from the
// JWT payload) — checkIn casts it via `new mongoose.Types.ObjectId(...)`
// for booking.checkedInBy. The literal "staff1" this fixture used to pass
// isn't a valid ObjectId and threw a BSONError the moment a test actually
// reached that line (the "allows check-in..." case below, which returns
// 200 rather than an earlier 400) — a test-fixture bug, not a product bug,
// since the real app never receives a non-ObjectId user id.
const STAFF_USER_ID = new mongoose.Types.ObjectId().toString();

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

async function createRoom(status: RoomStatus) {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  return Room.create({
    propertyId: new mongoose.Types.ObjectId(),
    roomNumber: `RS-${stamp}`,
    floor: "1",
    category: new mongoose.Types.ObjectId(),
    status,
  });
}

async function createConfirmedBooking() {
  const stamp = new mongoose.Types.ObjectId().toString().slice(-8);
  return Booking.create({
    bookingReference: `RSI-${stamp}`,
    propertyId: new mongoose.Types.ObjectId(),
    property: new mongoose.Types.ObjectId(),
    source: "WALK_IN" as any,
    bookingType: "INDIVIDUAL" as any,
    stayType: "NIGHTLY" as any,
    paymentStatus: PaymentStatus.PAID,
    registrationStatus: "DRAFT" as any,
    signatureStatus: "NOT_COLLECTED" as any,
    cgstAmount: 0,
    sgstAmount: 0,
    paidAmount: 1000,
    discountAmount: 0,
    couponRedeemed: false,
    extraPersonsNoBed: 0,
    extraPersonsWithBed: 0,
    extraChildrenNoBed: 0,
    extraChildrenWithBed: 0,
    kidsUnder3: 0,
    guestDetails: { firstName: "Room", lastName: "State", email: `rsi-${stamp}@test.local`, phone: "9999999999" },
    roomCategory: new mongoose.Types.ObjectId(),
    checkInDate: new Date(Date.now() + 86400000),
    checkOutDate: new Date(Date.now() + 2 * 86400000),
    adults: 1,
    children: 0,
    totalAmount: 1000,
    taxAmount: 0,
    status: BookingStatus.CONFIRMED,
  });
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({ bookingReference: /^RSI-/ }),
    Room.deleteMany({ roomNumber: /^RS-/ }),
    MaintenanceTicket.deleteMany({ issueTitle: /^room-state-test/ }),
  ]);
});

describe("check-in respects room status (previously unchecked entirely)", () => {
  it("rejects check-in into a room under MAINTENANCE", async () => {
    const room = await createRoom(RoomStatus.MAINTENANCE);
    const booking = await createConfirmedBooking();

    const res = mockRes();
    await checkIn(
      { params: { id: booking._id.toString() }, body: { roomId: room._id.toString() }, user: { id: STAFF_USER_ID, role: "ADMIN" } } as any,
      res
    );

    expect(res.statusCode).toBe(400);
    const untouchedRoom = await Room.findById(room._id);
    expect(untouchedRoom?.status).toBe(RoomStatus.MAINTENANCE);
    const untouchedBooking = await Booking.findById(booking._id);
    expect(untouchedBooking?.status).toBe(BookingStatus.CONFIRMED);
  });

  it("rejects check-in into a room already OCCUPIED by someone else", async () => {
    const room = await createRoom(RoomStatus.OCCUPIED);
    const booking = await createConfirmedBooking();

    const res = mockRes();
    await checkIn(
      { params: { id: booking._id.toString() }, body: { roomId: room._id.toString() }, user: { id: STAFF_USER_ID, role: "ADMIN" } } as any,
      res
    );

    expect(res.statusCode).toBe(409); // conflict: the room is held
  });

  it("allows check-in into an AVAILABLE room and marks it OCCUPIED", async () => {
    const room = await createRoom(RoomStatus.AVAILABLE);
    const booking = await createConfirmedBooking();

    const res = mockRes();
    await checkIn(
      { params: { id: booking._id.toString() }, body: { roomId: room._id.toString(), idType: "AADHAAR", idNumber: "123412341234" }, user: { id: STAFF_USER_ID, role: "ADMIN" } } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    const updatedRoom = await Room.findById(room._id);
    expect(updatedRoom?.status).toBe(RoomStatus.OCCUPIED);
    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking?.status).toBe(BookingStatus.CHECKED_IN);
  });
});

describe("maintenance tickets never overwrite a room's occupancy (previously resolution forced AVAILABLE)", () => {
  // Rule (maintenance.service): tickets do not change room.status; a CRITICAL ticket only
  // takes the room off sale (sellStatus OUT_OF_ORDER) until resolved.
  async function workTicket(ticketId: string, status: MaintenanceStatus) {
    const r = mockRes();
    await updateMaintenanceTicket({ params: { id: ticketId }, body: { status }, user: { id: STAFF_USER_ID, role: "ADMIN" } } as any, r);
    return r;
  }

  it("an occupied room stays OCCUPIED through a ticket's whole life", async () => {
    const room = await createRoom(RoomStatus.OCCUPIED);
    const createRes = mockRes();
    await createMaintenanceTicket(
      { body: { roomId: room._id.toString(), issueTitle: "room-state-test AC broken" }, user: { id: STAFF_USER_ID, role: "MAINTENANCE" } } as any,
      createRes
    );
    expect(createRes.statusCode).toBe(201);
    expect((await Room.findById(room._id))?.status).toBe(RoomStatus.OCCUPIED);

    const ticketId = createRes.body.data._id.toString();
    expect((await workTicket(ticketId, MaintenanceStatus.RESOLVED)).statusCode).toBe(400); // must be worked first
    expect((await workTicket(ticketId, MaintenanceStatus.IN_PROGRESS)).statusCode).toBe(200);
    expect((await workTicket(ticketId, MaintenanceStatus.RESOLVED)).statusCode).toBe(200);
    expect((await Room.findById(room._id))?.status).toBe(RoomStatus.OCCUPIED);
  });

  it("a CRITICAL ticket on an available room takes it off sale and resolution puts it back, without touching status", async () => {
    const room = await createRoom(RoomStatus.AVAILABLE);
    const createRes = mockRes();
    await createMaintenanceTicket(
      { body: { roomId: room._id.toString(), issueTitle: "room-state-test sparking socket", priority: "CRITICAL" }, user: { id: STAFF_USER_ID, role: "MAINTENANCE" } } as any,
      createRes
    );
    let after = await Room.findById(room._id);
    expect(after?.status).toBe(RoomStatus.AVAILABLE);
    expect(after?.sellStatus).toBe("OUT_OF_ORDER");

    const ticketId = createRes.body.data._id.toString();
    await workTicket(ticketId, MaintenanceStatus.IN_PROGRESS);
    expect((await workTicket(ticketId, MaintenanceStatus.RESOLVED)).statusCode).toBe(200);
    after = await Room.findById(room._id);
    expect(after?.status).toBe(RoomStatus.AVAILABLE);
    expect(after?.sellStatus).toBe("SELLABLE");
  });
});
