/**
 * Walk-in registration: a discount given to the customer (% or flat) is applied to the bill and kept on the
 * booking; an OTA commission can be a % or a flat amount.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { todayBusinessDate, addDays } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const admin = oid();
const cat = oid();
const rooms = [oid(), oid(), oid(), oid(), oid()];
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
let settingsBefore: any = null;
const db = () => mongoose.connection.db!;
const token = () => jwt.sign({ id: String(admin), role: "ADMIN" }, getJwtSecret(), { expiresIn: "10m" });
const post = async (path: string, body: Record<string, unknown>) => {
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
};
const today = todayBusinessDate();
const guest = (n: number, extra: Record<string, unknown> = {}) => ({
  firstName: "Disc", lastName: `${tag}${n}`, guestName: `Disc ${tag}${n}`, mobile: `90000${String(n).padStart(5, "0")}`, idType: "AADHAAR", idNumber: "123412341234",
  checkIn: today, checkOut: addDays(today, 1), adults: 2, billingInstruction: "CASH", ...extra,
});
const stay = (ids: number[], rate = 2000) => ({ roomId: String(rooms[ids[0]]), roomIds: ids.map((i) => String(rooms[i])), roomRates: Object.fromEntries(ids.map((i) => [String(rooms[i]), rate])) });
const booking = (ref: string) => db().collection("bookings").findOne({ bookingReference: ref }) as Promise<any>;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  settingsBefore = await db().collection("hotelsettings").findOne({});
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: false } });
  await db().collection("users").insertOne({ _id: admin, role: "ADMIN", firstName: "Disc", lastName: tag, email: `disc-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: cat, slug: `disc-${tag}`, name: `Disc ${tag}`, description: "t", basePrice: 2000, isActive: true, capacity: { adults: 2, children: 0 } });
  for (const [i, r] of rooms.entries()) {
    await db().collection("rooms").insertOne({ _id: r, propertyId: P, roomNumber: `D${i}${tag}`, category: cat, floor: "1", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
});

afterAll(async () => {
  const bs = await db().collection("bookings").find({ "guestDetails.lastName": { $regex: `^${tag}` } }).toArray();
  const ids = bs.map((b) => b._id);
  const folios = await db().collection("folios").find({ booking: { $in: ids } }).project({ _id: 1 }).toArray();
  await db().collection("foliolines").deleteMany({ folio: { $in: folios.map((f) => f._id) } });
  await db().collection("folios").deleteMany({ booking: { $in: ids } });
  for (const c of ["roomnights", "bookinginventorydays", "verificationrequests"]) await db().collection(c).deleteMany({ $or: [{ booking: { $in: ids } }, { bookingId: { $in: ids } }, { roomCategory: cat }] });
  await db().collection("bookings").deleteMany({ _id: { $in: ids } });
  await db().collection("guests").deleteMany({ fullName: { $regex: `^Disc ${tag}` } });
  await db().collection("rooms").deleteMany({ _id: { $in: rooms } });
  await db().collection("roomcategories").deleteMany({ _id: cat });
  await db().collection("users").deleteMany({ _id: admin });
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: settingsBefore?.taxInclusiveRates ?? false } });
  await new Promise((r) => server.close(r));
});

describe("discount to the customer", () => {
  it("a % discount comes off the bill before GST and is kept on the booking", async () => {
    const calc = await post("/api/front-desk/registration/calculate-rate", { ...stay([0]), checkIn: today, checkOut: addDays(today, 1), adults: 2, discountType: "PERCENT", discountValue: 10 });
    expect(calc.status, JSON.stringify(calc.json)).toBe(200);
    expect(calc.json.data.discountAmount).toBe(200);
    const r = await post("/api/front-desk/registration/walk-in", { ...guest(1), ...stay([0]), discountType: "PERCENT", discountValue: 10, discountReason: "Regular guest" });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const b = await booking(r.json.data.booking.bookingReference);
    expect(b).toMatchObject({ discountAmount: 200, discountType: "PERCENT", discountValue: 10, discountReason: "Regular guest" });
    // ₹2,000 − ₹200 = ₹1,800 taxable; the total is what the calculation showed
    expect(b.totalAmount - b.taxAmount).toBeCloseTo(1800, 1);
    expect(b.totalAmount).toBeCloseTo(calc.json.data.totalAmount, 1);
  });

  it("a flat discount on several rooms is shared in proportion and adds up exactly", async () => {
    const r = await post("/api/front-desk/registration/walk-in", { ...guest(2), ...stay([1, 2, 3]), discountType: "FLAT", discountValue: 100 });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const bs = await db().collection("bookings").find({ "guestDetails.lastName": `${tag}2` }).toArray();
    expect(bs).toHaveLength(3);
    expect(bs.reduce((t, x) => t + x.discountAmount, 0)).toBeCloseTo(100, 2);
    expect(bs.every((x) => x.discountType === "FLAT" && x.discountValue === 100)).toBe(true);
  });

  it("refuses a discount bigger than the bill or over 100%", async () => {
    const big = await post("/api/front-desk/registration/walk-in", { ...guest(3), ...stay([4]), discountType: "FLAT", discountValue: 99999 });
    expect(big.status).toBeGreaterThanOrEqual(400);
    expect(String(big.json.message)).toMatch(/discount/i);
    const over = await post("/api/front-desk/registration/walk-in", { ...guest(4), ...stay([4]), discountType: "PERCENT", discountValue: 150 });
    expect(over.status).toBeGreaterThanOrEqual(400);
    expect(String(over.json.message)).toMatch(/100%/);
  });
});

describe("OTA commission as a % or a flat amount", () => {
  const ota = { bookingSource: "OTA", otaName: "MakeMyTrip", otaPaymentModel: "OTA_PREPAID" };

  it("a % commission is worked out on the pre-tax amount", async () => {
    const r = await post("/api/front-desk/registration/walk-in", { ...guest(5), ...stay([4]), ...ota, otaConfirmationNumber: "C1", otaCommissionType: "PERCENT", otaCommissionValue: 18 });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const b = await booking(r.json.data.booking.bookingReference);
    expect(b.otaCommissionType).toBe("PERCENT");
    expect(b.otaCommissionAmount).toBeCloseTo((b.totalAmount - b.taxAmount) * 0.18, 1);
  });

  it("a flat commission is exactly the amount entered", async () => {
    await db().collection("bookings").deleteMany({ "guestDetails.lastName": `${tag}5` });
    await db().collection("rooms").updateOne({ _id: rooms[4] }, { $set: { occupancyStatus: "VACANT", status: "AVAILABLE", housekeepingStatus: "CLEAN" } });
    await db().collection("roomnights").deleteMany({ room: rooms[4] });
    await db().collection("bookinginventorydays").deleteMany({ roomCategory: cat });
    const r = await post("/api/front-desk/registration/walk-in", { ...guest(6), ...stay([4]), ...ota, otaConfirmationNumber: "C2", otaCommissionType: "FLAT", otaCommissionValue: 250 });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const b = await booking(r.json.data.booking.bookingReference);
    expect(b).toMatchObject({ otaCommissionType: "FLAT", otaCommissionFlat: 250, otaCommissionAmount: 250 });
    expect(b.otaCommissionPercent).toBeCloseTo((250 / (b.totalAmount - b.taxAmount)) * 100, 1);
    expect(b.otaReceivable).toBeCloseTo(b.totalAmount - 250, 1); // prepaid: the OTA owes the room total less the commission
  });

  it("a flat commission above the room amount is refused", async () => {
    const r = await post("/api/front-desk/registration/walk-in", { ...guest(7), ...stay([3]), ...ota, otaConfirmationNumber: "C3", otaCommissionType: "FLAT", otaCommissionValue: 999999 });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
