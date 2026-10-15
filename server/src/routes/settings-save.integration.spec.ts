/**
 * Admin → Settings can be saved: valid 24-hour times pass, a bad time is refused, and the
 * hotel email shows on the public settings.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const admin = new mongoose.Types.ObjectId();
const tag = String(admin).slice(-6);
let server: Server;
let base = "";
let original: any = null;
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(admin), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  await db().collection("users").insertOne({ _id: admin, role: "ADMIN", firstName: "Set", lastName: "Admin", email: `set-admin-${tag}@test.local`, passwordHash: "x", isActive: true });
  original = (await call("GET", "/api/settings")).json.data;
});

afterAll(async () => {
  if (original) {
    const restore = { ...original };
    for (const k of ["_id", "__v", "createdAt", "updatedAt"]) delete restore[k];
    await call("PATCH", "/api/settings", restore);
  }
  await db().collection("users").deleteMany({ _id: admin });
  await new Promise((r) => server.close(r));
});

describe("Admin settings save", () => {
  it("saves valid times and the hotel email", async () => {
    const body = { ...original, email: "bookings@yeshotels.in", checkInTime: "12:00", checkOutTime: "11:00" };
    for (const k of ["_id", "__v", "createdAt", "updatedAt"]) delete body[k];
    const r = await call("PATCH", "/api/settings", body);
    expect(r.status).toBe(200);
    const pub = await call("GET", "/api/settings/public");
    expect(pub.json.data.email).toBe("bookings@yeshotels.in");
  });

  it("refuses a time that isn't 24-hour HH:MM", async () => {
    const body = { ...original, checkInTime: "12 PM" };
    for (const k of ["_id", "__v", "createdAt", "updatedAt"]) delete body[k];
    expect((await call("PATCH", "/api/settings", body)).status).toBe(400);
  });
});
