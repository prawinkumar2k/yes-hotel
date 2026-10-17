/**
 * Walk-in billing, end to end over HTTP:
 *   - prices including GST (Admin → Settings): a ₹1,510 room is ₹1,510 — room ₹1,438.10 +
 *     CGST ₹35.95 + SGST ₹35.95 a night — on the booking AND the bill; paying the full amount at
 *     registration marks it PAID with nothing due; extending a night adds exactly ₹1,510.
 *   - prices excluding GST (the default): GST is added on top.
 *   - either way the bill carries every night and the CGST / SGST lines (it used to carry one
 *     night's rate and no GST).
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
const ids = { category: oid(), roomA: oid(), roomB: oid() };
let server: Server;
let base = "";
let settingsBefore: any = null;
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const today = todayBusinessDate();
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const setInclusive = (v: boolean) => db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: v } });
const folioOf = async (bookingId: any) => {
  const folio: any = await db().collection("folios").findOne({ booking: new mongoose.Types.ObjectId(String(bookingId)) });
  const lines = await db().collection("foliolines").find({ folio: folio._id }).toArray();
  const sum = (t: string) => Math.round(lines.filter((l: any) => l.lineType === t).reduce((s: number, l: any) => s + l.amount, 0) * 100) / 100;
  return { folio, lines, room: sum("ROOM_CHARGE"), cgst: sum("TAX_CGST"), sgst: sum("TAX_SGST"), paid: sum("ADVANCE_ADJUSTMENT") };
};
const walkIn = (room: mongoose.Types.ObjectId, extra: Record<string, unknown> = {}) => call("POST", "/api/front-desk/registration/walk-in", {
  firstName: "Bill", lastName: `Test ${tag}`, guestName: `Bill Test ${tag}`, email: `bill-${tag}@example.com`, mobile: "9000000077",
  idType: "AADHAAR", idNumber: "123412341234", checkIn: today, checkOut: addDays(today, 2), adults: 1,
  roomId: String(room), roomIds: [String(room)], roomRates: { [String(room)]: 1510 }, billingInstruction: "CASH", ...extra,
});

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  settingsBefore = await db().collection("hotelsettings").findOne({});
  if (!settingsBefore) await db().collection("hotelsettings").insertOne({ hotelName: "Test", phone: "1", address: "x", checkInTime: "12:00", checkOutTime: "11:00" });
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Bill", lastName: "Rcp", email: `bill-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: ids.category, slug: `bill-${tag}`, name: `Bill ${tag}`, description: "test", basePrice: 1510, isActive: true, capacity: { adults: 2, children: 0 } });
  for (const [rid, no] of [[ids.roomA, `BA${tag}`], [ids.roomB, `BB${tag}`]] as const) {
    await db().collection("rooms").insertOne({ _id: rid, propertyId: P, roomNumber: no, category: ids.category, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
});

afterAll(async () => {
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: settingsBefore?.taxInclusiveRates ?? false } });
  const bookings = await db().collection("bookings").find({ assignedRoom: { $in: [ids.roomA, ids.roomB] } }).project({ _id: 1 }).toArray();
  const bIds = bookings.map((b) => b._id);
  await db().collection("folios").deleteMany({ booking: { $in: bIds } });
  await db().collection("foliolines").deleteMany({ booking: { $in: bIds } });
  await db().collection("roomnights").deleteMany({ booking: { $in: bIds } });
  await db().collection("advancepayments").deleteMany({ booking: { $in: bIds } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("guests").deleteMany({ email: `bill-${tag}@example.com` });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: ids.category });
  await db().collection("rooms").deleteMany({ _id: { $in: [ids.roomA, ids.roomB] } });
  await db().collection("roomcategories").deleteMany({ _id: ids.category });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("walk-in bill — prices including GST", () => {
  let bookingId = "";
  it("the rate preview shows ₹1,510 × 2 = ₹3,020 with GST inside", async () => {
    await setInclusive(true);
    const q = await call("POST", "/api/front-desk/registration/calculate-rate", { checkIn: today, checkOut: addDays(today, 2), adults: 1, roomIds: [String(ids.roomA)], roomRates: { [String(ids.roomA)]: 1510 } });
    expect(q.status, JSON.stringify(q.json)).toBe(200);
    expect(q.json.data.totalAmount).toBe(3020);
    expect(q.json.data.pricesIncludeTax).toBe(true);
    expect(q.json.data.tax.totalTax).toBe(143.8);
  });

  it("full payment at registration: booking and bill both ₹3,020, GST lines present, PAID, nothing due", async () => {
    const r = await walkIn(ids.roomA, { advanceAmount: 3020, advanceMethod: "UPI", advanceReference: `UPI${tag}` });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
    bookingId = String(r.json.data.booking._id);
    const b: any = await db().collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    expect(b).toMatchObject({ totalAmount: 3020, taxAmount: 143.8, pricesIncludeTax: true, paymentStatus: "PAID", paidAmount: 3020 });
    const f = await folioOf(bookingId);
    expect(f.room).toBe(2876.2);
    expect(f.cgst).toBe(71.9);
    expect(f.sgst).toBe(71.9);
    expect(f.room + f.cgst + f.sgst).toBeCloseTo(3020, 2);
    expect(f.paid).toBe(3020);
    expect(f.lines.find((l: any) => l.lineType === "ROOM_CHARGE").coversNights).toEqual([today, addDays(today, 1)]);
    expect(f.lines.find((l: any) => l.lineType === "ADVANCE_ADJUSTMENT").description).toMatch(/^Payment Received/);
  });

  it("extending one night adds exactly ₹1,510 (room ₹1,438.10 + GST ₹71.90)", async () => {
    const e = await call("POST", `/api/bookings/${bookingId}/extend`, { newCheckOutDate: addDays(today, 3) });
    expect(e.status, JSON.stringify(e.json)).toBe(200);
    const b: any = await db().collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    expect(b.totalAmount).toBe(4530);
    const f = await folioOf(bookingId);
    expect(f.room + f.cgst + f.sgst).toBeCloseTo(4530, 2);
  });

  it("a payment more than the total is refused", async () => {
    const r = await walkIn(ids.roomB, { advanceAmount: 5000, advanceMethod: "CASH" });
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/more than the total/i);
  });
});

describe("walk-in bill — prices excluding GST (default)", () => {
  it("every night and the GST added on top are on the bill; part payment is PARTIAL", async () => {
    await setInclusive(false);
    const r = await walkIn(ids.roomB, { advanceAmount: 1000, advanceMethod: "CASH" });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
    const id = r.json.data.booking._id;
    const b: any = await db().collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
    expect(b).toMatchObject({ totalAmount: 3171, taxAmount: 151, paymentStatus: "PARTIAL" });
    const f = await folioOf(id);
    expect(f.room).toBe(3020);
    expect(f.cgst + f.sgst).toBe(151);
  });
});
