/**
 * Room service / counter sales (water bottle, dental kit, early check-in …) are income:
 *   a cash sale raises the drawer's expected cash; UPI/card need a reference and go to their totals;
 *   they can no longer be booked as paid-outs; the Monthly MIS shows them per item and in the totals.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { businessDayRange, todayBusinessDate } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const shiftId = oid();
const roomNo = `C${tag}`;
const roomId = oid();
const stayId = oid();
const folioId = oid();
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });

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
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Cs", lastName: "Rcp", email: `cs-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  // The guest in the room the sales go to: a checked-in booking with an open bill.
  await db().collection("rooms").insertOne({ _id: roomId, propertyId: P, roomNumber: roomNo, floor: "1", status: "OCCUPIED", occupancyStatus: "OCCUPIED", sellStatus: "SELLABLE" });
  await db().collection("bookings").insertOne({ _id: stayId, bookingReference: `CS-${tag}`, propertyId: P, status: "CHECKED_IN", assignedRoom: roomId, checkedInAt: new Date(), guestDetails: { firstName: "Counter", lastName: tag, phone: "9000000001" }, totalAmount: 0, taxAmount: 0 });
  await db().collection("folios").insertOne({ _id: folioId, booking: stayId, guest: oid(), room: roomId, status: "OPEN", propertyId: P, checkInDate: new Date(), checkOutDate: new Date(Date.now() + 864e5) });
  await db().collection("cashiershifts").insertOne({
    _id: shiftId, propertyId: P, shiftNumber: `CS-${tag}`, drawerId: `DRW-${tag}`, cashier: reception, status: "OPEN",
    businessDate: businessDayRange(todayBusinessDate()).start, openedAt: new Date(Date.now() - 60_000), openingFloat: 1000,
    paidOuts: [], counterSales: [], totalPaidOut: 0, totalCounterSales: 0,
  });
});

afterAll(async () => {
  await db().collection("foliolines").deleteMany({ folio: folioId });
  await db().collection("folios").deleteMany({ _id: folioId });
  await db().collection("bookings").deleteMany({ _id: stayId });
  await db().collection("rooms").deleteMany({ _id: roomId });
  await db().collection("cashiershifts").deleteMany({ _id: shiftId });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

const ledger = async () => (await call("GET", "/api/cashier-shifts/current")).json.data.liveLedger;

describe("Room service / counter sales", () => {
  it("the room number is required, and the room must have a guest checked in", async () => {
    const none = await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { category: "WATER_BOTTLE", amount: 20, mode: "CASH" });
    expect(none.status).toBe(400);
    expect(String(none.json.message)).toMatch(/room number/i);
    const empty = await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: `X${tag}`, category: "WATER_BOTTLE", amount: 20, mode: "CASH" });
    expect(empty.status).toBe(400);
    expect(String(empty.json.message)).toMatch(/no checked-in guest/i);
  });

  it("a sale is added to the room's bill: the item as a charge and the money taken as a payment, so the balance is unchanged", async () => {
    const r = await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: roomNo, category: "WATER_BOTTLE", quantity: 1, amount: 20, mode: "CARD", reference: "APPR-ROOM" });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const lines: any[] = await db().collection("foliolines").find({ folio: folioId }).toArray();
    const charge = lines.find((l) => l.direction === "DEBIT");
    const paid = lines.find((l) => l.lineType === "PAYMENT");
    expect(charge).toMatchObject({ lineType: "ADDON", amount: 20, notes: "item:WATER_BOTTLE", postedBy: "COUNTER_SALE" });
    expect(charge.description).toMatch(/Water bottle/i);
    expect(paid).toMatchObject({ direction: "CREDIT", amount: 20, postedBy: "COUNTER_SALE" });
    expect((await ledger()).expectedCard).toBe(20); // the drawer counts it once (from the shift), not again from the bill
  });

  it("a cash sale adds to the drawer", async () => {
    expect((await ledger()).expectedCash).toBe(1000);
    const r = await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: roomNo, category: "WATER_BOTTLE", quantity: 2, amount: 40, mode: "CASH" });
    expect(r.status).toBe(201);
    const l = await ledger();
    expect(l.expectedCash).toBe(1040);
    expect(l.totalCounterSales).toBe(60); // 40 cash + the 20 card sale above
    expect(l.itemizedTransactions.some((t: any) => t.type === "COUNTER_SALE" && t.description.includes(`Water bottle ×2 (Room ${roomNo})`))).toBe(true);
  });

  it("UPI / card need a reference and go to their own totals", async () => {
    expect((await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: roomNo, category: "DENTAL_KIT", amount: 50, mode: "UPI" })).status).toBe(400);
    expect((await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: roomNo, category: "DENTAL_KIT", amount: 50, mode: "UPI", reference: "UTR123" })).status).toBe(201);
    const l = await ledger();
    expect(l.expectedUpi).toBe(50);
    expect(l.expectedCash).toBe(1040);
  });

  it("Others needs what was sold; sale items can't be booked as paid-outs", async () => {
    expect((await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: roomNo, category: "OTHER", amount: 100, mode: "CASH" })).status).toBe(400);
    expect((await call("POST", `/api/cashier-shifts/${shiftId}/sales`, { roomNumber: roomNo, category: "OTHER", amount: 100, mode: "CASH", reason: "Phone charger" })).status).toBe(201);
    expect((await call("POST", `/api/cashier-shifts/${shiftId}/paid-out`, { category: "WATER_BOTTLE", amount: 10 })).status).toBe(400);
  });

  it("the Monthly MIS shows the sales per item, in the collections and in the sales total", async () => {
    const r = await call("GET", `/api/reports/monthly-mis?month=${todayBusinessDate().slice(0, 7)}`);
    expect(r.status).toBe(200);
    const row = r.json.data.find((x: any) => x.date === todayBusinessDate());
    expect(row.rsWater).toBeGreaterThanOrEqual(40);
    expect(row.rsDental).toBeGreaterThanOrEqual(50);
    expect(row.rsOther).toBeGreaterThanOrEqual(100);
    expect(row.salesRoomService).toBeGreaterThanOrEqual(190);
    expect(row.salesTotal).toBeGreaterThanOrEqual(row.salesRoomService);
  });
});
