/**
 * Check-in of a reserved booking collects the same guest details and ID documents as a walk-in registration,
 * and every new booking number uses one common format.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { addDays, todayBusinessDate } from "../../../shared/dates";
import { generateBookingReference } from "../utils/booking-reference";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const cat = oid();
const rooms = [oid(), oid()];
const bookings = [oid(), oid()];
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const today = todayBusinessDate();
const db = () => mongoose.connection.db!;
const photo = "data:image/jpeg;base64," + Buffer.from("fake-jpeg-bytes").toString("base64");
const call = async (id: mongoose.Types.ObjectId, body: Record<string, unknown>) => {
  const r = await fetch(`${base}/api/bookings/${id}/check-in`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" })}` }, body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
};

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Ci", lastName: tag, email: `ci-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertOne({ _id: cat, slug: `ci-${tag}`, name: `CI ${tag}`, description: "t", basePrice: 1500, isActive: true, capacity: { adults: 2, children: 0 } });
  for (const [i, r] of rooms.entries()) {
    await db().collection("rooms").insertOne({ _id: r, propertyId: P, roomNumber: `C${i}${tag}`, category: cat, floor: "1", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE", isActive: true });
  }
  for (const [i, b] of bookings.entries()) {
    await db().collection("bookings").insertOne({
      _id: b, bookingReference: `CI-${tag}-${i}`, propertyId: P, roomCategory: cat, status: "CONFIRMED", source: "ADMIN", bookingType: "INDIVIDUAL",
      guestDetails: { firstName: "Reserved", lastName: `${tag}${i}`, phone: `90000${tag.replace(/\D/g, "7").padEnd(5, "1").slice(0, 5)}`, email: "" },
      checkInDate: new Date(today), checkOutDate: new Date(addDays(today, 1)), adults: 2, children: 0, totalAmount: 1575, taxAmount: 75, ratePerNight: 1500, paymentStatus: "UNPAID",
    });
  }
});

afterAll(async () => {
  const folios = await db().collection("folios").find({ booking: { $in: bookings } }).project({ _id: 1 }).toArray();
  await db().collection("foliolines").deleteMany({ folio: { $in: folios.map((f) => f._id) } });
  await db().collection("folios").deleteMany({ booking: { $in: bookings } });
  await db().collection("roomnights").deleteMany({ $or: [{ booking: { $in: bookings } }, { room: { $in: rooms } }] });
  await db().collection("bookings").deleteMany({ _id: { $in: bookings } });
  await db().collection("rooms").deleteMany({ _id: { $in: rooms } });
  await db().collection("roomcategories").deleteMany({ _id: cat });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("check-in of a reserved booking", () => {
  it("refuses check-in without an ID type and number", async () => {
    const r = await call(bookings[0], { roomId: String(rooms[0]) });
    expect(r.status).toBe(400);
    expect(String(r.json.message)).toMatch(/ID type and ID number/i);
  });

  it("refuses an ID document that is not an image", async () => {
    const r = await call(bookings[0], { roomId: String(rooms[0]), idType: "AADHAAR", idNumber: "123412341234", idProofImages: ["not-an-image"] });
    expect(r.status).toBe(400);
  });

  it("saves the details and ID documents the walk-in registration collects", async () => {
    const r = await call(bookings[0], {
      roomId: String(rooms[0]), idType: "DRIVING_LICENSE", idNumber: "AP02620110042064", idProofImages: [photo], idProofPhoto: photo,
      nationality: "Indian", address: "Advaita Blossom, Chennai", dateOfBirth: "1990-05-04", gender: "MALE", organization: "Acme", designation: "Engineer",
      purposeOfVisit: "BUSINESS", proceedingTo: "Hosur", vehicleNumber: "tn09ab1234", gstin: "29abcde1234f1z5", email: "guest@example.com", emergencyPhone: "9876543210",
    });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const b: any = await db().collection("bookings").findOne({ _id: bookings[0] });
    expect(b.status).toBe("CHECKED_IN");
    expect(b.guestDetails).toMatchObject({
      idType: "DRIVING_LICENSE", idNumber: "AP02620110042064", nationality: "Indian", address: "Advaita Blossom, Chennai", gender: "MALE", organization: "Acme", designation: "Engineer",
      purposeOfVisit: "BUSINESS", proceedingTo: "Hosur", vehicleNumber: "TN09AB1234", gstin: "29ABCDE1234F1Z5", email: "guest@example.com", emergencyPhone: "9876543210",
    });
    expect(b.guestDetails.idProofImages).toEqual([photo]); // the same photo sent twice is kept once
    expect(new Date(b.guestDetails.dateOfBirth).toISOString().slice(0, 10)).toBe("1990-05-04");
  });

  it("foreign guest passport and visa details are saved too", async () => {
    const r = await call(bookings[1], {
      roomId: String(rooms[1]), idType: "PASSPORT", idNumber: "P1234567", nationality: "British",
      foreignGuestDetails: { passportNumber: "P1234567", passportIssuePlace: "London", passportIssueDate: "2020-01-01", passportExpiryDate: "2030-01-01", visaNumber: "V99" },
    });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const b: any = await db().collection("bookings").findOne({ _id: bookings[1] });
    expect(b.foreignGuestDetails).toMatchObject({ passportNumber: "P1234567", passportIssuePlace: "London", visaNumber: "V99" });
  });
});

describe("common booking numbers", () => {
  it("every new booking, whatever its source, gets the same YH-MMDD-NNN format", async () => {
    const a = await generateBookingReference("WALKIN");
    const b = await generateBookingReference("OTA");
    const c = await generateBookingReference("RES");
    for (const ref of [a, b, c]) expect(ref).toMatch(/^YH-\d{4}-\d{3,}$/);
  });
});
