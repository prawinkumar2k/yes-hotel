/**
 * In-house room move by Reception: 3 nights at ₹2,000 charged at check-in; on night 2 the guest
 * moves to a ₹3,000 room. The 2 remaining (already charged) nights add ₹2,000 + ₹100 GST; the old
 * room goes to housekeeping (VACANT, DIRTY, task), the new room is OCCUPIED, room-nights move.
 * A dirty / occupied room is refused; Housekeeping can't move guests.
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
const users = { reception: oid(), housekeeping: oid() };
const ids = { std: oid(), dlx: oid(), oldRoom: oid(), newRoom: oid(), dirtyRoom: oid(), booking: oid(), folio: oid(), guest: oid() };
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = (who: "reception" | "housekeeping") => jwt.sign({ id: String(users[who]), role: who === "reception" ? "RECEPTIONIST" : "HOUSEKEEPING" }, getJwtSecret(), { expiresIn: "5m" });
const today = todayBusinessDate();
const day = (d: string) => new Date(`${d}T00:00:00+05:30`);

async function call(who: "reception" | "housekeeping", method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok(who)}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const balance = async () => (await call("reception", "GET", "/api/reception/billing-queue?all=true")).json.data.find((r: any) => r.bookingId === String(ids.booking))?.balance;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  const u = (_id: mongoose.Types.ObjectId, role: string) => ({ _id, role, firstName: "Rm", lastName: role, email: `rm-${role.toLowerCase()}-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("users").insertMany([u(users.reception, "RECEPTIONIST"), u(users.housekeeping, "HOUSEKEEPING")]);
  const cat = (_id: mongoose.Types.ObjectId, n: string, price: number) => ({ _id, slug: `rm-${n}-${tag}`, name: `Rm ${n} ${tag}`, description: "test", basePrice: price, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("roomcategories").insertMany([cat(ids.std, "std", 2000), cat(ids.dlx, "dlx", 3000)]);
  const room = (_id: mongoose.Types.ObjectId, n: string, category: mongoose.Types.ObjectId, extra: Record<string, unknown>) => ({ _id, propertyId: P, roomNumber: `${n}${tag}`, category, floor: "9", sellStatus: "SELLABLE", ...extra });
  await db().collection("rooms").insertMany([
    room(ids.oldRoom, "O", ids.std, { status: "OCCUPIED", occupancyStatus: "OCCUPIED", housekeepingStatus: "CLEAN", currentBooking: ids.booking }),
    room(ids.newRoom, "N", ids.dlx, { status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN" }),
    room(ids.dirtyRoom, "D", ids.dlx, { status: "CLEANING", occupancyStatus: "VACANT", housekeepingStatus: "DIRTY" }),
  ]);
  const now = new Date();
  await db().collection("bookings").insertOne({
    _id: ids.booking, propertyId: P, bookingReference: `RM-${tag}`, source: "DIRECT_WEBSITE", status: "CHECKED_IN",
    guestDetails: { firstName: "Move", lastName: "Guest", email: `rm-${tag}@test.local`, phone: "9000000066" },
    roomCategory: ids.std, assignedRoom: ids.oldRoom, checkInDate: day(addDays(today, -1)), checkOutDate: day(addDays(today, 2)),
    adults: 1, children: 0, ratePerNight: 2000, totalAmount: 6300, taxAmount: 300, cgstAmount: 150, sgstAmount: 150, paidAmount: 0, paymentStatus: "UNPAID",
    checkedInAt: day(addDays(today, -1)), createdAt: now, updatedAt: now,
  });
  await db().collection("roomnights").insertMany([addDays(today, -1), today, addDays(today, 1)].map((date) => ({ room: ids.oldRoom, date, booking: ids.booking, propertyId: P, status: "HELD" })));
  await db().collection("folios").insertOne({ _id: ids.folio, propertyId: P, booking: ids.booking, guest: ids.guest, room: ids.oldRoom, checkInDate: now, checkOutDate: now, status: "OPEN", totalCharges: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
  await db().collection("foliolines").insertMany([
    { folio: ids.folio, booking: ids.booking, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff (3 nights)", amount: 6000, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_CGST", direction: "DEBIT", description: "CGST", amount: 150, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_SGST", direction: "DEBIT", description: "SGST", amount: 150, date: now, postedAt: now, postedBy: "test" },
  ]);
});

afterAll(async () => {
  const f = { booking: ids.booking };
  await db().collection("foliolines").deleteMany(f);
  await db().collection("folios").deleteMany(f);
  await db().collection("roomnights").deleteMany(f);
  await db().collection("housekeepingtasks").deleteMany({ room: { $in: [ids.oldRoom, ids.newRoom, ids.dirtyRoom] } });
  await db().collection("bookings").deleteMany({ _id: ids.booking });
  await db().collection("rooms").deleteMany({ _id: { $in: [ids.oldRoom, ids.newRoom, ids.dirtyRoom] } });
  await db().collection("roomcategories").deleteMany({ _id: { $in: [ids.std, ids.dlx] } });
  await db().collection("users").deleteMany({ _id: { $in: Object.values(users) } });
  await new Promise((r) => server.close(r));
});

describe("Room move", () => {
  it("refuses a dirty room and refuses Housekeeping", async () => {
    expect((await call("reception", "POST", `/api/front-desk/bookings/${ids.booking}/move-room`, { roomId: String(ids.dirtyRoom), rateMode: "KEEP" })).status).toBe(409);
    expect((await call("housekeeping", "POST", `/api/front-desk/bookings/${ids.booking}/move-room`, { roomId: String(ids.newRoom), rateMode: "KEEP" })).status).toBe(403);
  });

  it("Reception moves the guest to a dearer room; the bill adds the difference for charged nights", async () => {
    expect(await balance()).toBe(6300);
    const r = await call("reception", "POST", `/api/front-desk/bookings/${ids.booking}/move-room`, { roomId: String(ids.newRoom), rateMode: "NEW", newRatePerNight: 3000, reason: "Upgrade" });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ nightsMoved: 2, rateDifference: 2000 });
    expect(await balance()).toBe(8400);
    const b = await db().collection("bookings").findOne({ _id: ids.booking });
    expect(String(b!.assignedRoom)).toBe(String(ids.newRoom));
    expect(b).toMatchObject({ ratePerNight: 3000, totalAmount: 8400 });
  });

  it("the old room goes to housekeeping; the new room is occupied; nights moved", async () => {
    const oldRoom = await db().collection("rooms").findOne({ _id: ids.oldRoom });
    const newRoom = await db().collection("rooms").findOne({ _id: ids.newRoom });
    expect(oldRoom).toMatchObject({ occupancyStatus: "VACANT" });
    expect(["DIRTY", "ASSIGNED"]).toContain(oldRoom!.housekeepingStatus); // assigned automatically when a housekeeper is free
    expect(newRoom).toMatchObject({ occupancyStatus: "OCCUPIED" });
    expect(await db().collection("housekeepingtasks").countDocuments({ room: ids.oldRoom })).toBe(1);
    expect(await db().collection("roomnights").countDocuments({ booking: ids.booking, room: ids.newRoom })).toBe(2);
    expect(await db().collection("roomnights").countDocuments({ booking: ids.booking, room: ids.oldRoom })).toBe(1);
  });
});
