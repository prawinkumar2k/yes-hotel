/**
 * Reception department over HTTP, with the single Reception (RECEPTIONIST) login doing the
 * Front Desk, Verification Queue and Cashier & Billing functions:
 *
 *   in-house stay → send to billing → apply advance → record payment (duplicate-safe, no overpay)
 *   → checkout → housekeeping cleans → room awaits verification → reject (back to housekeeping)
 *   → re-cleaned (resubmitted automatically) → verify → room released.
 * Plus: folio void → verification → reject → resubmit; shift variance → verify; tariff edit
 * never rewrites money; money line types refused; blocked roles get 403.
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
const users = { reception: oid(), housekeeping: oid(), cashier: oid(), customer: oid() };
const ids = { category: oid(), room: oid(), booking: oid(), folio: oid(), advance: oid(), guest: oid() };
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const role = { reception: "RECEPTIONIST", housekeeping: "HOUSEKEEPING", cashier: "CASHIER", customer: "CUSTOMER" } as const;
const tok = (who: keyof typeof users) => jwt.sign({ id: String(users[who]), role: role[who] }, getJwtSecret(), { expiresIn: "5m" });

async function call(who: keyof typeof users, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tok(who)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const balanceOf = async () => (await call("reception", "GET", "/api/reception/billing-queue?all=true")).json.data.find((r: any) => r.bookingId === String(ids.booking));

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  const u = (_id: mongoose.Types.ObjectId, r: string) => ({ _id, role: r, firstName: "Rcp", lastName: r, email: `rcp-${r.toLowerCase()}-${tag}@test.local`, passwordHash: "x", isActive: true, ...(r !== "CUSTOMER" ? { propertyId: P, propertyIds: [P] } : {}) });
  await db().collection("users").insertMany([u(users.reception, "RECEPTIONIST"), u(users.housekeeping, "HOUSEKEEPING"), u(users.cashier, "CASHIER"), u(users.customer, "CUSTOMER")]);
  await db().collection("roomcategories").insertOne({ _id: ids.category, slug: `rcp-${tag}`, name: `Rcp ${tag}`, description: "test", basePrice: 4000, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("rooms").insertOne({ _id: ids.room, propertyId: P, roomNumber: `R${tag}`, category: ids.category, floor: "9", status: "OCCUPIED", occupancyStatus: "OCCUPIED", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", currentBooking: ids.booking });
  const now = new Date();
  await db().collection("bookings").insertOne({
    _id: ids.booking, propertyId: P, bookingReference: `RCP-${tag}`, source: "WALK_IN", status: "CHECKED_IN",
    guestDetails: { firstName: "Recep", lastName: "Guest", email: `guest-${tag}@test.local`, phone: "9000000077" },
    roomCategory: ids.category, assignedRoom: ids.room, checkInDate: new Date(now.getTime() - 86400000), checkOutDate: now,
    adults: 1, children: 0, ratePerNight: 4000, totalAmount: 4200, taxAmount: 200, cgstAmount: 100, sgstAmount: 100, paidAmount: 0, paymentStatus: "UNPAID",
    checkedInAt: new Date(now.getTime() - 86400000), createdAt: now, updatedAt: now,
  });
  await db().collection("folios").insertOne({ _id: ids.folio, propertyId: P, booking: ids.booking, guest: ids.guest, room: ids.room, checkInDate: now, checkOutDate: now, status: "OPEN", totalCharges: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
  await db().collection("foliolines").insertMany([
    { folio: ids.folio, booking: ids.booking, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff (1 night)", amount: 4000, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_CGST", direction: "DEBIT", description: "CGST on Room Tariff", amount: 100, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.booking, lineType: "TAX_SGST", direction: "DEBIT", description: "SGST on Room Tariff", amount: 100, date: now, postedAt: now, postedBy: "test" },
  ]);
  await db().collection("advancepayments").insertOne({ _id: ids.advance, propertyId: P, advanceNumber: `ADV-RCP-${tag}`, booking: ids.booking, guest: ids.guest, amount: 1000, totalAdjusted: 0, totalRefunded: 0, remainingBalance: 1000, method: "CASH", status: "RECEIVED", receivedAt: now, receivedBy: users.reception, createdAt: now, updatedAt: now });
});

afterAll(async () => {
  const bookingFilter = { booking: ids.booking };
  await db().collection("verificationrequests").deleteMany({ $or: [bookingFilter, { room: ids.room }, { "details.shiftNumber": { $regex: "" }, submittedBy: users.reception }] });
  await db().collection("foliolines").deleteMany(bookingFilter);
  await db().collection("folios").deleteMany(bookingFilter);
  await db().collection("payments").deleteMany(bookingFilter);
  await db().collection("advanceadjustments").deleteMany({ advancePayment: ids.advance });
  await db().collection("advancepayments").deleteMany({ _id: ids.advance });
  await db().collection("housekeepingtasks").deleteMany({ room: ids.room });
  await db().collection("roomnights").deleteMany(bookingFilter);
  await db().collection("bookings").deleteMany({ _id: ids.booking });
  await db().collection("rooms").deleteMany({ _id: ids.room });
  await db().collection("roomcategories").deleteMany({ _id: ids.category });
  await db().collection("cashiershifts").deleteMany({ cashier: users.reception });
  await db().collection("users").deleteMany({ _id: { $in: Object.values(users) } });
  await new Promise((r) => server.close(r));
});

describe("Reception: one login, three functions", () => {
  it("blocks other roles from the reception money and verification actions (server-side)", async () => {
    expect((await call("customer", "POST", `/api/reception/folios/${ids.folio}/payments`, { amount: 1, method: "CASH", clientRequestId: "x" })).status).toBe(403);
    expect((await call("housekeeping", "GET", "/api/reception/billing-queue")).status).toBe(403);
    expect((await call("housekeeping", "POST", `/api/verifications/${oid()}/approve`, {})).status).toBe(403);
    expect((await call("cashier", "PUT", `/api/folios/booking/${ids.booking}/bill-edit`, { ratePerNight: 1 })).status).toBe(403);
  });

  it("Front Desk sends the stay to billing; it appears in Cashier & Billing", async () => {
    const r = await call("reception", "POST", `/api/reception/bookings/${ids.booking}/checkout/initiate`, {});
    expect(r.status).toBe(200);
    const row = (await call("reception", "GET", "/api/reception/billing-queue")).json.data.find((x: any) => x.bookingId === String(ids.booking));
    expect(row).toMatchObject({ checkoutInitiated: true, balance: 4200, advanceAvailable: 1000, readyToCheckOut: false });
  });

  it("Cashier & Billing: refuses money line types as charges", async () => {
    const r = await call("reception", "POST", `/api/folios/${ids.folio}/charges`, { lineType: "PAYMENT", description: "fake", amount: 100 });
    expect(r.status).toBe(400);
  });

  it("applies the advance, records a payment once (duplicate-safe) and refuses overpayment", async () => {
    expect((await call("reception", "POST", `/api/reception/folios/${ids.folio}/apply-advances`, {})).json.data.applied).toBe(1000);
    expect((await call("reception", "POST", `/api/reception/folios/${ids.folio}/payments`, { amount: 5000, method: "CASH", clientRequestId: `over-${tag}` })).status).toBe(409);
    const key = `pay-${tag}`;
    const first = await call("reception", "POST", `/api/reception/folios/${ids.folio}/payments`, { amount: 3200, method: "UPI", reference: "UTR1", clientRequestId: key });
    expect(first.status).toBe(201);
    const again = await call("reception", "POST", `/api/reception/folios/${ids.folio}/payments`, { amount: 3200, method: "UPI", reference: "UTR1", clientRequestId: key });
    expect(again.json.duplicate).toBe(true);
    expect(await db().collection("payments").countDocuments({ booking: ids.booking })).toBe(1);
    const row = await balanceOf();
    expect(row).toMatchObject({ balance: 0, readyToCheckOut: true });
    const receipt = await call("reception", "GET", `/api/reception/payments/${first.json.data.payment._id}/receipt`);
    expect(receipt.json.data).toMatchObject({ balanceAfter: 0, booking: { room: `R${tag}` } });
  });

  it("checkout completes at ₹0 and hands the room to housekeeping", async () => {
    const r = await call("reception", "POST", `/api/bookings/${ids.booking}/check-out`, {});
    expect(r.status).toBe(200);
    const b = await db().collection("bookings").findOne({ _id: ids.booking });
    expect(b).toMatchObject({ status: "CHECKED_OUT", checkoutClearance: expect.objectContaining({ status: "CLEARED" }) });
    // Dirty, and given straight to a free housekeeper when there is one.
    expect(["DIRTY", "ASSIGNED"]).toContain((await db().collection("rooms").findOne({ _id: ids.room }))!.housekeepingStatus);
    expect(await db().collection("housekeepingtasks").countDocuments({ room: ids.room })).toBeGreaterThan(0);
  });

  it("cleaned room waits for verification; reject returns it to housekeeping; re-clean resubmits; verify releases", async () => {
    const task = await db().collection("housekeepingtasks").findOne({ room: ids.room }, { sort: { createdAt: -1 } });
    const hk = (status: string) => call("housekeeping", "PATCH", `/api/admin/housekeeping/${task!._id}`, { status });
    expect((await hk("CLEANING")).status).toBe(200);
    expect((await hk("CLEANING_COMPLETED")).status).toBe(200);

    let pending = (await call("reception", "GET", "/api/verifications?status=PENDING&type=ROOM_RELEASE")).json.data.find((v: any) => String(v.room) === String(ids.room));
    expect(pending).toBeTruthy();
    expect((await call("reception", "POST", `/api/verifications/${pending._id}/reject`, {})).status).toBe(400); // reason required
    expect((await call("reception", "POST", `/api/verifications/${pending._id}/reject`, { reason: "Bathroom not cleaned" })).status).toBe(200);
    expect((await db().collection("rooms").findOne({ _id: ids.room }))!.housekeepingStatus).toBe("DIRTY");
    expect((await db().collection("housekeepingtasks").findOne({ _id: task!._id }))!.notes).toMatch(/Bathroom/);

    expect((await hk("CLEANING")).status).toBe(200);
    const photoData = "data:image/jpeg;base64,mockproofphoto123";
    const resComplete = await call("housekeeping", "PATCH", `/api/admin/housekeeping/${task!._id}`, {
      status: "CLEANING_COMPLETED",
      cleaningProofPhoto: photoData,
    });
    expect(resComplete.status).toBe(200);
    pending = (await call("reception", "GET", "/api/verifications?status=PENDING&type=ROOM_RELEASE")).json.data.find((v: any) => String(v.room) === String(ids.room));
    expect(pending).toMatchObject({ attempt: 2 });
    expect(pending.details?.cleaningProofPhoto).toBe(photoData);
    expect(pending.resubmissionOf).toBeTruthy();

    const ok = await call("reception", "POST", `/api/verifications/${pending._id}/approve`, { note: "Inspected" });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ status: "APPROVED", reviewedBy: String(users.reception) });
    expect(ok.json.data.reviewedAt).toBeTruthy();
    const room = await db().collection("rooms").findOne({ _id: ids.room });
    expect(room).toMatchObject({ housekeepingStatus: "CLEAN", status: "AVAILABLE" });
    expect((await call("reception", "POST", `/api/verifications/${pending._id}/approve`, {})).status).toBe(409); // no double approval
  });
});

describe("Reception: sensitive actions are verified after completion", () => {
  it("folio void → pending → reject (returned to Cashier) → resubmit (attempt 2) → verify", async () => {
    // a fresh open folio on a second booking
    const b2 = oid(), f2 = oid(), line = oid();
    const now = new Date();
    await db().collection("bookings").insertOne({ _id: b2, propertyId: P, bookingReference: `RCP2-${tag}`, source: "WALK_IN", status: "CHECKED_IN", guestDetails: { firstName: "V", lastName: "G", email: `v-${tag}@t.local`, phone: "9000000078" }, roomCategory: ids.category, checkInDate: now, checkOutDate: now, adults: 1, totalAmount: 0, taxAmount: 0, createdAt: now, updatedAt: now });
    await db().collection("folios").insertOne({ _id: f2, propertyId: P, booking: b2, guest: ids.guest, room: ids.room, checkInDate: now, checkOutDate: now, status: "OPEN", totalCharges: 0, totalTax: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
    await db().collection("foliolines").insertOne({ _id: line, folio: f2, booking: b2, lineType: "MINIBAR", direction: "DEBIT", description: "Minibar", amount: 250, date: now, postedAt: now, postedBy: "test" });
    try {
      expect((await call("reception", "DELETE", `/api/folios/${f2}/lines/${line}`, { reason: "posted to wrong room" })).status).toBe(200);
      let v = (await call("reception", "GET", "/api/verifications?status=PENDING&type=FOLIO_VOID")).json.data.find((x: any) => String(x.booking) === String(b2));
      expect(v).toMatchObject({ returnQueue: "CASHIER", amount: 250 });
      await call("reception", "POST", `/api/verifications/${v._id}/reject`, { reason: "Charge was correct; repost it" });
      const returned = (await call("reception", "GET", "/api/verifications?returned=true&queue=CASHIER")).json.data.map((x: any) => x._id);
      expect(returned).toContain(v._id);
      expect((await call("reception", "POST", `/api/verifications/${v._id}/resubmit`, { note: "Reposted the minibar charge" })).status).toBe(201);
      v = (await call("reception", "GET", "/api/verifications?status=PENDING&type=FOLIO_VOID")).json.data.find((x: any) => String(x.booking) === String(b2));
      expect(v.attempt).toBe(2);
      expect((await call("reception", "POST", `/api/verifications/${v._id}/approve`, {})).status).toBe(200);
    } finally {
      await db().collection("verificationrequests").deleteMany({ booking: b2 });
      await db().collection("foliolines").deleteMany({ folio: f2 });
      await db().collection("folios").deleteMany({ _id: f2 });
      await db().collection("bookings").deleteMany({ _id: b2 });
    }
  });

  it("tariff edit reverses and reposts lines (payments untouched) and queues a below-default rate", async () => {
    const b3 = oid(), f3 = oid();
    const now = new Date();
    const out = new Date(now.getTime() + 86400000);
    await db().collection("bookings").insertOne({ _id: b3, propertyId: P, bookingReference: `RCP3-${tag}`, source: "WALK_IN", status: "CHECKED_IN", guestDetails: { firstName: "T", lastName: "G", email: `t-${tag}@t.local`, phone: "9000000079" }, roomCategory: ids.category, checkInDate: now, checkOutDate: out, adults: 1, ratePerNight: 4000, totalAmount: 4200, taxAmount: 200, createdAt: now, updatedAt: now });
    await db().collection("folios").insertOne({ _id: f3, propertyId: P, booking: b3, guest: ids.guest, room: ids.room, checkInDate: now, checkOutDate: out, status: "OPEN", totalCharges: 0, totalTax: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
    await db().collection("foliolines").insertMany([
      { folio: f3, booking: b3, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff", amount: 4000, date: now, postedAt: now, postedBy: "test" },
      { folio: f3, booking: b3, lineType: "PAYMENT", direction: "CREDIT", description: "Payment (CASH)", amount: 1000, date: now, postedAt: now, postedBy: "test" },
    ]);
    try {
      const r = await call("reception", "PUT", `/api/folios/booking/${b3}/bill-edit`, { ratePerNight: 3000, reason: "Corporate rate" });
      expect(r.status).toBe(200);
      const lines = await db().collection("foliolines").find({ folio: f3 }).toArray();
      expect(lines.filter((l) => l.lineType === "PAYMENT")).toHaveLength(1); // money untouched
      expect(lines.some((l) => l.lineType === "REVERSAL")).toBe(true); // old tariff reversed, not deleted
      expect(lines.some((l) => l.lineType === "ROOM_CHARGE" && l.amount === 3000)).toBe(true);
      const v = (await call("reception", "GET", "/api/verifications?status=PENDING&type=TARIFF_BELOW_DEFAULT")).json.data.find((x: any) => String(x.booking) === String(b3));
      expect(v).toMatchObject({ returnQueue: "FRONT_DESK" });
    } finally {
      await db().collection("verificationrequests").deleteMany({ booking: b3 });
      await db().collection("foliolines").deleteMany({ folio: f3 });
      await db().collection("folios").deleteMany({ _id: f3 });
      await db().collection("bookings").deleteMany({ _id: b3 });
    }
  });

  it("shift variance above the threshold is verified by the same Reception login", async () => {
    const open = await call("reception", "POST", "/api/cashier-shifts/open", { drawerId: `RCP-${tag}`, openingFloat: 1000 });
    expect(open.status).toBe(201);
    const id = open.json.data._id;
    const close = await call("reception", "POST", `/api/cashier-shifts/${id}/close`, { actualCashCounted: 500, varianceReason: "₹500 note missing" });
    expect(close.json.data).toMatchObject({ status: "CLOSED", varianceAcceptanceRequired: true });
    const v = (await call("reception", "GET", "/api/verifications?status=PENDING&type=SHIFT_VARIANCE")).json.data.find((x: any) => x.details?.shiftId === id);
    expect(v).toBeTruthy();
    expect((await call("reception", "POST", `/api/verifications/${v._id}/approve`, { note: "Recorded as loss" })).status).toBe(200);
    expect((await db().collection("cashiershifts").findOne({ _id: new mongoose.Types.ObjectId(id) }))!.status).toBe("RECONCILED");
    await db().collection("verificationrequests").deleteMany({ _id: new mongoose.Types.ObjectId(v._id) });
  });
});
