/**
 * Advance booking — a guest pays an advance now to reserve rooms for a later stay.
 * The scenario from the hotel's own "Booking Confirmation": 10 Deluxe rooms, 20 adults, one night,
 * ₹15,000 (GST 5% inside), ₹4,000 advance.
 *
 *   - rooms are held by TYPE (no room numbers yet); one confirmed booking per room, shared group;
 *   - the advance goes on the same guest, once; repeated submits don't double-book;
 *   - sold-out dates are refused; bad input is refused with a clear message;
 *   - the confirmation shows the real numbers; every room's bill can use the group's advance;
 *   - a rate below the room type's goes to Reception's verification queue.
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
const cashChannel = oid();
const phone = `98${tag.replace(/[a-f]/g, "5")}77`.slice(0, 10).padEnd(10, "7");
let server: Server;
let base = "";
let P: mongoose.Types.ObjectId;
let settingsBefore: any = null;
const db = () => mongoose.connection.db!;
const today = todayBusinessDate();
const night = (offset: number) => ({ checkIn: addDays(today, offset), checkOut: addDays(today, offset + 1) });
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "10m" });
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
let n = 0;
const form = (extra: Record<string, unknown> = {}) => ({
  guest: { name: "Murthy L", phone, email: `murthy-${tag}@example.com`, address: "#03, 17Th Block, Kaveri Sankirana, Bengaluru-560 030", gstin: "29AFAFS2437J1ZS" },
  roomCategoryId: String(category), rooms: 10, adults: 20, children: 0, mealPlan: "EP", ratePerNight: 1500,
  ...night(40), arrivalTime: "14:00", departureTime: "12:00",
  advance: { amount: 4000, paymentChannelId: String(cashChannel) },
  clientRequestId: `req-${tag}-${++n}-abcdefgh`,
  ...extra,
});
const bookingsOf = (groupId: string) => db().collection("bookings").find({ groupId: new mongoose.Types.ObjectId(groupId) }).sort({ bookingReference: 1 }).toArray() as Promise<any[]>;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  settingsBefore = await db().collection("hotelsettings").findOne({});
  if (!settingsBefore) await db().collection("hotelsettings").insertOne({ hotelName: "Test", phone: "1", address: "x", checkInTime: "12:00", checkOutTime: "11:00" });
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: true, checkInTime: "14:00", checkOutTime: "12:00" } });
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Adv", lastName: "Book", email: `advbook-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: category, slug: `advbook-${tag}`, name: `Deluxe ${tag}`, description: "t", basePrice: 1500, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("paymentchannels").insertOne({ _id: cashChannel, propertyId: P, name: "Cash Counter", code: `CASH-${tag}`, type: "CASH", settlementMode: "IMMEDIATE", commissionPercentage: 0, fixedFee: 0, taxOnFee: 0, displayOrder: 1, isActive: true });
  for (let i = 0; i < 10; i++) {
    await db().collection("rooms").insertOne({ _id: oid(), propertyId: P, roomNumber: `AB${i}${tag}`, category, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
});

afterAll(async () => {
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: settingsBefore?.taxInclusiveRates ?? false, checkInTime: settingsBefore?.checkInTime ?? "12:00", checkOutTime: settingsBefore?.checkOutTime ?? "11:00" } });
  const bIds = (await db().collection("bookings").find({ roomCategory: category }).project({ _id: 1 }).toArray()).map((b) => b._id);
  const advIds = (await db().collection("advancepayments").find({ booking: { $in: bIds } }).project({ _id: 1 }).toArray()).map((a) => a._id);
  await db().collection("advanceadjustments").deleteMany({ advancePayment: { $in: advIds } });
  await db().collection("advancepayments").deleteMany({ _id: { $in: advIds } });
  await db().collection("foliolines").deleteMany({ booking: { $in: bIds } });
  await db().collection("folios").deleteMany({ booking: { $in: bIds } });
  await db().collection("verificationrequests").deleteMany({ booking: { $in: bIds } });
  await db().collection("bookingidempotencies").deleteMany({ key: { $regex: `^advres:.*${tag}` } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: category });
  await db().collection("guests").deleteMany({ $or: [{ email: `murthy-${tag}@example.com` }, { phone: { $regex: phone.slice(-6) } }] });
  await db().collection("rooms").deleteMany({ category });
  await db().collection("roomcategories").deleteMany({ _id: category });
  await db().collection("paymentchannels").deleteMany({ _id: cashChannel });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("quote", () => {
  it("10 rooms × 1 night × ₹1,500 (GST inside) = ₹15,000 with CGST + SGST, 10 rooms free", async () => {
    const q = await call("POST", "/api/advances/bookings/quote", form());
    expect(q.status, JSON.stringify(q.json)).toBe(200);
    const d = q.json.data;
    expect(d).toMatchObject({ nights: 1, rooms: 10, pricesIncludeTax: true, total: 15000, roundedTotal: 15000, roundOff: 0, availableRooms: 10, canBook: true, gstRate: 5, arrivalTime: "14:00", departureTime: "12:00" });
    expect(d.cgst + d.sgst).toBeCloseTo(d.totalGst, 2);
    expect(d.taxable + d.totalGst).toBeCloseTo(15000, 1);
    expect(d.capacityWarning).toBeUndefined(); // 20 adults in 10 rooms of 2
  });

  it("warns when there are more adults than the rooms hold; meal plan is charged per person per night", async () => {
    const q = await call("POST", "/api/advances/bookings/quote", form({ adults: 24, mealPlan: "CP" }));
    expect(q.json.data.capacityWarning).toMatch(/extra person/);
    expect(q.json.data.mealPlanTotal).toBeGreaterThan(0);
  });
});

describe("reserve rooms with an advance", () => {
  let groupId = "";
  let primaryId = "";

  it("creates one confirmed booking per room — no room numbers yet — and takes the advance", async () => {
    const r = await call("POST", "/api/advances/bookings", form());
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    groupId = r.json.data.groupId;
    primaryId = r.json.data.primaryBookingId;
    expect(r.json.data).toMatchObject({ rooms: 10, roundedTotal: 15000, balance: 11000, advance: { amount: 4000, method: "CASH" } });
    expect(r.json.data.bookingNumber).toMatch(/^RES-\d{4}-\d{3}$/);

    const rooms = await bookingsOf(groupId);
    expect(rooms).toHaveLength(10);
    expect(rooms.every((b) => b.status === "CONFIRMED" && !b.assignedRoom && b.bookingType === "GROUP")).toBe(true);
    expect(rooms.reduce((t, b) => t + b.adults, 0)).toBe(20);
    expect(rooms.every((b) => b.adults === 2)).toBe(true);
    expect(rooms[0].guestDetails).toMatchObject({ firstName: "Murthy", lastName: "L", gstin: "29AFAFS2437J1ZS", phone });
    expect(rooms[0].guestDetails.address).toMatch(/Kaveri Sankirana/);
    expect(rooms[0]).toMatchObject({ arrivalTime: "14:00", departureTime: "12:00", mealPlan: "EP", ratePerNight: 1500, pricesIncludeTax: true });
    expect(rooms.reduce((t, b) => t + b.totalAmount, 0)).toBeCloseTo(15000, 1);
    expect(rooms[0]).toMatchObject({ paidAmount: 4000, paymentStatus: "PARTIAL" });
    expect(rooms[1]).toMatchObject({ paidAmount: 0, paymentStatus: "UNPAID" });

    const advances: any[] = await db().collection("advancepayments").find({ booking: { $in: rooms.map((b) => b._id) } }).toArray();
    expect(advances).toHaveLength(1);
    expect(advances[0]).toMatchObject({ amount: 4000, remainingBalance: 4000, method: "CASH", status: "RECEIVED" });
    expect(String(advances[0].booking)).toBe(primaryId);

    const day: any = await db().collection("bookinginventorydays").findOne({ roomCategory: category, stayDate: new Date(night(40).checkIn) });
    expect(day.reservedCount).toBe(10);
    expect(await db().collection("guests").countDocuments({ email: `murthy-${tag}@example.com` })).toBe(1);
  });

  it("the same submit sent twice (double click / retry) books once", async () => {
    const body = form({ ...night(60), clientRequestId: `dup-${tag}-abcdefghij` });
    const a = await call("POST", "/api/advances/bookings", body);
    const b = await call("POST", "/api/advances/bookings", body);
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.json.data.duplicate).toBe(true);
    expect(b.json.data.primaryBookingId).toBe(a.json.data.primaryBookingId);
    expect((await bookingsOf(a.json.data.groupId))).toHaveLength(10);
    expect(await db().collection("advancepayments").countDocuments({ booking: new mongoose.Types.ObjectId(a.json.data.primaryBookingId) })).toBe(1);
    // …and the same request id with different details is refused, not silently accepted
    const changed = await call("POST", "/api/advances/bookings", { ...body, rooms: 5, adults: 10 });
    expect(changed.status).toBe(409);
  });

  it("two simultaneous submits of the same request book once", async () => {
    const body = form({ ...night(70), clientRequestId: `race-${tag}-abcdefghij` });
    const [a, b] = await Promise.all([call("POST", "/api/advances/bookings", body), call("POST", "/api/advances/bookings", body)]);
    // One of them books; the other is told "already saved" (200) or "being saved" (409) — never a second booking.
    expect([a.status, b.status].filter((x) => x === 201)).toHaveLength(1);
    expect([a.status, b.status].every((x) => [200, 201, 409].includes(x))).toBe(true);
    const ok = [a, b].find((x) => x.status === 201)!;
    expect((await bookingsOf(ok.json.data.groupId))).toHaveLength(10);
    expect(await db().collection("bookings").countDocuments({ roomCategory: category, checkInDate: new Date(night(70).checkIn) })).toBe(10);
  });

  it("sold-out dates are refused with a clear message; nothing is held", async () => {
    const r = await call("POST", "/api/advances/bookings", form({ rooms: 1, adults: 1, advance: { amount: 0 }, clientRequestId: `full-${tag}-abcdefghij` }));
    expect(r.status).toBe(409);
    expect(r.json.message).toMatch(/Only 0 .* free/);
    const q = await call("POST", "/api/advances/bookings/quote", form({ rooms: 1, adults: 1 }));
    expect(q.json.data).toMatchObject({ availableRooms: 0, canBook: false });
  });

  it("cancelling one room frees exactly that room", async () => {
    const rooms = await bookingsOf(groupId);
    const last = rooms[rooms.length - 1];
    const c = await call("POST", `/api/bookings/${last._id}/cancel`, { reason: "Group is one room smaller" });
    expect(c.status, JSON.stringify(c.json)).toBe(200);
    const q = await call("POST", "/api/advances/bookings/quote", form({ rooms: 1, adults: 1 }));
    expect(q.json.data.availableRooms).toBe(1);
  });

  it("the Booking Confirmation shows the real numbers", async () => {
    const r = await call("GET", `/api/advances/bookings/${primaryId}/confirmation`);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const d = r.json.data;
    expect(d.customer).toMatchObject({ name: "Murthy L", phone, gstin: "29AFAFS2437J1ZS" });
    expect(d.customer.address).toMatch(/Bengaluru-560 030/);
    expect(d.booking).toMatchObject({ arrivalDate: night(40).checkIn, departureDate: night(40).checkOut, arrivalTime: "14:00", departureTime: "12:00", nights: 1 });
    expect(d.item).toMatchObject({ rooms: 9, adults: 18, sac: "996311" }); // one room was cancelled above
    expect(d.item.description).toMatch(/^Deluxe .* - EP$/);
    expect(d.advance.paid).toBe(4000);
    expect(d.amounts.total).toBeCloseTo(13500, 1);
    expect(d.balance).toBeCloseTo(9500, 1);
    expect(d.hotel.gstin).toBe("29AFAFS2437J1ZS");
    // asking from any room of the group gives the same document
    const rooms = await bookingsOf(groupId);
    expect((await call("GET", `/api/advances/bookings/${rooms[3]._id}/confirmation`)).json.data.booking.number).toBe(d.booking.number);
  });

  it("every room's bill can draw from the group's advance (not just the first room)", async () => {
    const rooms = await bookingsOf(groupId);
    const second = rooms[1];
    const { createFolio, postCharge } = await import("../services/folio.service");
    const folio: any = await createFolio({ bookingId: String(second._id), guestId: String(oid()), checkInDate: second.checkInDate, checkOutDate: second.checkOutDate } as any, {});
    await postCharge({ folioId: String(folio._id), bookingId: String(second._id), lineType: "ROOM_CHARGE" as any, description: "Room", amount: 1500, date: new Date(), postedBy: "test" }, {});
    const { applyAdvancesToFolio } = await import("../services/advance.service");
    const applied = await applyAdvancesToFolio({ bookingId: String(second._id), folioId: String(folio._id), maxAmount: Number.MAX_SAFE_INTEGER, performedBy: String(reception) }, {});
    expect(applied).toBe(1500);
    const adv: any = await db().collection("advancepayments").findOne({ booking: new mongoose.Types.ObjectId(primaryId) });
    expect(adv.remainingBalance).toBe(2500);
  });
});

describe("input checks", () => {
  const refused = async (extra: Record<string, unknown>, pattern: RegExp, status = 400) => {
    const r = await call("POST", "/api/advances/bookings", form({ ...night(80), clientRequestId: `bad-${tag}-${++n}-abcdefgh`, ...extra }));
    expect(r.status, JSON.stringify(r.json)).toBe(status);
    expect(r.json.message).toMatch(pattern);
  };
  it("refuses clearly wrong requests", async () => {
    await refused({ guest: { name: "", phone } }, /guest's name/);
    await refused({ guest: { name: "Abc", phone: "12" } }, /mobile number/);
    await refused({ guest: { name: "Abc", phone, gstin: "NOTAGSTIN" } }, /GSTIN/);
    await refused({ adults: 4 }, /at least one adult/); // 10 rooms, 4 adults
    await refused({ checkIn: addDays(today, -1), checkOut: today }, /past/);
    await refused({ ...night(80), checkOut: night(80).checkIn }, /after check-in/);
    await refused({ advance: { amount: 99999, paymentChannelId: String(cashChannel) } }, /more than the booking total/);
    await refused({ advance: { amount: 100 } }, /payment channel/i);
    await refused({ ratePerNight: 0 }, /greater than zero/);
    await refused({ rooms: 0 }, /Rooms must be/);
    await refused({ clientRequestId: "x" }, /request id/);
  });

  it("a reservation without an advance is allowed (no money recorded)", async () => {
    const r = await call("POST", "/api/advances/bookings", form({ ...night(85), rooms: 1, adults: 2, advance: { amount: 0 }, clientRequestId: `noadv-${tag}-abcdefghij` }));
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.data.advance).toBeNull();
    expect(r.json.data.balance).toBe(1500);
  });

  it("a rate below the room type's goes to Reception's verification queue", async () => {
    const r = await call("POST", "/api/advances/bookings", form({ ...night(90), rooms: 2, adults: 4, ratePerNight: 1200, advance: { amount: 500, paymentChannelId: String(cashChannel) }, clientRequestId: `low-${tag}-abcdefghij` }));
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const v: any = await db().collection("verificationrequests").findOne({ subjectKey: `advanceBooking:${r.json.data.primaryBookingId}:tariff` });
    expect(v).toBeTruthy();
    expect(v.type).toBe("TARIFF_BELOW_DEFAULT");
  });
});

describe("arrival day", () => {
  it("reserved guests appear in Arrivals with no room; the desk assigns rooms, checks them in, and the advance covers the bill", async () => {
    const r = await call("POST", "/api/advances/bookings", form({ ...night(0), rooms: 2, adults: 4, advance: { amount: 1000, paymentChannelId: String(cashChannel) }, clientRequestId: `arr-${tag}-abcdefghij` }));
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const ids: string[] = r.json.data.bookings.map((b: any) => b.id);

    const sum = await call("GET", "/api/front-desk/summary");
    expect(sum.status).toBe(200);
    const arrivals: any[] = sum.json.data.todaysArrivals.filter((b: any) => ids.includes(String(b._id)));
    expect(arrivals).toHaveLength(2);
    expect(arrivals.every((b) => !b.assignedRoom)).toBe(true);
    expect(sum.json.data.unassignedBookings.filter((b: any) => ids.includes(String(b._id)))).toHaveLength(2);

    const rooms: any[] = await db().collection("rooms").find({ category }).sort({ roomNumber: 1 }).limit(2).toArray();
    for (const [i, id] of ids.entries()) {
      // what the Front Desk check-in window sends: the room picked at the desk
      const ci = await call("POST", `/api/bookings/${id}/check-in`, { roomId: String(rooms[i]._id), idType: "AADHAAR", idNumber: "123412341234", notes: "In-line Front Desk Check-In" });
      expect(ci.status, JSON.stringify(ci.json)).toBe(200);
    }
    const inHouse: any[] = await db().collection("bookings").find({ _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } }).toArray();
    expect(inHouse.every((b) => b.status === "CHECKED_IN" && b.assignedRoom)).toBe(true);

    // billing: the first room's bill takes the advance; the group's advance is shared, nothing is lost or doubled
    const folios: any[] = await db().collection("folios").find({ booking: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } }).toArray();
    expect(folios).toHaveLength(2);
    let applied = 0;
    for (const f of folios) {
      const a = await call("POST", `/api/reception/folios/${f._id}/apply-advances`, {});
      expect(a.status, JSON.stringify(a.json)).toBe(200);
      applied += a.json.data.applied;
    }
    expect(applied).toBe(1000);
    const adv: any = await db().collection("advancepayments").findOne({ booking: new mongoose.Types.ObjectId(ids[0]) });
    expect(adv).toMatchObject({ remainingBalance: 0, totalAdjusted: 1000, status: "FULLY_ADJUSTED" });
  });
});
