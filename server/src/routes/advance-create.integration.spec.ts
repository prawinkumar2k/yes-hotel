/**
 * Advances → "Receive Pre-Stay Advance Payment" (walk-in deposit). The form sends the guest's
 * name / phone / email, the amount and the chosen payment channel — no "method". It used to fail
 * with "guestId, amount, and method are required"; the method now follows from the channel.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const channels = { cash: oid(), upi: oid(), off: oid() };
const email = `adv-${tag}@example.com`;
let server: Server;
let base = "";
let P: mongoose.Types.ObjectId;
const db = () => mongoose.connection.db!;
const post = async (body: Record<string, unknown>) => {
  const res = await fetch(base + "/api/advances", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" })}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
const form = (extra: Record<string, unknown> = {}) => ({ guestName: "Prawin Kumar", guestPhone: "8807054164", guestEmail: email, amount: 1000, paymentChannelId: String(channels.cash), notes: "booking for 100", ...extra });

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Adv", lastName: tag, email: `adv-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("paymentchannels").insertMany([
    { _id: channels.cash, propertyId: P, name: "Cash Counter", code: `CASH-${tag}`, type: "CASH", settlementMode: "IMMEDIATE", commissionPercentage: 0, fixedFee: 0, taxOnFee: 0, displayOrder: 1, isActive: true },
    { _id: channels.upi, propertyId: P, name: "UPI", code: `UPI-${tag}`, type: "UPI", settlementMode: "T+1", commissionPercentage: 0, fixedFee: 0, taxOnFee: 0, displayOrder: 2, isActive: true },
    { _id: channels.off, propertyId: P, name: "Old", code: `OFF-${tag}`, type: "CARD", settlementMode: "T+1", commissionPercentage: 0, fixedFee: 0, taxOnFee: 0, displayOrder: 3, isActive: false },
  ]);
});

afterAll(async () => {
  const guest: any = await db().collection("guests").findOne({ email });
  for (const g of await db().collection("guests").find({ email: { $regex: `-${tag}@example\.com$`, $options: "i" } }).toArray()) {
    const ids = (await db().collection("advancepayments").find({ guest: g._id }).project({ _id: 1 }).toArray()).map((a) => a._id);
    await db().collection("advanceadjustments").deleteMany({ advancePayment: { $in: ids } });
    await db().collection("advancepayments").deleteMany({ guest: g._id });
    await db().collection("guests").deleteOne({ _id: g._id });
  }
  if (guest) {
    const advIds = (await db().collection("advancepayments").find({ guest: guest._id }).project({ _id: 1 }).toArray()).map((a) => a._id);
    await db().collection("advanceadjustments").deleteMany({ advancePayment: { $in: advIds } });
    await db().collection("advancepayments").deleteMany({ _id: { $in: advIds } });
    await db().collection("guests").deleteOne({ _id: guest._id });
  }
  await db().collection("paymentchannels").deleteMany({ _id: { $in: Object.values(channels) } });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("walk-in advance from the Advances page", () => {
  it("exactly what the form sends (channel, no method) is received — as CASH for the cash counter", async () => {
    const r = await post(form());
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.data).toMatchObject({ amount: 1000, method: "CASH" });
    expect(String(r.json.data.paymentChannel ?? r.json.data.paymentChannelId)).toBe(String(channels.cash));
    const guest: any = await db().collection("guests").findOne({ email });
    expect(guest).toMatchObject({ fullName: "Prawin Kumar", phone: "8807054164" });
  });

  it("the UPI channel records a UPI advance", async () => {
    const r = await post(form({ amount: 250, paymentChannelId: String(channels.upi) }));
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.data.method).toBe("UPI");
  });

  it("clear refusals: no channel, an inactive channel, a bad amount, missing guest details", async () => {
    expect((await post(form({ paymentChannelId: "" }))).json.message).toMatch(/payment channel/i);
    expect((await post(form({ paymentChannelId: String(channels.off) }))).status).toBe(400);
    expect((await post(form({ amount: 0 }))).json.message).toMatch(/greater than zero/i);
    expect((await post(form({ amount: "abc" }))).status).toBe(400);
    expect((await post(form({ guestName: "" }))).status).toBe(400);
    expect((await post(form({ guestPhone: "" }))).status).toBe(400);
  });
});

describe("a deposit goes on the SAME guest", () => {
  const phone = `98${tag.replace(/[a-f]/g, "7")}11`.slice(0, 10).padEnd(10, "1");
  const guests = () => db().collection("guests").find({ $or: [{ email: `same-${tag}@example.com` }, { phone: { $regex: phone.slice(-6) } }] }).toArray();
  const dep = (extra: Record<string, unknown>) => post({ guestName: "Same Guest", guestPhone: phone, amount: 500, paymentChannelId: String(channels.cash), ...extra });

  it("a second deposit with the same email adds to the same guest (even in another letter case)", async () => {
    const a = await dep({ guestEmail: `same-${tag}@example.com` });
    const b = await dep({ guestEmail: `SAME-${tag}@Example.com`, amount: 700 });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(String(a.json.data.guest?._id ?? a.json.data.guest)).toBe(String(b.json.data.guest?._id ?? b.json.data.guest));
    expect(b.json.guest).toMatch(/existing guest/);
    expect(await guests()).toHaveLength(1);
    expect(await db().collection("advancepayments").countDocuments({ guest: (await guests())[0]._id })).toBe(2);
  });

  it("the same mobile number with no email (or a different email) is still the same guest", async () => {
    const c = await dep({ amount: 300 }); // no email at all
    const d = await dep({ guestEmail: `other-${tag}@example.com`, amount: 200 }); // a different email, same number
    expect([c.status, d.status]).toEqual([201, 201]);
    expect(c.json.guest).toMatch(/matched by phone/);
    expect(d.json.guest).toMatch(/matched by phone/);
    const all = await guests();
    expect(all).toHaveLength(1); // no duplicate guest created
    expect(await db().collection("advancepayments").countDocuments({ guest: all[0]._id })).toBe(4);
    await db().collection("guests").deleteMany({ email: `other-${tag}@example.com` });
  });

  it("a walk-in without email later gives a real email: same record, placeholder replaced, history kept", async () => {
    const p2 = phone.slice(0, 9) + (phone[9] === "9" ? "8" : "9");
    const walk = { _id: oid(), fullName: "Walk In", phone: p2, email: `walkin-${p2}@yeshotels.local`, totalBookings: 3 };
    await db().collection("guests").insertOne(walk);
    const r = await post({ guestName: "Walk In", guestPhone: `+91 ${p2.slice(0, 5)} ${p2.slice(5)}`, guestEmail: `real-${tag}@example.com`, amount: 900, paymentChannelId: String(channels.cash) });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const g: any = await db().collection("guests").findOne({ _id: walk._id });
    expect(g).toMatchObject({ email: `real-${tag}@example.com`, totalBookings: 3 });
    expect(await db().collection("guests").countDocuments({ phone: { $regex: p2.slice(-6) } })).toBe(1);
    const advIds = (await db().collection("advancepayments").find({ guest: walk._id }).project({ _id: 1 }).toArray()).map((a) => a._id);
    await db().collection("advanceadjustments").deleteMany({ advancePayment: { $in: advIds } });
    await db().collection("advancepayments").deleteMany({ guest: walk._id });
    await db().collection("guests").deleteOne({ _id: walk._id });
  });

  it("a different person (new number and email) becomes a new guest", async () => {
    const r = await post({ guestName: "Someone Else", guestPhone: "7000000001", guestEmail: `else-${tag}@example.com`, amount: 100, paymentChannelId: String(channels.cash) });
    expect(r.status).toBe(201);
    expect(r.json.guest).toBe("new guest");
    const g: any = await db().collection("guests").findOne({ email: `else-${tag}@example.com` });
    await db().collection("advancepayments").deleteMany({ guest: g._id });
    await db().collection("guests").deleteOne({ _id: g._id });
  });
});
