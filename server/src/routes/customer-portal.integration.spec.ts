/**
 * Customer portal over HTTP:
 *
 *   sign in with booking number + mobile (account created, stays booked together linked)
 *   → add another stay from the account → see the balance → pay it online (demo gateway in dev)
 *   → ask Reception to change dates → Reception declines / approves → review after checkout
 *   → profile saved details (no password hash returned) → change password.
 * Plus: wrong mobile refused, staff emails never become guest accounts, staff can't use the
 * guest endpoints and guests can't use the staff ones.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { hashPassword } from "../utils/auth";
import { addDays, todayBusinessDate } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const staff = { reception: oid(), housekeeping: oid() };
const other = oid(); // another guest account
const ids = { category: oid(), room: oid(), group: oid(), b1: oid(), b2: oid(), b3: oid(), inHouse: oid(), out: oid(), staffBooking: oid(), folio: oid() };
const mobile = `98${tag.replace(/[a-f]/g, "1").padStart(8, "7")}`.slice(0, 10);
const guestEmail = `portal-${tag}@guest.test`;
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
let guestToken = "";
const db = () => mongoose.connection.db!;
const staffTok = (id: mongoose.Types.ObjectId, role: string) => jwt.sign({ id: String(id), role }, getJwtSecret(), { expiresIn: "5m" });

async function call(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const rcp = () => staffTok(staff.reception, "RECEPTIONIST");

beforeAll(async () => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  const u = (_id: mongoose.Types.ObjectId, role: string, email: string) => ({ _id, role, firstName: "Cp", lastName: role, email, passwordHash: "x", isActive: true, ...(role !== "CUSTOMER" ? { propertyId: P, propertyIds: [P] } : {}) });
  await db().collection("users").insertMany([
    u(staff.reception, "RECEPTIONIST", `cp-rcp-${tag}@test.local`),
    u(staff.housekeeping, "HOUSEKEEPING", `cp-hk-${tag}@test.local`),
    { ...u(other, "CUSTOMER", `cp-other-${tag}@guest.test`), passwordHash: await hashPassword("OtherPass123") },
  ]);
  await db().collection("roomcategories").insertOne({ _id: ids.category, slug: `cp-${tag}`, name: `Cp ${tag}`, description: "test", basePrice: 4000, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("rooms").insertOne({ _id: ids.room, propertyId: P, roomNumber: `C${tag}`, category: ids.category, floor: "9", status: "OCCUPIED", occupancyStatus: "OCCUPIED", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", currentBooking: ids.inHouse });
  const now = new Date();
  const day = (d: string) => new Date(`${d}T00:00:00+05:30`);
  const today = todayBusinessDate();
  const bk = (_id: mongoose.Types.ObjectId, ref: string, extra: Record<string, unknown> = {}) => ({
    _id, propertyId: P, bookingReference: ref, source: "WEBSITE", status: "CONFIRMED",
    guestDetails: { firstName: "Portal", lastName: "Guest", email: guestEmail, phone: `+91 ${mobile}` },
    roomCategory: ids.category, checkInDate: day(addDays(today, 10)), checkOutDate: day(addDays(today, 12)),
    adults: 2, children: 0, ratePerNight: 2000, totalAmount: 4200, taxAmount: 200, cgstAmount: 100, sgstAmount: 100, paidAmount: 0, paymentStatus: "UNPAID",
    createdAt: now, updatedAt: now, ...extra,
  });
  await db().collection("bookings").insertMany([
    bk(ids.b1, `CPA-${tag}`, { groupId: ids.group }),
    bk(ids.b2, `CPB-${tag}`, { groupId: ids.group }),
    bk(ids.b3, `CPC-${tag}`),
    bk(ids.inHouse, `CPD-${tag}`, { status: "CHECKED_IN", assignedRoom: ids.room, checkInDate: day(addDays(today, -1)), checkOutDate: day(addDays(today, 1)) }),
    bk(ids.out, `CPE-${tag}`, { status: "CHECKED_OUT", checkInDate: day(addDays(today, -5)), checkOutDate: day(addDays(today, -3)) }),
    bk(ids.staffBooking, `CPF-${tag}`, { guestDetails: { firstName: "Staff", lastName: "Own", email: `cp-rcp-${tag}@test.local`, phone: "9000011111" } }),
  ]);
  await db().collection("folios").insertOne({ _id: ids.folio, propertyId: P, booking: ids.inHouse, guest: oid(), room: ids.room, checkInDate: now, checkOutDate: now, status: "OPEN", totalCharges: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0, totalDiscounts: 0, totalPaid: 0, totalAdvanceAdjusted: 0, balance: 0, createdAt: now, updatedAt: now });
  await db().collection("foliolines").insertMany([
    { folio: ids.folio, booking: ids.inHouse, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff (1 night)", amount: 2000, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.inHouse, lineType: "TAX_CGST", direction: "DEBIT", description: "CGST", amount: 50, date: now, postedAt: now, postedBy: "test" },
    { folio: ids.folio, booking: ids.inHouse, lineType: "TAX_SGST", direction: "DEBIT", description: "SGST", amount: 50, date: now, postedAt: now, postedBy: "test" },
  ]);
});

afterAll(async () => {
  const bookingIds = [ids.b1, ids.b2, ids.b3, ids.inHouse, ids.out, ids.staffBooking];
  const created = await db().collection("users").find({ email: guestEmail }).toArray();
  const userIds = [...Object.values(staff), other, ...created.map((x) => x._id)];
  await db().collection("bookingchangerequests").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("reviews").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("payments").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("foliolines").deleteMany({ booking: { $in: bookingIds } });
  await db().collection("folios").deleteMany({ _id: ids.folio });
  await db().collection("bookings").deleteMany({ _id: { $in: bookingIds } });
  await db().collection("rooms").deleteMany({ _id: ids.room });
  await db().collection("roomcategories").deleteMany({ _id: ids.category });
  await db().collection("refreshtokens").deleteMany({ user: { $in: userIds } });
  await db().collection("users").deleteMany({ _id: { $in: userIds } });
  await new Promise((r) => server.close(r));
});

describe("Customer portal", () => {
  it("refuses a wrong mobile with the same message as an unknown booking", async () => {
    const wrong = await call("", "POST", "/api/auth/booking-login", { bookingReference: `CPA-${tag}`, mobile: "9999999999" });
    const unknown = await call("", "POST", "/api/auth/booking-login", { bookingReference: `NOPE-${tag}`, mobile });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.message).toBe(unknown.json.message);
  });

  it("signs in with booking number + mobile, creates the guest account and links the rooms booked together", async () => {
    const r = await call("", "POST", "/api/auth/booking-login", { bookingReference: `cpa-${tag}`, mobile: `0${mobile}` });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ role: "CUSTOMER", email: guestEmail });
    guestToken = r.json.data.token;
    const mine = await call(guestToken, "GET", "/api/bookings/my");
    const refs = (mine.json.data ?? []).map((b: any) => b.bookingReference);
    expect(refs).toEqual(expect.arrayContaining([`CPA-${tag}`, `CPB-${tag}`]));
    expect(refs).not.toContain(`CPC-${tag}`); // not booked together: needs its own proof
    // Signing in again reuses the same account.
    const again = await call("", "POST", "/api/auth/booking-login", { bookingReference: `CPB-${tag}`, mobile });
    expect(String(again.json.data._id)).toBe(String(r.json.data._id));
  });

  it("never turns a staff email into a guest account", async () => {
    const r = await call("", "POST", "/api/auth/booking-login", { bookingReference: `CPF-${tag}`, mobile: "9000011111" });
    expect(r.status).toBe(409);
  });

  it("adds other stays from the account with the same proof; a stay linked to someone else is refused", async () => {
    for (const ref of [`CPC-${tag}`, `CPD-${tag}`, `CPE-${tag}`]) {
      expect((await call(guestToken, "POST", "/api/customer/bookings/link", { bookingReference: ref, mobile })).status).toBe(200);
    }
    expect((await call(guestToken, "POST", "/api/customer/bookings/link", { bookingReference: `CPC-${tag}`, mobile: "9123456780" })).status).toBe(404);
    const otherTok = staffTok(other, "CUSTOMER");
    expect((await call(otherTok, "POST", "/api/customer/bookings/link", { bookingReference: `CPC-${tag}`, mobile })).status).toBe(409);
    expect((await call(otherTok, "GET", `/api/customer/bookings/${ids.b1}/balance`)).status).toBe(404);
  });

  it("keeps staff out of guest endpoints and guests out of staff ones", async () => {
    expect((await call(rcp(), "GET", `/api/customer/bookings/${ids.b1}/balance`)).status).toBe(403);
    expect((await call(guestToken, "GET", "/api/change-requests")).status).toBe(403);
  });

  it("pays the balance online before arrival: part-payment, no overpayment, recorded once", async () => {
    const bal = await call(guestToken, "GET", `/api/customer/bookings/${ids.b1}/balance`);
    expect(bal.json.data).toMatchObject({ amountDue: 4200, basis: "BOOKING", gateway: "DEMO" });
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b1}/pay/order`, {})).json.data).toMatchObject({ demo: true, amount: 4200 });
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b1}/pay/demo`, { amount: 5000 })).status).toBe(400);
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b1}/pay/demo`, { amount: 1200 })).status).toBe(200);
    expect((await call(guestToken, "GET", `/api/customer/bookings/${ids.b1}/balance`)).json.data.amountDue).toBe(3000);
    expect((await db().collection("bookings").findOne({ _id: ids.b1 }))!.paymentStatus).toBe("PARTIAL");
    await call(guestToken, "POST", `/api/customer/bookings/${ids.b1}/pay/demo`, {});
    expect((await call(guestToken, "GET", `/api/customer/bookings/${ids.b1}/balance`)).json.data.amountDue).toBe(0);
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b1}/pay/demo`, {})).status).toBe(409);
  });

  it("pays an in-house balance onto the open folio", async () => {
    const bal = await call(guestToken, "GET", `/api/customer/bookings/${ids.inHouse}/balance`);
    expect(bal.json.data).toMatchObject({ amountDue: 2100, basis: "FOLIO" });
    const paid = await call(guestToken, "POST", `/api/customer/bookings/${ids.inHouse}/pay/demo`, {});
    expect(paid.status).toBe(200);
    const line = await db().collection("foliolines").findOne({ folio: ids.folio, lineType: "PAYMENT" });
    expect(line?.amount).toBe(2100);
    expect((await call(guestToken, "GET", `/api/customer/bookings/${ids.inHouse}/balance`)).json.data.amountDue).toBe(0);
  });

  it("change request: guest asks, Reception sees it and decides; one open request at a time", async () => {
    const today = todayBusinessDate();
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b3}/change-request`, { checkInDate: addDays(today, -1) })).status).toBe(400);
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b3}/change-request`, {})).status).toBe(400);
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.out}/change-request`, { adults: 1 })).status).toBe(409);
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.inHouse}/change-request`, { checkInDate: today })).status).toBe(400);
    const r = await call(guestToken, "POST", `/api/customer/bookings/${ids.b3}/change-request`, { checkOutDate: addDays(today, 13), note: "One more night please" });
    expect(r.status).toBe(201);
    expect((await call(guestToken, "POST", `/api/customer/bookings/${ids.b3}/change-request`, { adults: 1 })).status).toBe(409);

    expect((await call(staffTok(staff.housekeeping, "HOUSEKEEPING"), "GET", "/api/change-requests")).status).toBe(403);
    const list = await call(rcp(), "GET", "/api/change-requests");
    expect(list.json.data.some((x: any) => String(x._id) === String(r.json.data._id))).toBe(true);
    expect((await call(rcp(), "GET", "/api/change-requests/counts")).json.data.pending).toBeGreaterThanOrEqual(1);
    expect((await call(rcp(), "POST", `/api/change-requests/${r.json.data._id}/decline`, {})).status).toBe(400);
    expect((await call(rcp(), "POST", `/api/change-requests/${r.json.data._id}/decline`, { note: "Sold out that night" })).status).toBe(200);
    expect((await call(guestToken, "POST", `/api/customer/change-requests/${r.json.data._id}/withdraw`)).status).toBe(409);
    const mine = await call(guestToken, "GET", `/api/customer/change-requests?bookingId=${ids.b3}`);
    expect(mine.json.data[0]).toMatchObject({ status: "DECLINED", responseNote: "Sold out that night" });

    const second = await call(guestToken, "POST", `/api/customer/bookings/${ids.b3}/change-request`, { adults: 1 });
    expect(second.status).toBe(201);
    expect((await call(staffTok(other, "CUSTOMER"), "POST", `/api/customer/change-requests/${second.json.data._id}/withdraw`)).status).toBe(409);
    expect((await call(guestToken, "POST", `/api/customer/change-requests/${second.json.data._id}/withdraw`)).status).toBe(200);
  });

  it("reviews only a completed stay", async () => {
    expect((await call(guestToken, "POST", "/api/reviews", { bookingId: String(ids.b3), rating: 5, title: "Great", comment: "Lovely stay, very clean rooms" })).status).toBe(400);
    const ok = await call(guestToken, "POST", "/api/reviews", { bookingId: String(ids.out), rating: 5, title: "Great", comment: "Lovely stay, very clean rooms" });
    expect(ok.status).toBe(201);
  });

  it("profile: saves ID / GST details and never returns the password hash", async () => {
    const r = await call(guestToken, "PATCH", "/api/auth/profile", { savedDetails: { city: "Coimbatore", idType: "AADHAAR", idNumber: "1234", gstin: "33abcde1234f1z5" } });
    expect(r.status).toBe(200);
    expect(r.json.data.passwordHash).toBeUndefined();
    expect(r.json.data.savedDetails).toMatchObject({ city: "Coimbatore", gstin: "33ABCDE1234F1Z5" });
    expect((await call(guestToken, "PATCH", "/api/auth/profile", { savedDetails: { gstin: "BAD" } })).status).toBe(400);
  });

  it("change password needs the current one", async () => {
    const otherTok = staffTok(other, "CUSTOMER");
    expect((await call(otherTok, "POST", "/api/auth/change-password", { currentPassword: "wrong", newPassword: "NewPass12345" })).status).toBe(400);
    expect((await call(otherTok, "POST", "/api/auth/change-password", { currentPassword: "OtherPass123", newPassword: "short" })).status).toBe(400);
    expect((await call(otherTok, "POST", "/api/auth/change-password", { currentPassword: "OtherPass123", newPassword: "NewPass12345" })).status).toBe(200);
    const login = await call("", "POST", "/api/auth/login", { email: `cp-other-${tag}@guest.test`, password: "NewPass12345" });
    expect(login.status).toBe(200);
  });
});
