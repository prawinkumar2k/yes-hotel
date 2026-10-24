/**
 * Credit (pay later): part of a bill left unpaid. The bill balances (so checkout can close), the debt is listed,
 * collecting it later counts as money received that day, and it can never be over-collected.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { todayBusinessDate } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const user = oid();
const roomId = oid();
const stayId = oid();
const folioId = oid();
const today = todayBusinessDate();
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
let creditId = "";
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(user), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const misToday = async () => (await call("GET", `/api/reports/mis-sheet?month=${today.slice(0, 7)}`)).json.data.days.find((d: any) => d.date === today);

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertOne({ _id: user, role: "ADMIN", firstName: "Cr", lastName: tag, email: `cr-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("rooms").insertOne({ _id: roomId, propertyId: P, roomNumber: `K${tag}`, floor: "1", status: "OCCUPIED", occupancyStatus: "OCCUPIED", sellStatus: "SELLABLE" });
  await db().collection("bookings").insertOne({
    _id: stayId, bookingReference: `CR-${tag}`, propertyId: P, status: "CHECKED_IN", assignedRoom: roomId, checkedInAt: new Date(), source: "WALK_IN",
    guestDetails: { firstName: "Credit", lastName: tag, phone: "9000000001" }, totalAmount: 1000,
  });
  await db().collection("folios").insertOne({ _id: folioId, booking: stayId, guest: oid(), room: roomId, status: "OPEN", propertyId: P, checkInDate: new Date(), checkOutDate: new Date(Date.now() + 864e5), totalCharges: 1000 });
  await db().collection("foliolines").insertOne({ _id: oid(), folio: folioId, booking: stayId, lineType: "ADDON", direction: "DEBIT", description: "Stay", amount: 1000, date: new Date(), postedAt: new Date(), postedBy: "T" });
});

afterAll(async () => {
  await db().collection("creditentries").deleteMany({ booking: stayId });
  await db().collection("payments").deleteMany({ booking: stayId });
  await db().collection("foliolines").deleteMany({ folio: folioId });
  await db().collection("folios").deleteMany({ _id: folioId });
  await db().collection("bookings").deleteMany({ _id: stayId });
  await db().collection("rooms").deleteMany({ _id: roomId });
  await db().collection("users").deleteMany({ _id: user });
  await new Promise((r) => server.close(r));
});

describe("Credit (pay later)", () => {
  it("leaving 400 on credit balances that part of the bill and lists the debt", async () => {
    const before = await misToday();
    const r = await call("POST", `/api/reception/folios/${folioId}/credit`, { amount: 400, note: "pays on Friday" });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.data.balance).toBe(600);
    creditId = r.json.data.credit._id;
    const list = await call("GET", "/api/credits?status=OPEN");
    const mine = list.json.data.entries.find((e: any) => e._id === creditId);
    expect(mine).toMatchObject({ amount: 400, collectedTotal: 0, status: "OPEN", guestName: `Credit ${tag}` });
    const after = await misToday();
    expect(after.credit - before.credit).toBe(400);
    // nothing was received yet
    expect(after.modeTotal).toBe(before.modeTotal);
  });

  it("cannot put more on credit than the bill's balance", async () => {
    const r = await call("POST", `/api/reception/folios/${folioId}/credit`, { amount: 5000 });
    expect(r.status).toBe(409);
  });

  it("collecting counts as money received that day and cannot exceed the credit", async () => {
    const before = await misToday();
    const over = await call("POST", `/api/credits/${creditId}/collect`, { amount: 500, method: "CASH" });
    expect(over.status).toBe(409);
    const noRef = await call("POST", `/api/credits/${creditId}/collect`, { amount: 100, method: "UPI" });
    expect(noRef.status).toBe(400);
    const part = await call("POST", `/api/credits/${creditId}/collect`, { amount: 150, method: "CASH" });
    expect(part.status, JSON.stringify(part.json)).toBe(200);
    expect(part.json.data).toMatchObject({ collectedTotal: 150, status: "OPEN" });
    const after = await misToday();
    expect(after.cash - before.cash).toBe(150);
    expect(after.creditCollected - before.creditCollected).toBe(150);

    const rest = await call("POST", `/api/credits/${creditId}/collect`, { amount: 250, method: "UPI", reference: "UTR1" });
    expect(rest.json.data).toMatchObject({ collectedTotal: 400, status: "SETTLED" });
    const again = await call("POST", `/api/credits/${creditId}/collect`, { amount: 1, method: "CASH" });
    expect(again.status).toBe(409);
  });
});
