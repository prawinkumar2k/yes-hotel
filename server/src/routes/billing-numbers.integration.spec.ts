/**
 * Bills follow the stay, and bill numbers appear only at checkout:
 *
 *   in-house stay at an agreed ₹2,500/night (category list price ₹4,000)
 *   → extend by one night → the bill gets ₹2,500 + GST for exactly that night (not the list price)
 *   → no bill number and no invoice number while in-house
 *   → pay the balance and check out → bill number BILL-YYYY-NNNNNN and the GST invoice number issued.
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
const day = (d: string) => new Date(`${d}T00:00:00+05:30`);
const today = todayBusinessDate();

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Bn", lastName: "Rcp", email: `bn-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: ids.category, slug: `bn-${tag}`, name: `Bn ${tag}`, description: "test", basePrice: 4000, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("rooms").insertOne({ _id: ids.room, propertyId: P, roomNumber: `B${tag}`, category: ids.category, floor: "9", status: "OCCUPIED", occupancyStatus: "OCCUPIED", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", currentBooking: ids.booking });
  const now = new Date();
  await db().collection("bookings").insertOne({
    _id: ids.booking, propertyId: P, bookingReference: `BN-${tag}`, source: "WALK_IN", status: "CHECKED_IN",
    guestDetails: { firstName: "Bill", lastName: "Guest", email: `bn-${tag}@test.local`, phone: "9000000088" },
    roomCategory: ids.category, assignedRoom: ids.room, checkInDate: day(addDays(today, -1)), checkOutDate: day(today),
    adults: 1, children: 0, ratePerNight: 2500, totalAmount: 2625, taxAmount: 125, cgstAmount: 62.5, sgstAmount: 62.5, paidAmount: 0, paymentStatus: "UNPAID",
    checkedInAt: day(addDays(today, -1)), createdAt: now, updatedAt: now,
  });
  await db().collection("folios").insertOne({ _id: ids.folio, propertyId: P, booking: ids.booking, guest: ids.guest, room: ids.room, checkInDate: now, checkOutDate: now, status: "OPEN", totalCharges: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
  await db().collection("foliolines").insertMany([
    { folio: ids.folio, booking: ids.booking, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff (1 night)", amount: 2500, coversNights: [addDays(today, -1)], date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_CGST", direction: "DEBIT", description: "CGST", amount: 62.5, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_SGST", direction: "DEBIT", description: "SGST", amount: 62.5, date: now, postedAt: now, postedBy: "test" },
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
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: ids.category });
  await db().collection("bookings").deleteMany({ _id: ids.booking });
  await db().collection("rooms").deleteMany({ _id: ids.room });
  await db().collection("roomcategories").deleteMany({ _id: ids.category });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("Bills follow the stay; numbers only at checkout", () => {
  it("extending the stay adds the extra night to the bill at the agreed rate", async () => {
    const r = await call("POST", `/api/bookings/${ids.booking}/extend`, { newCheckOutDate: addDays(today, 1) });
    expect(r.status).toBe(200);
    const ext = await db().collection("foliolines").findOne({ folio: ids.folio, lineType: "ROOM_CHARGE", description: /Extension/ });
    expect(ext).toMatchObject({ amount: 2500, coversNights: [today] });
    const b = await db().collection("bookings").findOne({ _id: ids.booking });
    expect(b!.totalAmount).toBe(5250);
  });

  it("has no bill number or invoice number while the guest is in-house", async () => {
    expect((await db().collection("bookings").findOne({ _id: ids.booking }))!.billNumber).toBeUndefined();
    expect((await db().collection("folios").findOne({ _id: ids.folio }))!.invoiceNumber).toBeUndefined();
  });

  it("issues the bill number and the invoice number at checkout", async () => {
    // The guest leaves early on the extended night: checkout settles exactly what the bill says.
    const due = (await call("GET", "/api/reception/billing-queue?all=true")).json.data.find((x: any) => x.bookingId === String(ids.booking)).balance;
    expect(due).toBe(5250);
    expect((await call("POST", `/api/reception/folios/${ids.folio}/payments`, { amount: due, method: "CASH", clientRequestId: `bn-${tag}` })).status).toBe(201);
    const out = await call("POST", `/api/bookings/${ids.booking}/check-out`, {});
    expect(out.status).toBe(200);
    const b = await db().collection("bookings").findOne({ _id: ids.booking });
    expect(b!.billNumber).toMatch(new RegExp(`^BILL-${today.slice(0, 4)}-\\d{6}$`));
    expect((await db().collection("folios").findOne({ _id: ids.folio }))!.invoiceNumber).toBeTruthy();
  });
});
