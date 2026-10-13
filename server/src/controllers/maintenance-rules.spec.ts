import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MaintenanceTicket, MaintenanceStatus } from "../models/MaintenanceTicket";
import { Room, SellStatus } from "../models/Room";
import { createMaintenanceTicket, updateMaintenanceTicket } from "./maintenance.controller";
import { assertTicketTransition, SELLABLE_ROOM_FILTER } from "../services/maintenance.service";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const tag = String(oid()).slice(-6);
let roomId = "";

function call(handler: any, body: any, params: any = {}, role = "ADMIN") {
  const req: any = { body, params, propertyId: P, user: { id: String(oid()), _id: oid(), role }, headers: {}, ip: "127.0.0.1" };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => res);
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const r = await Room.create({ propertyId: P, roomNumber: `M${tag}`, category: oid(), floor: "9", sellStatus: SellStatus.SELLABLE } as any);
  roomId = String(r._id);
});

afterAll(async () => {
  await MaintenanceTicket.deleteMany({ room: roomId });
  await Room.deleteMany({ _id: roomId });
  await mongoose.connection.close();
});

describe("maintenance rules", () => {
  it("status machine rejects illegal jumps", () => {
    expect(() => assertTicketTransition(MaintenanceStatus.OPEN, MaintenanceStatus.RESOLVED)).toThrow(/cannot move/);
    expect(() => assertTicketTransition(MaintenanceStatus.CLOSED, MaintenanceStatus.OPEN)).toThrow();
    expect(() => assertTicketTransition(MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.RESOLVED)).not.toThrow();
  });

  it("a non-critical ticket keeps the room on sale", async () => {
    const res = await call(createMaintenanceTicket, { roomId, issueTitle: "Dripping tap", priority: "LOW" });
    expect(res.statusCode).toBe(201);
    expect((await Room.findById(roomId).lean())!.sellStatus).toBe(SellStatus.SELLABLE);
  });

  it("a CRITICAL ticket takes the room out of order until the last one is resolved", async () => {
    const t1 = await call(createMaintenanceTicket, { roomId, issueTitle: "Balcony door won't lock", priority: "CRITICAL" });
    const t2 = await call(createMaintenanceTicket, { roomId, issueTitle: "Sparking socket", priority: "CRITICAL" });
    let room = await Room.findById(roomId).lean();
    expect(room!.sellStatus).toBe(SellStatus.OUT_OF_ORDER);
    expect(await Room.exists({ _id: roomId, ...SELLABLE_ROOM_FILTER })).toBeNull();

    for (const t of [t1, t2]) {
      const id = String(t.body.data._id);
      expect((await call(updateMaintenanceTicket, { status: "RESOLVED" }, { id })).statusCode).toBe(400); // must be worked first
      expect((await call(updateMaintenanceTicket, { status: "IN_PROGRESS" }, { id })).statusCode).toBe(200);
    }
    expect((await call(updateMaintenanceTicket, { status: "RESOLVED" }, { id: String(t1.body.data._id) })).statusCode).toBe(200);
    expect((await Room.findById(roomId).lean())!.sellStatus).toBe(SellStatus.OUT_OF_ORDER); // t2 still open

    expect((await call(updateMaintenanceTicket, { status: "RESOLVED" }, { id: String(t2.body.data._id) })).statusCode).toBe(200);
    room = await Room.findById(roomId).lean();
    expect(room!.sellStatus).toBe(SellStatus.SELLABLE);
    expect((room as any).maintenanceHold).toBeUndefined();
  });

  it("escalating a ticket to CRITICAL takes the room out of order; closing an untouched ticket needs a reason", async () => {
    const t = await call(createMaintenanceTicket, { roomId, issueTitle: "AC noisy", priority: "MEDIUM" });
    const id = String(t.body.data._id);
    await call(updateMaintenanceTicket, { priority: "CRITICAL" }, { id });
    expect((await Room.findById(roomId).lean())!.sellStatus).toBe(SellStatus.OUT_OF_ORDER);
    expect((await call(updateMaintenanceTicket, { status: "CLOSED" }, { id })).statusCode).toBe(400);
    expect((await call(updateMaintenanceTicket, { status: "CLOSED", closeReason: "duplicate of earlier ticket" }, { id })).statusCode).toBe(200);
    expect((await Room.findById(roomId).lean())!.sellStatus).toBe(SellStatus.SELLABLE);
  });
});
