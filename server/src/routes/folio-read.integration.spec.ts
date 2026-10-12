/**
 * Folio reads are side-effect free; opening a folio is an explicit, idempotent action.
 * Real app (createServer) over HTTP against the test DB.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { openFolioForBooking } from "../services/folio.service";

const oid = () => new mongoose.Types.ObjectId();
const ids = {
  property: oid(),
  manager: oid(),
  customer: oid(),
  withFolio: oid(),
  withoutFolio: oid(),
  toOpen: oid(),
  folio: oid(),
  payment: oid(),
  openPayment: oid(),
};

let server: Server;
let base = "";
const token = (id: mongoose.Types.ObjectId, role: string) =>
  jwt.sign({ id: String(id), role }, getJwtSecret(), { expiresIn: "5m" });
const get = (path: string, id: mongoose.Types.ObjectId, role: string) =>
  fetch(base + path, { headers: { Authorization: `Bearer ${token(id, role)}` } }).then((r) => r.status);

const db = () => mongoose.connection.db!;
const bookingIds = [ids.withFolio, ids.withoutFolio, ids.toOpen];
async function counts() {
  const [folios, lines, payments] = await Promise.all([
    db().collection("folios").countDocuments({ booking: { $in: bookingIds } }),
    db().collection("foliolines").countDocuments({ booking: { $in: bookingIds } }),
    db().collection("payments").countDocuments({ booking: { $in: bookingIds } }),
  ]);
  return { folios, lines, payments };
}

const booking = (_id: mongoose.Types.ObjectId, ref: string) => ({
  _id,
  propertyId: ids.property,
  bookingReference: `FOLIO-READ-${ref}-${_id}`,
  customer: ids.customer,
  status: "CHECKED_IN",
  checkInDate: new Date("2026-10-10T08:30:00Z"),
  checkOutDate: new Date("2026-10-12T05:30:00Z"),
  ratePerNight: 3000,
  totalAmount: 6300,
  taxAmount: 300,
  paidAmount: 9999, // deliberately unbacked: must never become a folio credit
});

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();

  await db().collection("users").insertMany([
    { _id: ids.manager, firstName: "Folio", lastName: "Manager", email: `folio-mgr-${ids.manager}@test.local`, passwordHash: "x", role: "MANAGER", isActive: true, propertyId: ids.property },
    { _id: ids.customer, firstName: "Folio", lastName: "Guest", email: `folio-guest-${ids.customer}@test.local`, passwordHash: "x", role: "CUSTOMER", isActive: true },
  ]);
  await db().collection("bookings").insertMany([booking(ids.withFolio, "A"), booking(ids.withoutFolio, "B"), booking(ids.toOpen, "C")]);
  await db().collection("folios").insertOne({
    _id: ids.folio, propertyId: ids.property, booking: ids.withFolio, guest: ids.customer,
    checkInDate: new Date("2026-10-10"), checkOutDate: new Date("2026-10-12"), status: "OPEN", balance: 0,
  });
  await db().collection("foliolines").insertOne({
    folio: ids.folio, booking: ids.withFolio, lineType: "ROOM_CHARGE", direction: "DEBIT",
    description: "Room Tariff", amount: 6000, date: new Date("2026-10-10"), postedAt: new Date(), postedBy: "test",
  });
  await db().collection("payments").insertMany([
    { _id: ids.payment, transactionId: `TXN-FR-${ids.payment}`, propertyId: ids.property, booking: ids.withFolio, amount: 2000, currency: "INR", method: "CASH", status: "COMPLETED", createdAt: new Date() },
    { _id: ids.openPayment, transactionId: `TXN-FR-${ids.openPayment}`, propertyId: ids.property, booking: ids.toOpen, amount: 5000, refundedAmount: 1000, currency: "INR", method: "UPI", status: "REFUNDED", createdAt: new Date() },
  ]);
});

afterAll(async () => {
  await db().collection("users").deleteMany({ _id: { $in: [ids.manager, ids.customer] } });
  await db().collection("foliolines").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("folios").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("payments").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("bookings").deleteMany({ _id: { $in: bookingIds } });
  await db().collection("auditlogs").deleteMany({ "metadata.bookingId": { $in: bookingIds.map(String) } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("folio reads never write", () => {
  it("opening the same folio 5 times (staff, checkout preview, customer) leaves folio, line and payment counts unchanged", async () => {
    const before = await counts();
    for (let i = 0; i < 5; i++) {
      expect(await get(`/api/folios/booking/${ids.withFolio}`, ids.manager, "MANAGER")).toBe(200);
      expect(await get(`/api/bookings/${ids.withFolio}/checkout-preview`, ids.manager, "MANAGER")).toBe(200);
      expect(await get(`/api/folios/booking/${ids.withFolio}`, ids.customer, "CUSTOMER")).toBe(200);
    }
    expect(await counts()).toEqual(before);
  });

  it("reading a booking that has no folio returns 404 and creates nothing", async () => {
    const before = await counts();
    for (let i = 0; i < 5; i++) {
      expect(await get(`/api/folios/booking/${ids.withoutFolio}`, ids.manager, "MANAGER")).toBe(404);
      expect(await get(`/api/bookings/${ids.withoutFolio}/checkout-preview`, ids.manager, "MANAGER")).toBe(200);
    }
    expect(await counts()).toEqual(before);
    expect(await db().collection("folios").countDocuments({ booking: ids.withoutFolio })).toBe(0);
  });
});

describe("openFolioForBooking (explicit action)", () => {
  it("is idempotent under concurrency: one folio, stay charges once, recorded payments once, nothing from paidAmount", async () => {
    const b = await db().collection("bookings").findOne({ _id: ids.toOpen });
    await Promise.all(Array.from({ length: 5 }, () => openFolioForBooking(b, "test")));
    await openFolioForBooking(b, "test"); // and once more afterwards

    expect(await db().collection("folios").countDocuments({ booking: ids.toOpen })).toBe(1);
    const lines = await db().collection("foliolines").find({ booking: ids.toOpen }).toArray();
    expect(lines.filter((l) => l.lineType === "ROOM_CHARGE")).toHaveLength(1);
    const credits = lines.filter((l) => l.direction === "CREDIT");
    expect(credits).toHaveLength(1);
    expect(String(credits[0].paymentId)).toBe(String(ids.openPayment));
    expect(credits[0].amount).toBe(4000); // net of the ₹1,000 refund
    expect(credits.some((l) => l.amount === 9999)).toBe(false);
  });
});
