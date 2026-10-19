/** Reception can run the whole housekeeping process: see the board, assign, clean, inspect, release. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const room = oid();
let P: mongoose.Types.ObjectId;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Rc", lastName: tag, email: `hkrc-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  const category = oid();
  await db().collection("roomcategories").insertOne({ _id: category, slug: `hkrc-${tag}`, name: `HKRC ${tag}`, description: "t", basePrice: 1000, isActive: true, capacity: { adults: 2, children: 0 } });
  await db().collection("rooms").insertOne({ _id: room, propertyId: P, roomNumber: `RC${tag}`, category, floor: "9", status: "CLEANING", occupancyStatus: "VACANT", housekeepingStatus: "DIRTY", sellStatus: "SELLABLE", isActive: true });
});

afterAll(async () => {
  const r: any = await db().collection("rooms").findOne({ _id: room });
  await db().collection("housekeepingtasks").deleteMany({ room });
  await db().collection("rooms").deleteMany({ _id: room });
  if (r) await db().collection("roomcategories").deleteMany({ _id: r.category });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r2) => server.close(r2));
});

describe("reception runs housekeeping", () => {
  it("opens the board and the room-centric dashboard (no Access Denied)", async () => {
    expect((await call("GET", "/api/admin/housekeeping")).status).toBe(200);
    expect((await call("GET", "/api/housekeeping/dashboard")).status).toBe(200);
  });

  it("moves a dirty room through clean → inspected → released", async () => {
    const steps = ["ASSIGNED", "CLEANING", "CLEANING_COMPLETED", "INSPECTION", "INSPECTED", "CLEAN"];
    const seen: string[] = [];
    for (const s of steps) {
      const r = await call("PATCH", `/api/housekeeping/rooms/${room}/status`, { status: s });
      seen.push(`${s}:${r.status}${r.status === 200 ? "" : " " + (r.json.message ?? "")}`);
    }
    expect(seen.every((x) => /:200$/.test(x)), seen.join(" | ")).toBe(true);
    const final: any = await db().collection("rooms").findOne({ _id: room });
    expect(final.housekeepingStatus).toBe("CLEAN");
  });
});
