/**
 * Cancelling a stay after check-in (Booking → Cancel Booking on a CHECKED_IN stay, walk-ins
 * included). It used to fail with "Cannot cancel a booking that is CHECKED_IN".
 *   - every charge and its GST is reversed; what the guest paid is returned to their advance and
 *     reported as due back (sent to Reception for verification);
 *   - an optional cancellation charge is billed with GST in its place;
 *   - the room is vacant and dirty with a cleaning task; its nights are free to sell again;
 *   - with nothing paid and nothing charged, the bill is VOIDED;
 *   - a reason is required; a guest can't cancel their own in-house stay.
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
const guestUser = oid();
const category = oid();
const rooms = [oid(), oid(), oid(), oid()];
let server: Server;
let base = "";
let settingsBefore: any = null;
const db = () => mongoose.connection.db!;
const today = todayBusinessDate();
const tok = (id = reception, role = "RECEPTIONIST") => jwt.sign({ id: String(id), role }, getJwtSecret(), { expiresIn: "5m" });
const call = async (method: string, path: string, body?: unknown, token = tok()) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const walkIn = async (room: mongoose.Types.ObjectId, extra: Record<string, unknown> = {}) => {
  const r = await call("POST", "/api/front-desk/registration/walk-in", {
    firstName: "Cancel", lastName: `Test ${tag}`, guestName: `Cancel Test ${tag}`, email: `cancel-${tag}@example.com`, mobile: "9000000088",
    idType: "AADHAAR", idNumber: "123412341234", checkIn: today, checkOut: addDays(today, 2), adults: 1,
    roomId: String(room), roomIds: [String(room)], roomRates: { [String(room)]: 1510 }, billingInstruction: "CASH", ...extra,
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  return String(r.json.data.booking._id);
};
const cancel = (id: string, body: Record<string, unknown>, token?: string) => call("POST", `/api/bookings/${id}/cancel`, body, token);
const folioOf = async (bookingId: string) => {
  const folio: any = await db().collection("folios").findOne({ booking: new mongoose.Types.ObjectId(bookingId) });
  const { computeFolioTotals } = await import("../services/folio-ledger");
  const lines = await db().collection("foliolines").find({ folio: folio._id }).toArray();
  return { folio, lines, totals: computeFolioTotals(lines as any) };
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
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: true } });
  await db().collection("users").insertMany([
    { _id: reception, role: "RECEPTIONIST", firstName: "Can", lastName: "Rcp", email: `cancel-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] },
    { _id: guestUser, role: "CUSTOMER", firstName: "Can", lastName: "Guest", email: `cancel-guest-${tag}@test.local`, passwordHash: "x", isActive: true },
  ]);
  await db().collection("roomcategories").insertOne({ _id: category, slug: `cancel-${tag}`, name: `Cancel ${tag}`, description: "test", basePrice: 1510, isActive: true, capacity: { adults: 2, children: 0 } });
  for (const [i, rid] of rooms.entries()) {
    await db().collection("rooms").insertOne({ _id: rid, propertyId: P, roomNumber: `CX${i}${tag}`, category, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
});

afterAll(async () => {
  await db().collection("hotelsettings").updateMany({}, { $set: { taxInclusiveRates: settingsBefore?.taxInclusiveRates ?? false } });
  const bIds = (await db().collection("bookings").find({ assignedRoom: { $in: rooms } }).project({ _id: 1 }).toArray()).map((b) => b._id);
  const advIds = (await db().collection("advancepayments").find({ booking: { $in: bIds } }).project({ _id: 1 }).toArray()).map((a) => a._id);
  await db().collection("advanceadjustments").deleteMany({ advancePayment: { $in: advIds } });
  await db().collection("advancepayments").deleteMany({ _id: { $in: advIds } });
  for (const c of ["folios", "foliolines", "roomnights", "verificationrequests"]) await db().collection(c).deleteMany({ booking: { $in: bIds } });
  await db().collection("verificationrequests").deleteMany({ bookingId: { $in: bIds } });
  await db().collection("housekeepingtasks").deleteMany({ room: { $in: rooms } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("guests").deleteMany({ email: `cancel-${tag}@example.com` });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: category });
  await db().collection("rooms").deleteMany({ _id: { $in: rooms } });
  await db().collection("roomcategories").deleteMany({ _id: category });
  await db().collection("users").deleteMany({ _id: { $in: [reception, guestUser] } });
  await new Promise((r) => server.close(r));
});

describe("cancelling a checked-in stay", () => {
  it("fully paid walk-in: bill reversed to zero, ₹3,020 due back, room to housekeeping, nights released", async () => {
    const id = await walkIn(rooms[0], { advanceAmount: 3020, advanceMethod: "UPI", advanceReference: `UPI${tag}` });
    expect((await bookingOf(id)).status).toBe("CHECKED_IN");

    const r = await cancel(id, { reason: "Guest left at once — family emergency" });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.cancellation.refundDue).toBe(3020);
    expect(r.json.message).toMatch(/₹3,020 is due back/);

    const b = await bookingOf(id);
    expect(b).toMatchObject({ status: "CANCELLED", cancellationReason: "Guest left at once — family emergency", cancellationPenalty: 0 });
    const f = await folioOf(id);
    expect(f.totals.totalCharges).toBe(0);
    expect(f.totals.totalTax).toBe(0);
    expect(f.totals.totalAdvanceAdjusted).toBe(0);
    expect(f.folio.status).toBe("OPEN"); // stays open so the money can be refunded
    const adv: any = await db().collection("advancepayments").findOne({ booking: new mongoose.Types.ObjectId(id) });
    expect(adv.remainingBalance).toBe(3020);

    const room: any = await db().collection("rooms").findOne({ _id: rooms[0] });
    expect(room).toMatchObject({ status: "CLEANING", occupancyStatus: "VACANT", housekeepingStatus: "DIRTY" });
    expect(room.currentBooking ?? null).toBeNull();
    expect(await db().collection("housekeepingtasks").countDocuments({ room: rooms[0] })).toBeGreaterThan(0);
    expect(await db().collection("roomnights").countDocuments({ booking: new mongoose.Types.ObjectId(id), status: "HELD" })).toBe(0);
  });

  it("a cancellation charge is billed with GST inside; the rest of the payment is due back", async () => {
    const id = await walkIn(rooms[1], { advanceAmount: 1000, advanceMethod: "CASH" });
    const r = await cancel(id, { reason: "Used the room for 3 hours", cancellationCharge: 525 });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.cancellation.refundDue).toBe(475);
    const f = await folioOf(id);
    expect(f.totals.totalCharges + f.totals.totalTax).toBeCloseTo(525, 2);
    expect(f.totals.cgst).toBe(12.5);
    expect(f.totals.sgst).toBe(12.5);
    expect(f.totals.balance).toBe(0); // paid from the guest's advance
    expect(f.folio.status).toBe("OPEN"); // ₹475 still to refund
    expect((await bookingOf(id)).cancellationPenalty).toBe(525);
  });

  it("nothing paid, nothing charged: the bill is VOIDED", async () => {
    const id = await walkIn(rooms[2]);
    const r = await cancel(id, { reason: "Checked in to the wrong booking" });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.cancellation.refundDue).toBe(0);
    expect((await folioOf(id)).folio.status).toBe("VOIDED");
  });

  it("needs a reason; a second cancel is refused; a guest can't cancel an in-house stay", async () => {
    const id = await walkIn(rooms[3]);
    expect((await cancel(id, { reason: "" })).status).toBe(400);
    expect((await bookingOf(id)).status).toBe("CHECKED_IN");

    await db().collection("bookings").updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { customer: guestUser } });
    const g = await cancel(id, { reason: "changed my mind" }, tok(guestUser, "CUSTOMER"));
    expect(g.status).toBe(400);
    expect((await bookingOf(id)).status).toBe("CHECKED_IN");

    expect((await cancel(id, { reason: "Duplicate check-in" })).status).toBe(200);
    expect((await cancel(id, { reason: "Duplicate check-in" })).status).toBe(400);
  });
});
