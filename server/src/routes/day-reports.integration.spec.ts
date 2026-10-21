/**
 * Day Summary and the Check-in / Check-out / Day-use reports count what actually happened on the
 * day (check-in time, check-out time), and keep showing it after the guest has checked out.
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
const today = todayBusinessDate();
const yesterday = addDays(today, -1);
let server: Server;
let base = "";
let P: mongoose.Types.ObjectId;
const db = () => mongoose.connection.db!;
const ids: Record<string, mongoose.Types.ObjectId> = { stay: oid(), dayuse: oid(), arrivalOnly: oid(), advBooking: oid(), ota: oid(), cat: oid() };
const get = async (path: string) => {
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${jwt.sign({ id: String(user), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" })}` } });
  return { status: res.status, json: (await res.json()) as any };
};
const booking = (key: string, extra: Record<string, unknown>) => ({
  _id: ids[key], bookingReference: `DR-${tag}-${key}`, propertyId: P, roomCategory: ids.cat,
  guestDetails: { firstName: key, lastName: tag, phone: "9000000000", email: "" },
  adults: 2, children: 0, totalAmount: 1500, taxAmount: 160, source: "WALK_IN", stayType: "NIGHTLY", paymentStatus: "UNPAID", ...extra,
});

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  await db().collection("users").insertOne({ _id: user, role: "RECEPTIONIST", firstName: "Rep", lastName: tag, email: `rep-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  const noon = (ymd: string, h: number) => new Date(`${ymd}T${String(h).padStart(2, "0")}:00:00+05:30`);
  await db().collection("bookings").insertMany([
    // arrived yesterday, left today: a check-out today, NOT a check-in today
    booking("stay", { status: "CHECKED_OUT", checkInDate: new Date(yesterday), checkOutDate: new Date(today), checkedInAt: noon(yesterday, 14), checkedOutAt: noon(today, 10) }),
    // arrives today and is still in-house: a check-in today
    booking("arrivalOnly", { status: "CHECKED_IN", checkInDate: new Date(today), checkOutDate: new Date(addDays(today, 1)), checkedInAt: noon(today, 13) }),
    // hourly stay today, already checked out
    booking("dayuse", { status: "CHECKED_OUT", stayType: "HOURLY", hours: 4, checkInDate: new Date(today), checkOutDate: new Date(today), checkedInAt: noon(today, 9), checkedOutAt: noon(today, 13) }),
    // arrived today through MakeMyTrip: the reports say which OTA
    booking("ota", { status: "CHECKED_IN", source: "OTA", otaName: "MakeMyTrip", otaConfirmationNumber: "MMT-TEST", checkInDate: new Date(today), checkOutDate: new Date(addDays(today, 1)), checkedInAt: noon(today, 15) }),
    // future arrival that received an advance today
    booking("advBooking", { status: "CONFIRMED", checkInDate: new Date(addDays(today, 5)), checkOutDate: new Date(addDays(today, 6)) }),
  ]);
  await db().collection("advancepayments").insertOne({ _id: oid(), advanceNumber: `ADV-DR-${tag}`, propertyId: P, booking: ids.advBooking, guest: oid(), amount: 2000, method: "UPI", status: "RECEIVED", totalAdjusted: 0, totalRefunded: 0, remainingBalance: 2000, receivedAt: new Date(), createdAt: new Date() });
});

afterAll(async () => {
  await db().collection("bookings").deleteMany({ _id: { $in: Object.values(ids) } });
  await db().collection("advancepayments").deleteMany({ advanceNumber: `ADV-DR-${tag}` });
  await db().collection("users").deleteMany({ _id: user });
  await new Promise((r) => server.close(r));
});

describe("day reports after check-out", () => {
  it("check-in report lists the guest who arrived today, and the one who has since checked out", async () => {
    const y = await get(`/api/reports/ops/check-ins?from=${yesterday}&to=${today}`);
    const refs = y.json.data.rows.map((r: any) => r.bookingReference);
    expect(refs).toEqual(expect.arrayContaining([`DR-${tag}-stay`, `DR-${tag}-arrivalOnly`, `DR-${tag}-dayuse`]));
  });

  it("check-out report lists both departures today", async () => {
    const r = await get(`/api/reports/ops/check-outs?from=${today}&to=${today}`);
    const refs = r.json.data.rows.map((x: any) => x.bookingReference);
    expect(refs).toEqual(expect.arrayContaining([`DR-${tag}-stay`, `DR-${tag}-dayuse`]));
  });

  it("day-use report lists the hourly stay after it ended", async () => {
    const r = await get(`/api/reports/ops/day-use-sales?from=${today}&to=${today}`);
    expect(r.json.data.rows.map((x: any) => x.bookingReference)).toContain(`DR-${tag}-dayuse`);
  });

  it("Day Summary counts actual check-ins, check-outs, day-use and the advance received today", async () => {
    const r = await get(`/api/reports/day-summary?date=${today}`);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const d = r.json.data;
    // other data may exist in the test database: at least ours
    expect(d.checkIns).toBeGreaterThanOrEqual(2); // arrivalOnly + dayuse (the other guest arrived yesterday)
    expect(d.checkOuts).toBeGreaterThanOrEqual(2); // stay + dayuse
    expect(d.dayUses).toBeGreaterThanOrEqual(1);
    expect(d.resrvAdv).toBeGreaterThanOrEqual(2000);
    expect(d.paymentModes.UPI).toBeGreaterThanOrEqual(2000);
  });

  it("OTA bookings name the OTA in the check-in report and the day sheet", async () => {
    const ci = await get(`/api/reports/ops/check-ins?from=${today}&to=${today}`);
    const row = ci.json.data.rows.find((r: any) => r.bookingReference === `DR-${tag}-ota`);
    expect(row.source).toBe("OTA - MakeMyTrip");
    expect(row.otaConfirmation).toBe("MMT-TEST");
    const ds = await get(`/api/reports/day-summary?date=${today}`);
    expect(ds.json.data.otaMmt).toBeGreaterThanOrEqual(1);
    const co = await get(`/api/reports/ops/check-outs?from=${today}&to=${today}`);
    expect(co.json.data.rows.every((r: any) => "source" in r)).toBe(true);
  });

  it("Day Summary for yesterday counts the stay's check-in", async () => {
    const r = await get(`/api/reports/day-summary?date=${yesterday}`);
    expect(r.json.data.checkIns).toBeGreaterThanOrEqual(1);
  });
});
