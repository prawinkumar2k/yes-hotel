/**
 * A confirmed reservation that has no room yet (typically a website booking) must be visible to staff:
 * on the Front Desk "Unassigned" list (today and the next 14 days) and on the Calendar's reservation list.
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
const user = oid();
const soon = oid();
const far = oid();
const today = todayBusinessDate();
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const get = async (path: string) => {
  const token = jwt.sign({ id: String(user), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, json: (await r.json()) as any };
};

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  await db().collection("users").insertOne({ _id: user, role: "ADMIN", firstName: "Un", lastName: tag, email: `un-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  const b = (id: mongoose.Types.ObjectId, ref: string, inDay: number) => db().collection("bookings").insertOne({
    _id: id, bookingReference: ref, propertyId: P, status: "CONFIRMED", source: "DIRECT_WEBSITE", paymentStatus: "PAID", totalAmount: 13000, adults: 2, children: 0,
    guestDetails: { firstName: "Web", lastName: tag, phone: "9000000055" }, checkInDate: new Date(`${addDays(today, inDay)}T00:00:00+05:30`), checkOutDate: new Date(`${addDays(today, inDay + 2)}T00:00:00+05:30`),
  });
  await b(soon, `UN-SOON-${tag}`, 1);
  await b(far, `UN-FAR-${tag}`, 40);
});

afterAll(async () => {
  await db().collection("bookings").deleteMany({ _id: { $in: [soon, far] } });
  await db().collection("users").deleteMany({ _id: user });
  await new Promise((r) => server.close(r));
});

describe("reservations without a room are visible", () => {
  it("Front Desk lists a reservation arriving soon (not only today), and counts it; a far-off one is left out", async () => {
    const r = await get("/api/front-desk/summary");
    expect(r.status).toBe(200);
    const refs = r.json.data.unassignedBookings.map((b: any) => b.bookingReference);
    expect(refs).toContain(`UN-SOON-${tag}`);
    expect(refs).not.toContain(`UN-FAR-${tag}`);
    expect(r.json.data.counts.unassignedBookings).toBe(r.json.data.unassignedBookings.length);
  });

  it("the Calendar API returns the reservation so the page can list it", async () => {
    const r = await get(`/api/admin/calendar?start=${new Date(`${today}T00:00:00+05:30`).toISOString()}&end=${new Date(`${addDays(today, 13)}T00:00:00+05:30`).toISOString()}`);
    expect(r.status).toBe(200);
    expect(r.json.data.bookings.map((b: any) => b.bookingReference)).toContain(`UN-SOON-${tag}`);
  });
});
