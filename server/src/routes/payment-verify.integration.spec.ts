/**
 * Online payment confirmation trusts only Razorpay — never the browser / phone.
 *
 * Client confirmation (POST /api/payments/verify) and the Razorpay webhook must:
 *   - check the signature (constant time); read the ORDER and the PAYMENT from Razorpay;
 *   - require the order to be for this booking (order notes, written by our server) and for its
 *     full amount, the payment to belong to that order, INR, and actually successful;
 *   - confirm booking + record payment together (one transaction), once per payment;
 *   - never revive a cancelled booking, never reuse one booking's payment for another.
 * A fake gateway stands in for Razorpay: no network, no real money.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { createServer } from "../../index";
import { setRazorpayGatewayForTests, type GatewayOrder, type GatewayPayment } from "../services/razorpay-gateway.service";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const SECRET = `local_test_secret_${tag}`;
const WEBHOOK_SECRET = `local_test_webhook_${tag}`;
let server: Server;
let base = "";
let saved: Record<string, string | undefined> = {};
let P: mongoose.Types.ObjectId;
const db = () => mongoose.connection.db!;

// ── fake Razorpay ─────────────────────────────────────────────────────────
const orders = new Map<string, GatewayOrder>();
const payments = new Map<string, GatewayPayment>();
let gatewayDown = false;
const order = (id: string, bookingId: mongoose.Types.ObjectId, amountPaise: number, extra: Partial<GatewayOrder> = {}) =>
  orders.set(id, { id, amount: amountPaise, currency: "INR", status: "paid", notes: { bookingId: String(bookingId) }, ...extra });
const pay = (id: string, orderId: string, amountPaise: number, extra: Partial<GatewayPayment> = {}) =>
  payments.set(id, { id, order_id: orderId, amount: amountPaise, currency: "INR", status: "captured", ...extra });

const sign = (orderId: string, paymentId: string) => crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
const verify = async (orderId: string, paymentId: string, bookingId: mongoose.Types.ObjectId, signature = sign(orderId, paymentId)) => {
  const res = await fetch(base + "/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, bookingId: String(bookingId) }),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const webhook = async (payment: Record<string, unknown>) => {
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
  const res = await fetch(base + "/api/webhooks/razorpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex") },
    body: raw,
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const booking = (id: mongoose.Types.ObjectId) => db().collection("bookings").findOne({ _id: id }) as Promise<any>;
const paymentCount = (id: mongoose.Types.ObjectId) => db().collection("payments").countDocuments({ booking: id });
const created: mongoose.Types.ObjectId[] = [];
const newBooking = async (total: number, status = "PENDING") => {
  const _id = oid();
  created.push(_id);
  await db().collection("bookings").insertOne({
    _id, propertyId: P, bookingReference: `PAY-${tag}-${String(_id).slice(-5)}`, status, paymentStatus: "UNPAID", totalAmount: total, paidAmount: 0,
    roomCategory: oid(), checkInDate: new Date(Date.now() + 7 * 864e5), checkOutDate: new Date(Date.now() + 8 * 864e5), adults: 1, children: 0,
    guestDetails: { firstName: "Pay", lastName: tag, email: `pay-${tag}@example.com`, phone: "9000000011" },
  });
  return _id;
};
const expectUntouched = async (id: mongoose.Types.ObjectId) => {
  expect(await booking(id)).toMatchObject({ status: "PENDING", paymentStatus: "UNPAID" });
  expect(await paymentCount(id)).toBe(0);
};

beforeAll(async () => {
  saved = { s: process.env.RAZORPAY_KEY_SECRET, w: process.env.RAZORPAY_WEBHOOK_SECRET };
  process.env.RAZORPAY_KEY_SECRET = SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  setRazorpayGatewayForTests({
    fetchOrder: async (id) => { if (gatewayDown) throw new Error("gateway unreachable"); return orders.get(id) ?? null; },
    fetchPayment: async (id) => { if (gatewayDown) throw new Error("gateway unreachable"); return payments.get(id) ?? null; },
  });
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
});
beforeEach(() => { gatewayDown = false; });

afterAll(async () => {
  setRazorpayGatewayForTests(null);
  for (const [k, env] of [["s", "RAZORPAY_KEY_SECRET"], ["w", "RAZORPAY_WEBHOOK_SECRET"]] as const) {
    if (saved[k] === undefined) delete process.env[env];
    else process.env[env] = saved[k];
  }
  await db().collection("payments").deleteMany({ booking: { $in: created } });
  await db().collection("webhookevents").deleteMany({ eventId: { $regex: `_${tag}` } });
  await db().collection("bookings").deleteMany({ _id: { $in: created } });
  await db().collection("guests").deleteMany({ email: `pay-${tag}@example.com` });
  await new Promise((r) => server.close(r));
});

describe("client confirmation — POST /api/payments/verify", () => {
  it("1. a correct full payment confirms its own booking", async () => {
    const A = await newBooking(1000);
    order(`order_1_${tag}`, A, 100000); pay(`pay_1_${tag}`, `order_1_${tag}`, 100000);
    const r = await verify(`order_1_${tag}`, `pay_1_${tag}`, A);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(await booking(A)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID", paidAmount: 1000 });
    const rec: any = await db().collection("payments").findOne({ booking: A });
    expect(rec).toMatchObject({ razorpayOrderId: `order_1_${tag}`, razorpayPaymentId: `pay_1_${tag}`, amount: 1000, currency: "INR", status: "COMPLETED" });
    expect(String(rec.propertyId)).toBe(String(P));
  });

  it("2. a cheaper booking's payment submitted against a dearer booking is refused", async () => {
    const A = await newBooking(1000);
    const B = await newBooking(9000);
    order(`order_2_${tag}`, A, 100000); pay(`pay_2_${tag}`, `order_2_${tag}`, 100000);
    const r = await verify(`order_2_${tag}`, `pay_2_${tag}`, B);
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/not for this booking/);
    await expectUntouched(B);
    await expectUntouched(A); // nothing confirmed by a refused call
  });

  it("3. an order for less than the booking total is refused", async () => {
    const B = await newBooking(9000);
    order(`order_3_${tag}`, B, 100000); pay(`pay_3_${tag}`, `order_3_${tag}`, 100000);
    const r = await verify(`order_3_${tag}`, `pay_3_${tag}`, B);
    expect(r.status).toBe(400);
    await expectUntouched(B);
  });

  it("3b. a payment for less than its order is refused", async () => {
    const B = await newBooking(1000);
    order(`order_3b_${tag}`, B, 100000); pay(`pay_3b_${tag}`, `order_3b_${tag}`, 1000);
    const r = await verify(`order_3b_${tag}`, `pay_3b_${tag}`, B);
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/amount/i);
    await expectUntouched(B);
  });

  it("4. a wrong currency is refused", async () => {
    const B = await newBooking(1000);
    order(`order_4_${tag}`, B, 100000, { currency: "USD" }); pay(`pay_4_${tag}`, `order_4_${tag}`, 100000, { currency: "USD" });
    const r = await verify(`order_4_${tag}`, `pay_4_${tag}`, B);
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/currency/i);
    await expectUntouched(B);
  });

  it("5. a payment that belongs to a different order is refused (wrong order id)", async () => {
    const B = await newBooking(1000);
    order(`order_5_${tag}`, B, 100000);
    order(`order_5x_${tag}`, B, 100000);
    pay(`pay_5_${tag}`, `order_5x_${tag}`, 100000); // paid against another order
    const r = await verify(`order_5_${tag}`, `pay_5_${tag}`, B);
    expect(r.status).toBe(400);
    await expectUntouched(B);
  });

  it("6. an invalid signature is refused before anything else", async () => {
    const B = await newBooking(1000);
    order(`order_6_${tag}`, B, 100000); pay(`pay_6_${tag}`, `order_6_${tag}`, 100000);
    const r = await verify(`order_6_${tag}`, `pay_6_${tag}`, B, "0".repeat(64));
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/signature/i);
    await expectUntouched(B);
  });

  it("7. a failed payment never confirms", async () => {
    const B = await newBooking(1000);
    order(`order_7_${tag}`, B, 100000, { status: "attempted" }); pay(`pay_7_${tag}`, `order_7_${tag}`, 100000, { status: "failed" });
    const r = await verify(`order_7_${tag}`, `pay_7_${tag}`, B);
    expect(r.status).toBe(400);
    await expectUntouched(B);
  });

  it("8. a pending payment is reported as processing — not confirmed", async () => {
    const B = await newBooking(1000);
    order(`order_8_${tag}`, B, 100000, { status: "attempted" }); pay(`pay_8_${tag}`, `order_8_${tag}`, 100000, { status: "created" });
    const r = await verify(`order_8_${tag}`, `pay_8_${tag}`, B);
    expect(r.status).toBe(202);
    expect(r.json.pending).toBe(true);
    await expectUntouched(B);
  });

  it("9. the same confirmation sent again is recognised — one payment record", async () => {
    const A = await newBooking(1000);
    order(`order_9_${tag}`, A, 100000); pay(`pay_9_${tag}`, `order_9_${tag}`, 100000);
    expect((await verify(`order_9_${tag}`, `pay_9_${tag}`, A)).status).toBe(200);
    const again = await verify(`order_9_${tag}`, `pay_9_${tag}`, A);
    expect(again.status).toBe(200);
    expect(again.json.message).toMatch(/already verified/i);
    expect(await paymentCount(A)).toBe(1);
  });

  it("10. a payment reference already used for one booking cannot be replayed for another", async () => {
    const A = await newBooking(1000);
    const B = await newBooking(1000); // same price: the amount check alone would not stop this
    order(`order_10_${tag}`, A, 100000); pay(`pay_10_${tag}`, `order_10_${tag}`, 100000);
    expect((await verify(`order_10_${tag}`, `pay_10_${tag}`, A)).status).toBe(200);
    const replay = await verify(`order_10_${tag}`, `pay_10_${tag}`, B);
    expect(replay.status).toBe(400);
    await expectUntouched(B);
    expect(await paymentCount(A)).toBe(1);
  });

  it("11. two simultaneous confirmations of one payment record it once", async () => {
    const A = await newBooking(1000);
    order(`order_11_${tag}`, A, 100000); pay(`pay_11_${tag}`, `order_11_${tag}`, 100000);
    const [r1, r2] = await Promise.all([verify(`order_11_${tag}`, `pay_11_${tag}`, A), verify(`order_11_${tag}`, `pay_11_${tag}`, A)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 200]);
    expect(await booking(A)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect(await paymentCount(A)).toBe(1);
  });

  it("12. a legitimate retry after a failed attempt (new payment, same order) confirms once", async () => {
    const A = await newBooking(1000);
    order(`order_12_${tag}`, A, 100000);
    pay(`pay_12a_${tag}`, `order_12_${tag}`, 100000, { status: "failed" });
    pay(`pay_12b_${tag}`, `order_12_${tag}`, 100000);
    expect((await verify(`order_12_${tag}`, `pay_12a_${tag}`, A)).status).toBe(400);
    await expectUntouched(A);
    expect((await verify(`order_12_${tag}`, `pay_12b_${tag}`, A)).status).toBe(200);
    expect(await paymentCount(A)).toBe(1);
  });

  it("gateway unreachable → nothing is confirmed (the webhook confirms later)", async () => {
    const A = await newBooking(1000);
    order(`order_13_${tag}`, A, 100000); pay(`pay_13_${tag}`, `order_13_${tag}`, 100000);
    gatewayDown = true;
    const r = await verify(`order_13_${tag}`, `pay_13_${tag}`, A);
    expect(r.status).toBe(502);
    await expectUntouched(A);
  });

  it("a payment for a cancelled booking never revives it", async () => {
    const C = await newBooking(1000, "CANCELLED");
    order(`order_14_${tag}`, C, 100000); pay(`pay_14_${tag}`, `order_14_${tag}`, 100000);
    const r = await verify(`order_14_${tag}`, `pay_14_${tag}`, C);
    expect(r.status).toBe(409);
    expect(await booking(C)).toMatchObject({ status: "CANCELLED", paymentStatus: "UNPAID" });
    expect(await paymentCount(C)).toBe(0);
  });

  it("if the payment can't be recorded, the booking is not confirmed either (all or nothing)", async () => {
    const A = await newBooking(1000);
    order(`order_15_${tag}`, A, 100000); pay(`pay_15_${tag}`, `order_15_${tag}`, 100000);
    const ix = await db().collection("payments").createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true, name: `atomic_test_${tag}` });
    const blocker = oid();
    await db().collection("payments").insertOne({ _id: blocker, booking: oid(), razorpayOrderId: `order_15_${tag}`, amount: 1, status: "COMPLETED", method: "RAZORPAY" });
    try {
      const r = await verify(`order_15_${tag}`, `pay_15_${tag}`, A);
      expect(r.status).toBe(500);
      expect(r.json.message).not.toMatch(/E11000|duplicate key|index/);
      await expectUntouched(A);
    } finally {
      await db().collection("payments").dropIndex(ix);
      await db().collection("payments").deleteOne({ _id: blocker });
    }
  });
});

describe("Razorpay webhook — payment.captured", () => {
  it("the booking comes from the order, not from editable payment notes", async () => {
    const A = await newBooking(1000);
    const B = await newBooking(1000);
    order(`order_w1_${tag}`, A, 100000);
    const r = await webhook({ id: `pay_w1_${tag}`, order_id: `order_w1_${tag}`, amount: 100000, currency: "INR", status: "captured", notes: { bookingId: String(B) } });
    expect(r.status).toBe(200);
    expect(await booking(A)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    await expectUntouched(B);
  });

  it("a cheaper payment cannot confirm a dearer booking via the webhook", async () => {
    const B = await newBooking(9000);
    order(`order_w2_${tag}`, B, 100000);
    const r = await webhook({ id: `pay_w2_${tag}`, order_id: `order_w2_${tag}`, amount: 100000, currency: "INR", status: "captured", notes: {} });
    expect(r.status).toBe(200); // acknowledged, quarantined for review
    await expectUntouched(B);
  });

  it("a wrong currency is quarantined, not confirmed", async () => {
    const B = await newBooking(1000);
    order(`order_w3_${tag}`, B, 100000, { currency: "USD" });
    const r = await webhook({ id: `pay_w3_${tag}`, order_id: `order_w3_${tag}`, amount: 100000, currency: "USD", status: "captured" });
    expect(r.status).toBe(200);
    await expectUntouched(B);
  });

  it("client confirmation and webhook together record the payment once", async () => {
    const A = await newBooking(1000);
    order(`order_w4_${tag}`, A, 100000); pay(`pay_w4_${tag}`, `order_w4_${tag}`, 100000);
    const [c, w] = await Promise.all([
      verify(`order_w4_${tag}`, `pay_w4_${tag}`, A),
      webhook({ id: `pay_w4_${tag}`, order_id: `order_w4_${tag}`, amount: 100000, currency: "INR", status: "captured" }),
    ]);
    expect(c.status).toBe(200);
    expect(w.status).toBe(200);
    expect(await paymentCount(A)).toBe(1);
    expect(await booking(A)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
  });

  it("gateway unreachable → 500 so Razorpay redelivers; nothing confirmed", async () => {
    const A = await newBooking(1000);
    order(`order_w5_${tag}`, A, 100000);
    gatewayDown = true;
    const r = await webhook({ id: `pay_w5_${tag}`, order_id: `order_w5_${tag}`, amount: 100000, currency: "INR", status: "captured" });
    expect(r.status).toBe(500);
    await expectUntouched(A);
  });
});
