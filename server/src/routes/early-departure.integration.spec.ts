/**
 * Early departure: 3 nights booked and charged at check-in (₹2,000/night + 5% GST); the guest
 * leaves after 1 night. Sending to billing credits the 2 unused nights and their GST, the bill and
 * booking show 1 night (₹2,100), a second send credits nothing more, and checkout settles at ₹2,100.
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
const ids = { category: oid(), room: oid(), booking: oid(), folio: oid(), guest: oid() };
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const today = todayBusinessDate();
const day = (d: string) => new Date(`${d}T00:00:00+05:30`);

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const balance = async () => (await call("GET", "/api/reception/billing-queue?all=true")).json.data.find((r: any) => r.bookingId === String(ids.booking))?.balance;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Ed", lastName: "Rcp", email: `ed-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: ids.category, slug: `ed-${tag}`, name: `Ed ${tag}`, description: "test", basePrice: 2000, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("rooms").insertOne({ _id: ids.room, propertyId: P, roomNumber: `E${tag}`, category: ids.category, floor: "9", status: "OCCUPIED", occupancyStatus: "OCCUPIED", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", currentBooking: ids.booking });
  const now = new Date();
  await db().collection("bookings").insertOne({
    _id: ids.booking, propertyId: P, bookingReference: `ED-${tag}`, source: "DIRECT_WEBSITE", status: "CHECKED_IN",
    guestDetails: { firstName: "Early", lastName: "Guest", email: `ed-${tag}@test.local`, phone: "9000000055" },
    roomCategory: ids.category, assignedRoom: ids.room, checkInDate: day(addDays(today, -1)), checkOutDate: day(addDays(today, 2)),
    adults: 1, children: 0, ratePerNight: 2000, totalAmount: 6300, taxAmount: 300, cgstAmount: 150, sgstAmount: 150, paidAmount: 0, paymentStatus: "UNPAID",
    checkedInAt: day(addDays(today, -1)), createdAt: now, updatedAt: now,
  });
  await db().collection("folios").insertOne({ _id: ids.folio, propertyId: P, booking: ids.booking, guest: ids.guest, room: ids.room, checkInDate: now, checkOutDate: now, status: "OPEN", totalCharges: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
  await db().collection("foliolines").insertMany([
    { folio: ids.folio, booking: ids.booking, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff (3 nights)", amount: 6000, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_CGST", direction: "DEBIT", description: "CGST", amount: 150, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_SGST", direction: "DEBIT", description: "SGST", amount: 150, date: now, postedAt: now, postedBy: "test" },
  ]);
});

afterAll(async () => {
  const f = { booking: ids.booking };
  await db().collection("verificationrequests").deleteMany(f);
  await db().collection("foliolines").deleteMany(f);
  await db().collection("folios").deleteMany(f);
  await db().collection("payments").deleteMany(f);
  await db().collection("roomnights").deleteMany(f);
  await db().collection("housekeepingtasks").deleteMany({ room: ids.room });
  await db().collection("bookings").deleteMany({ _id: ids.booking });
  await db().collection("rooms").deleteMany({ _id: ids.room });
  await db().collection("roomcategories").deleteMany({ _id: ids.category });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("Early departure", () => {
  it("credits the unused nights and their GST when sent to billing", async () => {
    expect(await balance()).toBe(6300);
    const r = await call("POST", `/api/reception/bookings/${ids.booking}/checkout/initiate`, {});
    expect(r.status).toBe(200);
    expect(r.json.earlyDeparture.nightsCredited).toEqual([today, addDays(today, 1)]);
    expect(r.json.earlyDeparture.roomCredit).toBe(4000);
    expect(await balance()).toBe(2100);
    const b = await db().collection("bookings").findOne({ _id: ids.booking });
    expect(b).toMatchObject({ totalAmount: 2100, taxAmount: 100 });
  });

  it("never credits the same nights twice", async () => {
    const { applyEarlyDeparture } = await import("../services/early-departure.service");
    await applyEarlyDeparture(String(ids.booking));
    expect(await db().collection("foliolines").countDocuments({ booking: ids.booking, lineType: "REVERSAL" })).toBe(3);
    expect(await balance()).toBe(2100);
  });

  it("checks out at the corrected amount with a GST invoice", async () => {
    expect((await call("POST", `/api/reception/folios/${ids.folio}/payments`, { amount: 2100, method: "CASH", clientRequestId: `ed-${tag}` })).status).toBe(201);
    expect((await call("POST", `/api/bookings/${ids.booking}/check-out`, {})).status).toBe(200);
    const folio = await db().collection("folios").findOne({ _id: ids.folio });
    expect(folio!.invoiceNumber).toBeTruthy();
    expect(folio!.balance).toBe(0);
  });
});
