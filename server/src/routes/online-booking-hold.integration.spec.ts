/** Website bookings are accepted only while Admin → Settings has online booking switched on; otherwise they are on hold. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { createServer } from "../../index";

let server: Server;
let base = "";
let before: any = null;
const db = () => mongoose.connection.db!;
const setFlag = (v: boolean | null) => db().collection("hotelsettings").updateMany({}, v === null ? { $unset: { onlineBookingOpen: "" } } : { $set: { onlineBookingOpen: v } });
const book = () => fetch(base + "/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  before = await db().collection("hotelsettings").findOne({});
});
afterAll(async () => {
  if (before) await db().collection("hotelsettings").updateMany({}, before.onlineBookingOpen === undefined ? { $unset: { onlineBookingOpen: "" } } : { $set: { onlineBookingOpen: before.onlineBookingOpen } });
  await new Promise((r) => server.close(r));
});

describe("online booking on hold", () => {
  it("never switched on: a website booking is refused with a clear message", async () => {
    await setFlag(null);
    const r = await book();
    expect(r.status).toBe(503);
    const j: any = await r.json();
    expect(j.code).toBe("ONLINE_BOOKING_ON_HOLD");
    expect(j.message).toMatch(/call us/i);
  });
  it("switched off: refused; public settings say so", async () => {
    await setFlag(false);
    expect((await book()).status).toBe(503);
    const s: any = await (await fetch(base + "/api/public/settings")).json();
    expect(s.data.onlineBookingOpen).toBe(false);
  });
  it("switched on: the request reaches normal validation (400 for an empty body)", async () => {
    await setFlag(true);
    expect((await book()).status).toBe(400);
  });
});
