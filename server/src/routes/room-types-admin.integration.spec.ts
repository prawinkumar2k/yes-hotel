/**
 * Admin rearranges room types without a developer:
 *   change a type's rate → guests see the new rate; move a room to another type; a type that
 *   still has rooms can't be deleted; once empty, a type with past bookings is switched off
 *   (hidden from the website) instead of deleted; a room with booking history is archived,
 *   never deleted.
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
const admin = oid();
const ids = { deluxe: oid(), suite: oid(), r1: oid(), r2: oid(), past: oid() };
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(admin), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertOne({ _id: admin, role: "ADMIN", firstName: "Rt", lastName: "Admin", email: `rt-admin-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  const cat = (_id: mongoose.Types.ObjectId, name: string, price: number) => ({ _id, name, slug: `${name.toLowerCase().replace(/\s/g, "-")}-${tag}`, description: "test", basePrice: price, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("roomcategories").insertMany([cat(ids.deluxe, `Deluxe ${tag}`, 1800), cat(ids.suite, `Suite ${tag}`, 5000)]);
  const room = (_id: mongoose.Types.ObjectId, n: string, category: mongoose.Types.ObjectId) => ({ _id, propertyId: P, roomNumber: n, category, floor: "4", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE" });
  await db().collection("rooms").insertMany([room(ids.r1, `S1${tag}`, ids.suite), room(ids.r2, `S2${tag}`, ids.suite)]);
  const now = new Date();
  await db().collection("bookings").insertOne({ _id: ids.past, propertyId: P, bookingReference: `RT-${tag}`, source: "WALK_IN", status: "CHECKED_OUT", roomCategory: ids.suite, assignedRoom: ids.r2, guestDetails: { firstName: "Past", lastName: "Guest", email: `rt-${tag}@test.local`, phone: "9000000044" }, checkInDate: now, checkOutDate: now, adults: 1, children: 0, totalAmount: 5250, taxAmount: 250, createdAt: now, updatedAt: now });
});

afterAll(async () => {
  await db().collection("bookings").deleteMany({ _id: ids.past });
  await db().collection("rooms").deleteMany({ _id: { $in: [ids.r1, ids.r2] } });
  await db().collection("roomcategories").deleteMany({ _id: { $in: [ids.deluxe, ids.suite] } });
  await db().collection("users").deleteMany({ _id: admin });
  await new Promise((r) => server.close(r));
});

describe("Admin manages room types", () => {
  it("changes a room type's rate; the website shows it", async () => {
    expect((await call("PATCH", `/api/admin/room-categories/${ids.deluxe}`, { basePrice: 1950 })).status).toBe(200);
    const pub = await call("GET", "/api/rooms/categories");
    expect(pub.json.data.find((c: any) => c._id === String(ids.deluxe))?.basePrice).toBe(1950);
  });

  it("refuses to delete a room type that still has rooms", async () => {
    const r = await call("DELETE", `/api/admin/room-categories/${ids.suite}`);
    expect(r.status).toBe(409);
    expect(r.json.message).toMatch(/still has 2 rooms/);
  });

  it("moves rooms to another type", async () => {
    for (const id of [ids.r1, ids.r2]) expect((await call("PATCH", `/api/rooms/${id}`, { category: String(ids.deluxe) })).status).toBe(200);
    expect(await db().collection("rooms").countDocuments({ category: ids.deluxe })).toBe(2);
  });

  it("an empty type with past bookings is switched off, not deleted, and hidden from guests", async () => {
    const r = await call("DELETE", `/api/admin/room-categories/${ids.suite}`);
    expect(r.status).toBe(200);
    const still = await db().collection("roomcategories").findOne({ _id: ids.suite });
    expect(still?.isActive).toBe(false);
    const pub = await call("GET", "/api/rooms/categories");
    expect(pub.json.data.some((c: any) => c._id === String(ids.suite))).toBe(false);
  });

  it("a room with booking history is archived, never deleted", async () => {
    const r = await call("DELETE", `/api/rooms/${ids.r2}`);
    expect(r.status).toBe(200);
    expect(await db().collection("rooms").countDocuments({ _id: ids.r2 })).toBe(1);
    const unused = await call("DELETE", `/api/rooms/${ids.r1}`);
    expect(unused.status).toBe(200);
    expect(await db().collection("rooms").countDocuments({ _id: ids.r1 })).toBe(0);
  });
});
