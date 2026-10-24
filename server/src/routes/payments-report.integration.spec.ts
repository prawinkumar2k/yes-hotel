/**
 * The Payments & Refunds report: every payment, advance deposit and refund in a period with totals, a split by method,
 * and what can still be refunded on each payment.
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
const P = oid();
const user = oid();
const bk = oid();
const pay = { upi: oid(), cash: oid() };
const adv = oid();
const ref = oid();
const today = todayBusinessDate();
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const get = async (path: string) => {
  const t = jwt.sign({ id: String(user), role: "MANAGER" }, getJwtSecret(), { expiresIn: "5m" });
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${t}` } });
  return { status: r.status, json: (await r.json()) as any };
};

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const now = new Date();
  await db().collection("properties").insertOne({ _id: P, code: `PR-${tag}`, name: `PR ${tag}`, isActive: true });
  await db().collection("users").insertOne({ _id: user, role: "MANAGER", firstName: "Pr", lastName: tag, email: `pr-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("bookings").insertOne({ _id: bk, bookingReference: `PR-${tag}`, propertyId: P, status: "CHECKED_IN", guestDetails: { firstName: "Pay", lastName: tag, phone: "9000000077" }, totalAmount: 5000, adults: 1, children: 0, checkInDate: now, checkOutDate: now });
  await db().collection("payments").insertMany([
    { _id: pay.upi, propertyId: P, booking: bk, amount: 3000, currency: "INR", method: "UPI", status: "PARTIALLY_REFUNDED", refundedAmount: 500, razorpayPaymentId: `pay_${tag}`, createdAt: now },
    { _id: pay.cash, propertyId: P, booking: bk, amount: 1000, currency: "INR", method: "CASH", status: "COMPLETED", refundedAmount: 0, createdAt: now },
  ]);
  await db().collection("advancepayments").insertOne({ _id: adv, propertyId: P, advanceNumber: `ADV-${tag}`, booking: bk, guest: oid(), amount: 2000, method: "CASH", status: "RECEIVED", receivedAt: now, totalRefunded: 0, totalAdjusted: 0, remainingBalance: 2000 });
  await db().collection("refunds").insertOne({ _id: ref, booking: bk, payment: pay.upi, amount: 500, reason: "Guest left early", status: "COMPLETED", initiatedBy: user, createdAt: now, updatedAt: now });
});

afterAll(async () => {
  await db().collection("refunds").deleteMany({ _id: ref });
  await db().collection("advancepayments").deleteMany({ _id: adv });
  await db().collection("payments").deleteMany({ booking: bk });
  await db().collection("bookings").deleteMany({ _id: bk });
  await db().collection("users").deleteMany({ _id: user });
  await db().collection("properties").deleteMany({ _id: P });
  await new Promise((r) => server.close(r));
});

describe("payments & refunds report", () => {
  it("lists payments, advances and refunds with totals", async () => {
    const r = await get(`/api/reports/payments-refunds?from=${today}&to=${today}`);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const d = r.json.data;
    expect(d.totals).toMatchObject({ collected: 6000, refunded: 500, net: 5500, payments: 2, advances: 1, refunds: 1, refundable: 3500 });
    const upi = d.rows.find((x: any) => x.kind === "PAYMENT" && x.method === "UPI");
    expect(upi).toMatchObject({ bookingRef: `PR-${tag}`, guest: `Pay ${tag}`, amount: 3000, refunded: 500, refundable: 2500 });
    expect(d.rows.find((x: any) => x.kind === "REFUND")).toMatchObject({ amount: 500, note: "Guest left early", method: "UPI" });
    expect(d.byMethod.find((m: any) => m.method === "UPI")).toMatchObject({ collected: 3000, refunded: 500, net: 2500 });
  });

  it("filters by method and by search", async () => {
    const cash = (await get(`/api/reports/payments-refunds?from=${today}&to=${today}&method=CASH`)).json.data;
    expect(cash.totals.collected).toBe(3000); // the CASH payment 1000 + the CASH advance 2000
    const found = (await get(`/api/reports/payments-refunds?from=${today}&to=${today}&search=PR-${tag}`)).json.data;
    expect(found.rows.length).toBe(4);
    const none = (await get(`/api/reports/payments-refunds?from=${today}&to=${today}&search=NOPE-${tag}`)).json.data;
    expect(none.rows.length).toBe(0);
  });

  it("a period outside the data is empty, and a reversed period is refused", async () => {
    const old = (await get(`/api/reports/payments-refunds?from=2020-01-01&to=2020-01-31`)).json.data;
    expect(old.totals.collected).toBe(0);
    expect((await get(`/api/reports/payments-refunds?from=${today}&to=2020-01-01`)).status).toBe(400);
  });
});
