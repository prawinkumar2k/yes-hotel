/**
 * Rooms to clean go to a free housekeeper automatically (no one at Reception / Admin assigns):
 * someone who is not cleaning a room right now first, then the fewest open rooms; when a
 * housekeeper finishes, waiting rooms are handed out again.
 * Also: the tariff typed at express checkout re-rates the room for the nights stayed, with GST.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { assignWaitingTasks } from "../services/housekeeping-assign.service";
import { addDays, todayBusinessDate } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const P = oid();
const hkA = oid();
const hkB = oid();
const reception = oid();
const category = oid();
const rooms = { busy: oid(), r1: oid(), r2: oid(), r3: oid(), stay: oid() };
let server: Server;
let base = "";
let settingsBefore: any = null;
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const dirtyTask = async (room: mongoose.Types.ObjectId) => {
  await db().collection("rooms").updateOne({ _id: room }, { $set: { housekeepingStatus: "DIRTY" } });
  return (await db().collection("housekeepingtasks").insertOne({ propertyId: P, room, status: "DIRTY", priority: "HIGH", taskType: "CHECKOUT_CLEAN", createdAt: new Date() })).insertedId;
};
const taskOf = (id: unknown) => db().collection("housekeepingtasks").findOne({ _id: id as any }) as Promise<any>;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  // Other housekeepers in the test database must not take these rooms: park them for the test.
  await db().collection("users").updateMany({ role: "HOUSEKEEPING", _id: { $nin: [hkA, hkB] } }, { $set: { [`_parked_${tag}`]: true, isActive: false } });
  await db().collection("properties").insertOne({ _id: P, code: `HK-${tag}`, name: `HK ${tag}` });
  await db().collection("users").insertMany([
    { _id: hkA, role: "HOUSEKEEPING", firstName: "Anu", lastName: tag, email: `hk-a-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] },
    { _id: hkB, role: "HOUSEKEEPING", firstName: "Bala", lastName: tag, email: `hk-b-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] },
  ]);
  await db().collection("roomcategories").insertOne({ _id: category, slug: `hk-${tag}`, name: `HK ${tag}`, description: "test", basePrice: 1510, isActive: true, capacity: { adults: 2, children: 0 } });
  for (const [k, rid] of Object.entries(rooms)) {
    await db().collection("rooms").insertOne({ _id: rid, propertyId: P, roomNumber: `H${k}${tag}`, category, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
  // A is cleaning a room right now.
  await db().collection("rooms").updateOne({ _id: rooms.busy }, { $set: { housekeepingStatus: "CLEANING" } });
  await db().collection("housekeepingtasks").insertOne({ propertyId: P, room: rooms.busy, status: "CLEANING", assignedTo: hkA, assignedAt: new Date(), priority: "HIGH", taskType: "CHECKOUT_CLEAN" });
});

afterAll(async () => {
  await db().collection("users").updateMany({ [`_parked_${tag}`]: true }, { $set: { isActive: true }, $unset: { [`_parked_${tag}`]: "" } });
  const bIds = (await db().collection("bookings").find({ assignedRoom: { $in: Object.values(rooms) } }).project({ _id: 1 }).toArray()).map((b) => b._id);
  for (const c of ["folios", "foliolines", "roomnights", "advancepayments"]) await db().collection(c).deleteMany({ booking: { $in: bIds } });
  await db().collection("verificationrequests").deleteMany({ bookingId: { $in: bIds } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("guests").deleteMany({ phone: "9000000066" });
  await db().collection("housekeepingtasks").deleteMany({ room: { $in: Object.values(rooms) } });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: category });
  await db().collection("rooms").deleteMany({ _id: { $in: Object.values(rooms) } });
  await db().collection("roomcategories").deleteMany({ _id: category });
  await db().collection("users").deleteMany({ _id: { $in: [hkA, hkB, reception] } });
  await db().collection("properties").deleteMany({ _id: P });
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: settingsBefore?.taxInclusiveRates ?? false } });
  await new Promise((r) => server.close(r));
});

describe("automatic housekeeping assignment", () => {
  it("a room to clean goes to the housekeeper who is free (B — A is cleaning)", async () => {
    const t1 = await dirtyTask(rooms.r1);
    await assignWaitingTasks();
    const t = await taskOf(t1);
    expect(String(t.assignedTo)).toBe(String(hkB));
    expect(t.status).toBe("ASSIGNED");
    expect((await db().collection("rooms").findOne({ _id: rooms.r1 }))!.housekeepingStatus).toBe("ASSIGNED");
  });

  it("while A is still cleaning, the next room also goes to B (not cleaning)", async () => {
    const t2 = await dirtyTask(rooms.r2);
    await assignWaitingTasks();
    expect(String((await taskOf(t2)).assignedTo)).toBe(String(hkB));
  });

  it("once A finishes, A is free and gets the next room", async () => {
    await db().collection("rooms").updateOne({ _id: rooms.busy }, { $set: { housekeepingStatus: "CLEANING_COMPLETED" } });
    const t3 = await dirtyTask(rooms.r3);
    await assignWaitingTasks();
    expect(String((await taskOf(t3)).assignedTo)).toBe(String(hkA));
  });
});

describe("tariff typed at express checkout", () => {
  it("leaving today from a 2-night ₹1,510 stay at ₹1,200: 1 night × ₹1,200 incl. GST on the bill", async () => {
    settingsBefore = await db().collection("hotelsettings").findOne({});
    await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: true } });
    await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Hk", lastName: "Rcp", email: `hk-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
    const today = todayBusinessDate();
    const r = await call("POST", "/api/front-desk/registration/walk-in", {
      firstName: "Tariff", lastName: tag, guestName: `Tariff ${tag}`, mobile: "9000000066",
      idType: "AADHAAR", idNumber: "123412341234", checkIn: today, checkOut: addDays(today, 2), adults: 1,
      roomId: String(rooms.stay), roomIds: [String(rooms.stay)], roomRates: { [String(rooms.stay)]: 1510 }, billingInstruction: "CASH",
    });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); // no email: optional for walk-ins
    const id = String(r.json.data.booking._id);
    const b0: any = await db().collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(id) });
    expect(b0.guestDetails.email).toBe("");

    const t = await call("POST", `/api/front-desk/bookings/${id}/checkout-tariff`, { ratePerNight: 1200 });
    expect(t.status, JSON.stringify(t.json)).toBe(200);
    const folio: any = await db().collection("folios").findOne({ booking: new mongoose.Types.ObjectId(id) });
    const { computeFolioTotals } = await import("../services/folio-ledger");
    const ls = await db().collection("foliolines").find({ folio: folio._id }).toArray();
    const totals = computeFolioTotals(ls as any);
    expect(t.json.data.nights).toBe(1);
    expect(t.json.data.earlyDeparture.nightsCredited).toHaveLength(1);
    expect(totals.totalCharges + totals.totalTax).toBeCloseTo(1200, 1);
    expect(totals.cgst).toBeCloseTo(28.57, 1);
    const b: any = await db().collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(id) });
    expect(b.ratePerNight).toBe(1200);
    expect(b.totalAmount).toBeCloseTo(1200, 1);
    // Once more at the same rate: nothing changes.
    expect((await call("POST", `/api/front-desk/bookings/${id}/checkout-tariff`, { ratePerNight: 1200 })).status).toBe(200);
    const again = computeFolioTotals((await db().collection("foliolines").find({ folio: folio._id }).toArray()) as any);
    expect(again.totalCharges + again.totalTax).toBeCloseTo(1200, 1);
  });
});
