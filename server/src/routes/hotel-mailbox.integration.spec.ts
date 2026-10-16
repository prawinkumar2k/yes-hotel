/**
 * The hotel has one mailbox (bookings@yeshotels.in, the Settings email). Staff sign-in names are not
 * mailboxes: new-enquiry alerts go to the Settings email only, and "forgot password" emails a link
 * to guests only — never to a staff account.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { createServer } from "../../index";

const tag = new mongoose.Types.ObjectId().toString().slice(-6);
const staffId = new mongoose.Types.ObjectId();
const guestId = new mongoose.Types.ObjectId();
const staffEmail = `mailbox-staff-${tag}@example.com`;
const guestEmail = `mailbox-guest-${tag}@example.com`;
const leadEmail = `mailbox-lead-${tag}@example.com`;
const phone = `97${tag.replace(/[a-f]/g, "3")}44`.slice(0, 10);
let server: Server;
let base = "";
let hotelEmail = "";
const db = () => mongoose.connection.db!;
const post = async (path: string, body: unknown) => (await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  hotelEmail = String((await db().collection("hotelsettings").findOne({}))?.email || "").toLowerCase();
  await db().collection("users").insertMany([
    { _id: staffId, role: "RECEPTIONIST", firstName: "Mail", lastName: "Staff", email: staffEmail, passwordHash: "x", isActive: true },
    { _id: guestId, role: "CUSTOMER", firstName: "Mail", lastName: "Guest", email: guestEmail, passwordHash: "x", isActive: true },
  ]);
});

afterAll(async () => {
  await db().collection("notificationlogs").deleteMany({ $or: [{ recipientEmail: { $in: [staffEmail, guestEmail] } }, { body: { $regex: tag } }] });
  await db().collection("passwordresettokens").deleteMany({ userId: { $in: [staffId, guestId] } });
  await db().collection("bookingenquiries").deleteMany({ phone });
  await db().collection("users").deleteMany({ _id: { $in: [staffId, guestId] } });
  await new Promise((r) => server.close(r));
});

const logsTo = (email: string, type: string) => db().collection("notificationlogs").countDocuments({ recipientEmail: email, type });
const waitFor = async (pred: () => Promise<boolean>) => {
  for (let i = 0; i < 80; i++) { if (await pred()) return; await new Promise((r) => setTimeout(r, 25)); }
};

describe("Hotel mailbox", () => {
  it("a new enquiry alerts the hotel mailbox, not staff sign-in names", async () => {
    expect(await post("/api/booking-enquiry", { guestName: `Lead ${tag}`, email: leadEmail, phone, checkIn: "2026-12-10", checkOut: "2026-12-11", source: "WEBSITE", bookingStage: "WEBSITE_GUEST_DETAILS" })).toBe(201);
    if (hotelEmail) await waitFor(async () => (await logsTo(hotelEmail, "BOOKING_ENQUIRY")) > 0);
    const alerts = await db().collection("notificationlogs").find({ type: "BOOKING_ENQUIRY", body: { $regex: `Lead ${tag}` } }).toArray();
    expect(alerts.every((a) => a.recipientEmail !== staffEmail)).toBe(true);
    if (hotelEmail) expect(alerts.some((a) => a.recipientEmail === hotelEmail)).toBe(true);
  });

  it("forgot password emails a guest their link", async () => {
    expect(await post("/api/auth/forgot-password", { email: guestEmail })).toBe(200);
    expect(await logsTo(guestEmail, "PASSWORD_RESET")).toBe(1);
  });

  it("forgot password never emails a staff account", async () => {
    expect(await post("/api/auth/forgot-password", { email: staffEmail })).toBe(200);
    expect(await logsTo(staffEmail, "PASSWORD_RESET")).toBe(0);
    expect(await db().collection("passwordresettokens").countDocuments({ userId: staffId })).toBe(0);
  });
});
