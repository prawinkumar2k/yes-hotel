/**
 * Monthly MIS and the MIS daily sheet: every kind of money and every count shows on the right day,
 * and both pages agree (one calculation).
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
const P = oid(); // own property: the figures below are exactly this hotel's
const user = oid();
const cat = oid();
const today = todayBusinessDate();
const month = today.slice(0, 7);
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const get = async (path: string) => {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${jwt.sign({ id: String(user), role: "MANAGER" }, getJwtSecret(), { expiresIn: "5m" })}` } });
  return { status: r.status, json: (await r.json()) as any };
};
const dayRow = (days: any[]) => days.find((d) => d.date === today);
const ids = { ota: oid(), walk: oid(), out: oid(), folio: oid(), shift: oid() };

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  await db().collection("properties").insertOne({ _id: P, code: `MIS-${tag}`, name: `MIS ${tag}`, isActive: true });
  await db().collection("users").insertOne({ _id: user, role: "MANAGER", firstName: "Mis", lastName: tag, email: `mis-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  const now = new Date();
  const b = (key: keyof typeof ids, extra: Record<string, unknown>) => db().collection("bookings").insertOne({
    _id: ids[key], bookingReference: `MIS-${tag}-${key}`, propertyId: P, roomCategory: cat, guestDetails: { firstName: key, lastName: tag, phone: "9000000000" },
    adults: 2, children: 1, totalAmount: 2000, taxAmount: 100, status: "CHECKED_IN", checkInDate: new Date(today), checkOutDate: new Date(addDays(today, 1)), ...extra,
  });
  await b("ota", { source: "OTA", otaName: "MakeMyTrip", otaPaymentModel: "OTA_PREPAID", otaReceivable: 1700, checkedInAt: now });
  await b("walk", { source: "WALK_IN", checkedInAt: now });
  await b("out", { source: "PHONE", status: "CHECKED_OUT", checkedInAt: new Date(now.getTime() - 864e5), checkedOutAt: now, checkInDate: new Date(addDays(today, -1)), checkOutDate: new Date(today) });
  await db().collection("advancepayments").insertOne({ _id: oid(), propertyId: P, advanceNumber: `ADV-MIS-${tag}`, amount: 1000, method: "CASH", status: "RECEIVED", receivedAt: now, createdAt: now, totalAdjusted: 0, totalRefunded: 0 });
  await db().collection("payments").insertOne({ _id: oid(), propertyId: P, booking: ids.walk, amount: 500, method: "UPI", status: "COMPLETED", purpose: "SETTLEMENT", createdAt: now });
  await db().collection("cashiershifts").insertOne({
    _id: ids.shift, propertyId: P, shiftNumber: `MIS-${tag}`, drawerId: `D-${tag}`, cashier: user, status: "OPEN", businessDate: new Date(today), openedAt: now, openingFloat: 0,
    counterSales: [
      { category: "WATER_BOTTLE", description: "Water bottle", quantity: 1, amount: 20, mode: "CASH", createdAt: now },
      { category: "KOVAI_KONGU_MESS", description: "Mess", quantity: 1, amount: 100, mode: "UPI", createdAt: now },
    ],
    paidOuts: [{ category: "PETTY_CASH", description: "Tea", amount: 50, createdAt: now }], totalPaidOut: 50, totalCounterSales: 120,
  });
  await db().collection("folios").insertOne({ _id: ids.folio, booking: ids.walk, status: "OPEN", totalCharges: 0 });
  await db().collection("foliolines").insertOne({ _id: oid(), folio: ids.folio, booking: ids.walk, lineType: "ROOM_CHARGE", direction: "DEBIT", description: `Room ${tag}`, amount: 1500, date: new Date(today), postedAt: now, postedBy: "T", coversNights: [today] });
});

afterAll(async () => {
  await db().collection("foliolines").deleteMany({ folio: ids.folio });
  await db().collection("folios").deleteMany({ _id: ids.folio });
  await db().collection("bookings").deleteMany({ propertyId: P });
  for (const c of ["advancepayments", "payments", "cashiershifts"]) await db().collection(c).deleteMany({ propertyId: P });
  await db().collection("users").deleteMany({ _id: user });
  await db().collection("properties").deleteMany({ _id: P });
  await new Promise((r) => server.close(r));
});

describe("MIS daily sheet and Monthly MIS", () => {
  it("rooms, who booked and money by mode are counted on the day", async () => {
    const r = await get(`/api/reports/mis-sheet?month=${month}`);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const d = dayRow(r.json.data.days);
    expect(d).toMatchObject({ checkIns: 2, checkOuts: 1, ota: 1, walkin: 1, otaMmt: 1, otaPayment: 1700, occupancyRooms: 2, occupancyPax: 6 });
    // advance cash 1000 + water 20 (cash); UPI payment 500; mess 100 is its own column
    expect(d).toMatchObject({ cash: 1020, upi: 500, kkm: 100, recAdvance: 1000, recFinal: 500, recTotal: 1500, expenses: 50 });
    expect(d.modeTotal).toBe(1020 + 500 + 100 + 1700);
    expect(d.rsWater).toBe(20);
    expect(d.roomSales).toBeGreaterThanOrEqual(1500);
    expect(d.misc).toBeGreaterThanOrEqual(120); // counter sales are miscellaneous sales
  });

  it("the Monthly MIS grid shows the same money (advances are no longer missing from the cash and UPI columns)", async () => {
    const r = await get(`/api/reports/monthly-mis?month=${month}`);
    expect(r.status).toBe(200);
    const d = dayRow(r.json.data);
    expect(d).toMatchObject({ cash: 1020, upi: 500, kkm: 100, ota: 1700, advances: 1000, rsWater: 20, expenses: 50, dayTotal: 3320 });
    expect(d.grandTotal).toBe(3270);
  });

  it("the sheet returns every day of the month and a totals row", async () => {
    const r = await get(`/api/reports/mis-sheet?month=${month}`);
    const days = r.json.data.days;
    expect(days.length).toBe(Number(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()));
    expect(r.json.data.totals.cash).toBeGreaterThanOrEqual(1020);
    expect(r.json.data.totals.cash).toBe(Math.round(days.reduce((t: number, x: any) => t + x.cash, 0) * 100) / 100);
  });
});
