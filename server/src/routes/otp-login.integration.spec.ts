/**
 * Guest sign-in with an emailed 6-digit code:
 *   same reply for unknown, staff and guest emails (no account discovery); a code only for guests;
 *   wrong code counts an attempt; right code signs in, creates the guest account from their booking
 *   and links their bookings; a code works once; resending too soon is refused; 5 wrong tries lock it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { createServer } from "../../index";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const guestEmail = `otp-guest-${tag}@guest.test`;
const lockEmail = `otp-lock-${tag}@guest.test`;
const staffEmail = `otp-staff-${tag}@test.local`;
const ids = { b1: oid(), b2: oid(), b3: oid(), staff: oid(), category: oid() };
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
let logged: string[] = [];

async function call(path: string, body: unknown) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const lastCodeFor = (email: string) => {
  const line = [...logged].reverse().find((l) => l.includes(`sign-in code for ${email}`));
  return line?.match(/(\d{6})/)?.[1];
};

beforeAll(async () => {
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  vi.spyOn(console, "log").mockImplementation((...a: any[]) => { logged.push(a.join(" ")); });
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const now = new Date();
  const bk = (_id: mongoose.Types.ObjectId, ref: string, email: string) => ({
    _id, bookingReference: ref, source: "WALK_IN", status: "CHECKED_OUT", roomCategory: ids.category,
    guestDetails: { firstName: "Otp", lastName: "Guest", email, phone: "9000000033" },
    checkInDate: now, checkOutDate: now, adults: 1, children: 0, totalAmount: 1000, taxAmount: 50, createdAt: now, updatedAt: now,
  });
  await db().collection("bookings").insertMany([bk(ids.b1, `OTP1-${tag}`, guestEmail), bk(ids.b2, `OTP2-${tag}`, guestEmail), bk(ids.b3, `OTP3-${tag}`, lockEmail)]);
  await db().collection("users").insertOne({ _id: ids.staff, role: "RECEPTIONIST", firstName: "S", lastName: "T", email: staffEmail, passwordHash: "x", isActive: true });
});

afterAll(async () => {
  vi.restoreAllMocks();
  const emails = [guestEmail, lockEmail, staffEmail, `nobody-${tag}@guest.test`];
  await db().collection("loginotps").deleteMany({ email: { $in: emails } });
  await db().collection("bookings").deleteMany({ _id: { $in: [ids.b1, ids.b2, ids.b3] } });
  const users = await db().collection("users").find({ email: { $in: emails } }).toArray();
  await db().collection("refreshtokens").deleteMany({ user: { $in: users.map((u) => u._id) } });
  await db().collection("users").deleteMany({ email: { $in: emails } });
  await new Promise((r) => server.close(r));
});

describe("Email code sign-in", () => {
  it("answers the same for unknown, staff and guest emails, but only guests get a code", async () => {
    const unknown = await call("/api/auth/otp/request", { email: `nobody-${tag}@guest.test` });
    const staff = await call("/api/auth/otp/request", { email: staffEmail });
    const guest = await call("/api/auth/otp/request", { email: guestEmail.toUpperCase() });
    expect([unknown.status, staff.status, guest.status]).toEqual([200, 200, 200]);
    expect(unknown.json.message).toBe(guest.json.message);
    expect(staff.json.message).toBe(guest.json.message);
    expect(await db().collection("loginotps").countDocuments({ email: { $in: [`nobody-${tag}@guest.test`, staffEmail] } })).toBe(0);
    expect(await db().collection("loginotps").countDocuments({ email: guestEmail })).toBe(1);
    expect(lastCodeFor(guestEmail)).toMatch(/^\d{6}$/);
  });

  it("refuses a resend within a minute", async () => {
    expect((await call("/api/auth/otp/request", { email: guestEmail })).status).toBe(429);
  });

  it("a wrong code counts an attempt; the right code signs in and links the guest's bookings", async () => {
    const code = lastCodeFor(guestEmail)!;
    const wrong = code === "000000" ? "111111" : "000000";
    expect((await call("/api/auth/otp/verify", { email: guestEmail, code: wrong })).status).toBe(401);
    expect((await db().collection("loginotps").findOne({ email: guestEmail }))!.attempts).toBe(1);
    const ok = await call("/api/auth/otp/verify", { email: guestEmail, code });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ role: "CUSTOMER", email: guestEmail });
    expect(ok.json.data.token).toBeTruthy();
    const user = await db().collection("users").findOne({ email: guestEmail });
    expect(await db().collection("bookings").countDocuments({ _id: { $in: [ids.b1, ids.b2] }, customer: user!._id })).toBe(2);
    // a code works once
    expect((await call("/api/auth/otp/verify", { email: guestEmail, code })).status).toBe(401);
  });

  it("locks a code after 5 wrong tries", async () => {
    await call("/api/auth/otp/request", { email: lockEmail });
    const code = lastCodeFor(lockEmail)!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await call("/api/auth/otp/verify", { email: lockEmail, code: wrong })).status).toBe(401);
    expect((await call("/api/auth/otp/verify", { email: lockEmail, code })).status).toBe(429);
  });
});
