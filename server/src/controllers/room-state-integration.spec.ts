import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { checkIn } from "./booking.controller";
import { createMaintenanceTicket, updateMaintenanceTicket } from "./maintenance.controller";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus } from "../models/Room";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

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
    guestDetails: { firstName: "Room", lastName: "State", email: `rsi-${stamp}@test.local`, phone: "9999999999" },
    roomCategory: new mongoose.Types.ObjectId(),
    checkInDate: new Date(Date.now() + 86400000),
    checkOutDate: new Date(Date.now() + 2 * 86400000),
    adults: 1,
    children: 0,
    totalAmount: 1000,
    taxAmount: 0,
    status: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
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
      { params: { id: booking._id.toString() }, body: { roomId: room._id.toString() }, user: { id: "staff1", role: "ADMIN" } } as any,
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
      { params: { id: booking._id.toString() }, body: { roomId: room._id.toString() }, user: { id: "staff1", role: "ADMIN" } } as any,
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it("allows check-in into an AVAILABLE room and marks it OCCUPIED", async () => {
    const room = await createRoom(RoomStatus.AVAILABLE);
    const booking = await createConfirmedBooking();

    const res = mockRes();
    await checkIn(
      { params: { id: booking._id.toString() }, body: { roomId: room._id.toString() }, user: { id: "staff1", role: "ADMIN" } } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    const updatedRoom = await Room.findById(room._id);
    expect(updatedRoom?.status).toBe(RoomStatus.OCCUPIED);
    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking?.status).toBe(BookingStatus.CHECKED_IN);
  });
});

describe("maintenance ticket resolution restores the room's actual prior state (previously always forced AVAILABLE)", () => {
  it("restores OCCUPIED, not AVAILABLE, when the ticket was filed against an occupied room", async () => {
    const room = await createRoom(RoomStatus.OCCUPIED);

    const createRes = mockRes();
    await createMaintenanceTicket(
      {
        body: { roomId: room._id.toString(), issueTitle: "room-state-test AC broken" },
        user: { id: "staff1", role: "MAINTENANCE" },
      } as any,
      createRes
    );
    expect(createRes.statusCode).toBe(201);

    const roomAfterTicket = await Room.findById(room._id);
    expect(roomAfterTicket?.status).toBe(RoomStatus.MAINTENANCE);

    const ticketId = createRes.body.data._id.toString();
    const resolveRes = mockRes();
    await updateMaintenanceTicket(
      { params: { id: ticketId }, body: { status: MaintenanceStatus.RESOLVED }, user: { id: "staff1", role: "MAINTENANCE" } } as any,
      resolveRes
    );
    expect(resolveRes.statusCode).toBe(200);

    // The real bug: this used to unconditionally become AVAILABLE here,
    // even though a guest was still occupying the room the whole time.
    const roomAfterResolution = await Room.findById(room._id);
    expect(roomAfterResolution?.status).toBe(RoomStatus.OCCUPIED);
  });

  it("restores AVAILABLE when the ticket was filed against a room that was AVAILABLE", async () => {
    const room = await createRoom(RoomStatus.AVAILABLE);

    const createRes = mockRes();
    await createMaintenanceTicket(
      { body: { roomId: room._id.toString(), issueTitle: "room-state-test leaky faucet" }, user: { id: "staff1", role: "MAINTENANCE" } } as any,
      createRes
    );
    const ticketId = createRes.body.data._id.toString();

    const resolveRes = mockRes();
    await updateMaintenanceTicket(
      { params: { id: ticketId }, body: { status: MaintenanceStatus.RESOLVED }, user: { id: "staff1", role: "MAINTENANCE" } } as any,
      resolveRes
    );

    const roomAfterResolution = await Room.findById(room._id);
    expect(roomAfterResolution?.status).toBe(RoomStatus.AVAILABLE);
  });
});
