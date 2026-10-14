/**
 * OTA bookings are entered by hand from New Booking (Booking Source: OTA):
 *   OTA name, confirmation number, commission % and who collects the money are required and stored;
 *   commission / net settlement are worked out; the booking shows on the OTA list and is found by
 *   its OTA confirmation number. Online "sync" is refused.
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
const reception = oid();
const admin = oid();
const ids = { category: oid(), room: oid() };
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = (asAdmin = false) => jwt.sign({ id: String(asAdmin ? admin : reception), role: asAdmin ? "ADMIN" : "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const today = todayBusinessDate();

async function call(method: string, path: string, body?: unknown, asAdmin = false) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tok(asAdmin)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

const registration = (extra: Record<string, unknown>) => ({
  firstName: "Ota",
  lastName: "Guest",
  guestName: "Ota Guest",
  email: `ota-${tag}@test.local`,
  mobile: "9000000099",
  idType: "AADHAAR",
  idNumber: "1234",
  checkIn: today,
  checkOut: addDays(today, 1),
  adults: 1,
  roomId: String(ids.room),
  roomIds: [String(ids.room)],
  roomRates: { [String(ids.room)]: 3000 },
  billingInstruction: "OTA",
  ...extra,
});

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertOne({ _id: admin, role: "ADMIN", firstName: "Ota", lastName: "Adm", email: `ota-adm-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Ota", lastName: "Rcp", email: `ota-rcp-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: ids.category, slug: `ota-${tag}`, name: `Ota ${tag}`, description: "test", basePrice: 3000, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("rooms").insertOne({ _id: ids.room, propertyId: P, roomNumber: `O${tag}`, category: ids.category, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
});

afterAll(async () => {
  const bookings = await db().collection("bookings").find({ assignedRoom: ids.room }).project({ _id: 1, guest: 1 }).toArray();
  const bIds = bookings.map((b) => b._id);
  await db().collection("folios").deleteMany({ booking: { $in: bIds } });
  await db().collection("foliolines").deleteMany({ booking: { $in: bIds } });
  await db().collection("roomnights").deleteMany({ booking: { $in: bIds } });
  await db().collection("bookings").deleteMany({ _id: { $in: bIds } });
  await db().collection("guests").deleteMany({ email: `ota-${tag}@test.local` });
  await db().collection("bookinginventorydays").deleteMany({ roomCategory: ids.category });
  await db().collection("rooms").deleteMany({ _id: ids.room });
  await db().collection("roomcategories").deleteMany({ _id: ids.category });
  await db().collection("users").deleteMany({ _id: { $in: [reception, admin] } });
  await new Promise((r) => server.close(r));
});

describe("OTA bookings entered by hand", () => {
  it("requires the OTA, its confirmation number, commission and who collects", async () => {
    const r = await call("POST", "/api/front-desk/registration/walk-in", registration({ bookingSource: "OTA", otaName: "MakeMyTrip", otaCommissionPercent: 18, otaPaymentModel: "OTA_PREPAID" }));
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/confirmation number/i);
  });

  it("stores the OTA details and works out the commission", async () => {
    const r = await call("POST", "/api/front-desk/registration/walk-in", registration({
      bookingSource: "OTA", otaName: "MakeMyTrip", otaConfirmationNumber: `NH${tag}`, otaCommissionPercent: 18, otaPaymentModel: "OTA_PREPAID",
    }));
    expect(r.status).toBeLessThan(300);
    const b = await db().collection("bookings").findOne({ assignedRoom: ids.room });
    expect(b).toMatchObject({ source: "OTA", otaName: "MakeMyTrip", otaConfirmationNumber: `NH${tag}`, otaCommissionPercent: 18, otaPaymentModel: "OTA_PREPAID" });
    expect(b!.otaCommissionAmount).toBe(540); // 18% of the ₹3,000 pre-tax room amount
    expect(b!.otaReceivable).toBeGreaterThan(0);

    const list = await call("GET", `/api/admin/bookings?source=OTA&search=NH${tag}`);
    expect((list.json.data?.bookings ?? []).some((x: any) => x.otaConfirmationNumber === `NH${tag}`)).toBe(true);
  });

  it("refuses online OTA sync", async () => {
    expect((await call("POST", `/api/properties/channels/${oid()}/sync`, {}, true)).status).toBe(410);
  });
});
