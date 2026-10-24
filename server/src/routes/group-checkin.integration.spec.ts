/**
 * Group check-in: several rooms under one name and one registration. The adults are shared out across the rooms
 * (not all on the first), each room is priced by the adults it holds, and the guest counts add up.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { addDays, todayBusinessDate } from "../../../shared/dates";
import { splitAcrossRooms } from "../services/tariff.service";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const ids = { cat: oid(), r1: oid(), r2: oid() };
let server: Server;
let base = "";
let groupBookings: any[] = [];
const db = () => mongoose.connection.db!;
const today = todayBusinessDate();
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const post = async (path: string, body: unknown) => {
  const res = await fetch(base + path, { method: "POST", headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const stay = (extra: Record<string, unknown> = {}) => ({
  roomId: String(ids.r1), roomIds: [String(ids.r1), String(ids.r2)], checkIn: today, checkOut: addDays(today, 1), adults: 4, mealPlan: "EP", ...extra,
});

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  if (!(await db().collection("hotelsettings").findOne({}))) await db().collection("hotelsettings").insertOne({ hotelName: "Test", phone: "1", address: "x", checkInTime: "12:00", checkOutTime: "11:00" });
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Gr", lastName: "Rcp", email: `grp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: ids.cat, slug: `grp-${tag}`, name: `Group ${tag}`, description: "t", basePrice: 2000, singleOccupancyPrice: 1800, isActive: true, capacity: { adults: 3, children: 0 } });
  for (const [rid, no] of [[ids.r1, `GA${tag}`], [ids.r2, `GB${tag}`]] as const) {
    await db().collection("rooms").insertOne({ _id: rid, propertyId: P, roomNumber: no, category: ids.cat, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE" });
  }
});

afterAll(async () => {
  const bookings = await db().collection("bookings").find({ assignedRoom: { $in: [ids.r1, ids.r2] } }).project({ _id: 1 }).toArray();
  const bIds = bookings.map((b) => b._id);
  for (const c of ["foliolines", "roomnights", "advancepayments"]) await db().collection(c).deleteMany({ booking: { $in: bIds } });
  await db().collection("folios").deleteMany({ booking: { $in: bIds } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("guests").deleteMany({ email: `grp-${tag}@example.com` });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: ids.cat });
  await db().collection("rooms").deleteMany({ _id: { $in: [ids.r1, ids.r2] } });
  await db().collection("roomcategories").deleteMany({ _id: ids.cat });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("splitting guests across rooms (pure)", () => {
  it("4 adults in 2 rooms is 2 + 2; 3 is 2 + 1; every room has at least one adult", () => {
    expect(splitAcrossRooms(4, 0, 2).map((x) => x.adults)).toEqual([2, 2]);
    expect(splitAcrossRooms(3, 0, 2).map((x) => x.adults)).toEqual([2, 1]);
    expect(splitAcrossRooms(1, 0, 2).map((x) => x.adults)).toEqual([1, 1]);
    expect(splitAcrossRooms(5, 3, 3).map((x) => [x.adults, x.children])).toEqual([[2, 1], [2, 1], [1, 1]]);
  });
  it("men are placed first, then women, so the counts add up", () => {
    const s = splitAcrossRooms(4, 0, 2, 3);
    expect(s.map((x) => [x.maleCount, x.femaleCount])).toEqual([[2, 0], [1, 1]]);
  });
});

describe("group check-in over HTTP", () => {
  it("the rate preview prices each room by its own adults", async () => {
    const four = await post("/api/front-desk/registration/calculate-rate", stay());
    expect(four.json.data.rooms.map((r: any) => r.ratePerNight)).toEqual([2000, 2000]);
    const three = await post("/api/front-desk/registration/calculate-rate", stay({ adults: 3 }));
    expect(three.json.data.rooms.map((r: any) => r.ratePerNight).sort()).toEqual([1800, 2000]);
    const two = await post("/api/front-desk/registration/calculate-rate", stay({ adults: 2 }));
    expect(two.json.data.rooms.map((r: any) => r.ratePerNight)).toEqual([2000, 2000].map(() => 1800)); // one adult each
  });

  it("4 adults in 2 rooms under one name: two bookings of 2 adults each, linked as one group", async () => {
    const r = await post("/api/front-desk/registration/walk-in", {
      ...stay({ maleCount: 3, femaleCount: 1 }), firstName: "Group", lastName: `Guest ${tag}`, guestName: `Group Guest ${tag}`, email: `grp-${tag}@example.com`, mobile: "9000000066",
      idType: "AADHAAR", idNumber: "123412341234", billingInstruction: "CASH",
    });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
    groupBookings = await db().collection("bookings").find({ assignedRoom: { $in: [ids.r1, ids.r2] } }).sort({ assignedRoom: 1 }).toArray();
    expect(groupBookings).toHaveLength(2);
    expect(groupBookings.map((b) => b.adults)).toEqual([2, 2]);
    expect(groupBookings.reduce((t, b) => t + b.adults, 0)).toBe(4);
    expect(groupBookings.map((b) => [b.maleCount, b.femaleCount])).toEqual([[2, 0], [1, 1]]);
    expect(groupBookings.map((b) => b.ratePerNight)).toEqual([2000, 2000]);
    expect(String(groupBookings[0].groupId)).toBe(String(groupBookings[1].groupId));
    expect(groupBookings.every((b) => b.guestDetails.firstName === "Group")).toBe(true);
  });
});
