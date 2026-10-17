/**
 * Early check-in and late check-out by the hour (Front Desk → Extend → hours / Early C/I):
 *   - the price is the room type's hourly price × hours (staff can change it); with prices
 *     including GST the GST is inside it, and the bill gets the line with its CGST + SGST;
 *   - the booking's departure / arrival time and totals follow, and the GRC shows it;
 *   - hours that run past midnight, a second charge, or a late check-out when the next guest
 *     arrives in the room that day are refused (unless staff tick "add anyway").
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { addDays, todayBusinessDate } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const category = oid();
const rooms = [oid(), oid()];
let server: Server;
let base = "";
let settingsBefore: any = null;
let bookingId = "";
const db = () => mongoose.connection.db!;
const today = todayBusinessDate();
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};
const lines = async (id: string) => {
  const folio: any = await db().collection("folios").findOne({ booking: new mongoose.Types.ObjectId(id) });
  return db().collection("foliolines").find({ folio: folio._id }).toArray() as Promise<any[]>;
};
const bookingOf = (id: string) => db().collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(id) }) as Promise<any>;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  settingsBefore = await db().collection("hotelsettings").findOne({});
  if (!settingsBefore) await db().collection("hotelsettings").insertOne({ hotelName: "Test", phone: "1", address: "x", checkInTime: "12:00", checkOutTime: "11:00" });
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: true, checkInTime: "12:00", checkOutTime: "11:00" } });
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Hr", lastName: "Rcp", email: `hours-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: category, slug: `hours-${tag}`, name: `Hours ${tag}`, description: "test", basePrice: 1510, hourlyPrice: 300, isActive: true, capacity: { adults: 2, children: 0 } });
  for (const [i, rid] of rooms.entries()) {
    await db().collection("rooms").insertOne({ _id: rid, propertyId: P, roomNumber: `HR${i}${tag}`, category, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
  const r = await call("POST", "/api/front-desk/registration/walk-in", {
    firstName: "Hours", lastName: `Test ${tag}`, guestName: `Hours Test ${tag}`, email: `hours-${tag}@example.com`, mobile: "9000000099",
    idType: "AADHAAR", idNumber: "123412341234", checkIn: today, checkOut: addDays(today, 1), adults: 1,
    roomId: String(rooms[0]), roomIds: [String(rooms[0])], roomRates: { [String(rooms[0])]: 1510 }, billingInstruction: "CASH",
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  bookingId = String(r.json.data.booking._id);
});

afterAll(async () => {
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: settingsBefore?.taxInclusiveRates ?? false, checkInTime: settingsBefore?.checkInTime ?? "12:00", checkOutTime: settingsBefore?.checkOutTime ?? "11:00" } });
  const bIds = (await db().collection("bookings").find({ $or: [{ assignedRoom: { $in: rooms } }, { bookingReference: `NEXT-${tag}` }] }).project({ _id: 1 }).toArray()).map((b) => b._id);
  for (const c of ["folios", "foliolines", "roomnights"]) await db().collection(c).deleteMany({ booking: { $in: bIds } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("guests").deleteMany({ email: `hours-${tag}@example.com` });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: category });
  await db().collection("rooms").deleteMany({ _id: { $in: rooms } });
  await db().collection("roomcategories").deleteMany({ _id: category });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("late check-out by the hour", () => {
  it("quotes 3 hours at ₹300/hour = ₹900 with GST inside, departure 11:00 → 14:00", async () => {
    const q = await call("GET", `/api/front-desk/bookings/${bookingId}/time-charge?kind=LATE_CHECK_OUT&hours=3`);
    expect(q.status, JSON.stringify(q.json)).toBe(200);
    expect(q.json.data).toMatchObject({ amount: 900, total: 900, fromTime: "11:00", toTime: "14:00", hourlyPrice: 300, pricesIncludeTax: true, gstRate: 5 });
    expect(q.json.data.taxable + q.json.data.cgst + q.json.data.sgst).toBeCloseTo(900, 2);
  });

  it("posts it to the bill with CGST + SGST; the departure time and total follow", async () => {
    const before = await bookingOf(bookingId);
    const r = await call("POST", `/api/front-desk/bookings/${bookingId}/time-charge`, { kind: "LATE_CHECK_OUT", hours: 3 });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const ls = await lines(bookingId);
    const late = ls.find((l) => l.lineType === "LATE_CHECK_OUT");
    expect(late.amount).toBe(857.14);
    expect(late.description).toMatch(/3 hours \(until 14:00\)/);
    expect(ls.filter((l) => /late check-out/.test(l.description) && l.lineType === "TAX_CGST")[0].amount).toBe(21.43);
    const b = await bookingOf(bookingId);
    expect(b.departureTime).toBe("14:00");
    expect(b.totalAmount).toBeCloseTo(before.totalAmount + 900, 2);
    expect(b.timeCharges).toHaveLength(1);
    expect(b.timeCharges[0]).toMatchObject({ kind: "LATE_CHECK_OUT", hours: 3, fromTime: "11:00", toTime: "14:00", amount: 900 });
  });

  it("the registration card shows the late check-out", async () => {
    const r = await call("GET", `/api/front-desk/registration/${bookingId}/print`);
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/Late check-out:<\/b> \+3 hours, departure 11:00 &rarr; 14:00/);
  });

  it("a second late check-out needs 'add anyway'; then it runs on from 14:00", async () => {
    expect((await call("POST", `/api/front-desk/bookings/${bookingId}/time-charge`, { kind: "LATE_CHECK_OUT", hours: 2 })).status).toBe(409);
    const r = await call("POST", `/api/front-desk/bookings/${bookingId}/time-charge`, { kind: "LATE_CHECK_OUT", hours: 2, force: true });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.data).toMatchObject({ fromTime: "14:00", toTime: "16:00" });
  });

  it("hours past midnight or zero hours are refused", async () => {
    expect((await call("GET", `/api/front-desk/bookings/${bookingId}/time-charge?kind=LATE_CHECK_OUT&hours=12`)).status).toBe(400);
    expect((await call("GET", `/api/front-desk/bookings/${bookingId}/time-charge?kind=LATE_CHECK_OUT&hours=0`)).status).toBe(400);
  });

  it("refused when the next guest arrives in this room that day", async () => {
    const b = await bookingOf(bookingId);
    await db().collection("bookings").insertOne({ bookingReference: `NEXT-${tag}`, assignedRoom: rooms[0], roomCategory: category, status: "CONFIRMED", checkInDate: b.checkOutDate, checkOutDate: new Date(b.checkOutDate.getTime() + 86400000), guestDetails: { firstName: "Next", lastName: "Guest", email: "n@example.com", phone: "1" }, totalAmount: 0, adults: 1 });
    const r = await call("POST", `/api/front-desk/bookings/${bookingId}/time-charge`, { kind: "LATE_CHECK_OUT", hours: 1, force: false });
    expect(r.status).toBe(409);
    expect(r.json.message).toMatch(new RegExp(`NEXT-${tag}`));
  });
});

describe("early check-in by the hour", () => {
  it("2 hours at a price staff set (₹500): arrival 10:00, line on the bill", async () => {
    const q = await call("GET", `/api/front-desk/bookings/${bookingId}/time-charge?kind=EARLY_CHECK_IN&hours=2`);
    expect(q.json.data).toMatchObject({ amount: 600, fromTime: "12:00", toTime: "10:00" });
    const r = await call("POST", `/api/front-desk/bookings/${bookingId}/time-charge`, { kind: "EARLY_CHECK_IN", hours: 2, amount: 500 });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const early = (await lines(bookingId)).find((l) => l.lineType === "EARLY_CHECK_IN");
    expect(early.amount).toBe(476.19);
    expect((await bookingOf(bookingId)).arrivalTime).toBe("10:00");
  });

  it("not before check-in", async () => {
    const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
    const r = await db().collection("bookings").insertOne({ bookingReference: `PRE-${tag}`, propertyId: P, assignedRoom: rooms[1], roomCategory: category, status: "CONFIRMED", checkInDate: new Date(), checkOutDate: new Date(Date.now() + 86400000), guestDetails: { firstName: "P", lastName: "G", email: "p@example.com", phone: "1" }, totalAmount: 0, adults: 1 });
    const out = await call("POST", `/api/front-desk/bookings/${r.insertedId}/time-charge`, { kind: "EARLY_CHECK_IN", hours: 1 });
    expect(out.status).toBe(409);
    await db().collection("bookings").deleteOne({ _id: r.insertedId });
  });
});
