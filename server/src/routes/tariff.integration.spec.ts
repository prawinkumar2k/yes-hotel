/**
 * The hotel's real tariff rules (Delux and Executive): single / double price by adults, extra person and child rates
 * per room type, CP (breakfast) supplements, flat day-use prices (none for Executive), and flat early / late fees.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { addDays, todayBusinessDate } from "../../../shared/dates";
import { earlyLateFlatFee, mealPlanCharge } from "../services/tariff.service";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const reception = oid();
const ids = { delux: oid(), exec: oid(), rDelux: oid(), rDelux2: oid(), rExec: oid() };
let server: Server;
let base = "";
let settingsBefore: any = null;
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(reception), role: "RECEPTIONIST" }, getJwtSecret(), { expiresIn: "5m" });
const today = todayBusinessDate();
const calc = async (rooms: mongoose.Types.ObjectId[], extra: Record<string, unknown> = {}) => {
  const res = await fetch(base + "/api/front-desk/registration/calculate-rate", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: String(rooms[0]), roomIds: rooms.map(String), checkIn: today, checkOut: addDays(today, 1), adults: 2, mealPlan: "EP", ...extra }),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

const SETTINGS = {
  cpSingleSupplement: 200, cpDoubleSupplement: 300, extraBreakfastRate: 200,
  extraPersonRate: 800, extraBedRate: 1200, childRateNoBed: 400, childRateWithBed: 600,
  earlyLateFeeSingle: 800, earlyLateFeeDouble: 1000, earlyLateMaxHours: 6,
};

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  settingsBefore = await db().collection("hotelsettings").findOne({});
  if (!settingsBefore) await db().collection("hotelsettings").insertOne({ hotelName: "Test", phone: "1", address: "x", checkInTime: "12:00", checkOutTime: "11:00" });
  await db().collection("hotelsettings").updateMany({}, { $set: SETTINGS });
  await db().collection("users").insertOne({ _id: reception, role: "RECEPTIONIST", firstName: "Tar", lastName: "Rcp", email: `tar-${tag}@test.local`, passwordHash: "x", isActive: true, propertyId: P, propertyIds: [P] });
  await db().collection("roomcategories").insertMany([
    { _id: ids.delux, slug: `delux-${tag}`, name: `Delux ${tag}`, description: "t", basePrice: 2000, singleOccupancyPrice: 1800, isActive: true, capacity: { adults: 3, children: 0 },
      extraPersonRate: 700, extraBedRate: 1000, childRateNoBed: 500, childRateWithBed: 800, dayUseAllowed: true, dayUseSinglePrice: 1200, dayUseDoublePrice: 1600, dayUseMaxHours: 12 },
    { _id: ids.exec, slug: `exec-${tag}`, name: `Executive ${tag}`, description: "t", basePrice: 3000, singleOccupancyPrice: 2500, isActive: true, capacity: { adults: 2, children: 0 },
      extraPersonRate: 1000, extraBedRate: 1500, dayUseAllowed: false },
  ]);
  for (const [rid, no, cat] of [[ids.rDelux, `TD${tag}`, ids.delux], [ids.rDelux2, `TE${tag}`, ids.delux], [ids.rExec, `TX${tag}`, ids.exec]] as const) {
    await db().collection("rooms").insertOne({ _id: rid, propertyId: P, roomNumber: no, category: cat, floor: "9", status: "AVAILABLE", occupancyStatus: "VACANT", housekeepingStatus: "CLEAN", sellStatus: "SELLABLE" });
  }
});

afterAll(async () => {
  const keys = Object.fromEntries(Object.keys(SETTINGS).map((k) => [k, settingsBefore?.[k] ?? 0]));
  await db().collection("hotelsettings").updateMany({}, { $set: keys });
  await db().collection("rooms").deleteMany({ _id: { $in: [ids.rDelux, ids.rDelux2, ids.rExec] } });
  await db().collection("roomcategories").deleteMany({ _id: { $in: [ids.delux, ids.exec] } });
  await db().collection("users").deleteMany({ _id: reception });
  await new Promise((r) => server.close(r));
});

describe("tariff rules (pure)", () => {
  it("CP adds ₹200 for one adult, ₹300 for two, ₹200 for each extra person", () => {
    const s = SETTINGS;
    const base = { plan: "CP", children: 0, extraGuests: 0, roomCount: 1, nights: 1, settings: s, perPersonRates: { CP: 500 } };
    expect(mealPlanCharge({ ...base, adults: 1 })).toBe(200);
    expect(mealPlanCharge({ ...base, adults: 2 })).toBe(300);
    expect(mealPlanCharge({ ...base, adults: 2, extraGuests: 1 })).toBe(500);
    expect(mealPlanCharge({ ...base, adults: 3 })).toBe(500); // third adult is an extra person
    expect(mealPlanCharge({ ...base, adults: 3, roomCount: 2 })).toBe(500); // two rooms: one double + one single
    expect(mealPlanCharge({ ...base, adults: 2, nights: 3 })).toBe(900);
    expect(mealPlanCharge({ ...base, plan: "EP", adults: 2 })).toBe(0);
  });
  it("without CP supplements the per-person meal rate is used", () => {
    expect(mealPlanCharge({ plan: "CP", adults: 2, children: 1, extraGuests: 0, roomCount: 1, nights: 2, settings: {}, perPersonRates: { CP: 500 } })).toBe(3000);
  });
  it("early check-in / late check-out: flat by occupancy up to 6 hours", () => {
    expect(earlyLateFlatFee(SETTINGS, 1, 4)).toBe(800);
    expect(earlyLateFlatFee(SETTINGS, 2, 6)).toBe(1000);
    expect(earlyLateFlatFee(SETTINGS, 2, 7)).toBeUndefined();
    expect(earlyLateFlatFee({}, 1, 2)).toBeUndefined();
  });
});

describe("walk-in rate preview with the real tariff", () => {
  it("Delux: single ₹1,800, double ₹2,000; Executive: single ₹2,500, double ₹3,000", async () => {
    expect((await calc([ids.rDelux], { adults: 1 })).json.data.rooms[0].ratePerNight).toBe(1800);
    expect((await calc([ids.rDelux], { adults: 2 })).json.data.rooms[0].ratePerNight).toBe(2000);
    expect((await calc([ids.rExec], { adults: 1 })).json.data.rooms[0].ratePerNight).toBe(2500);
    expect((await calc([ids.rExec], { adults: 2 })).json.data.rooms[0].ratePerNight).toBe(3000);
  });

  it("extra person and child rates come from the room type (Delux 700 / 1,000 / 500 / 800, Executive 1,000 / 1,500)", async () => {
    const d = (await calc([ids.rDelux], { adults: 2, extraPersonsNoBed: 1, extraPersonsWithBed: 1, extraChildrenNoBed: 1, extraChildrenWithBed: 1 })).json.data;
    expect(d).toMatchObject({ extraPersonTotal: 700, extraBedTotal: 1000, childNoBedTotal: 500, childWithBedTotal: 800 });
    const e = (await calc([ids.rExec], { adults: 2, extraPersonsNoBed: 1, extraPersonsWithBed: 1 })).json.data;
    expect(e).toMatchObject({ extraPersonTotal: 1000, extraBedTotal: 1500 });
  });

  it("CP: single +₹200, double +₹300, extra person breakfast +₹200", async () => {
    expect((await calc([ids.rDelux], { adults: 1, mealPlan: "CP" })).json.data.mealPlanTotal).toBe(200);
    expect((await calc([ids.rDelux], { adults: 2, mealPlan: "CP" })).json.data.mealPlanTotal).toBe(300);
    expect((await calc([ids.rDelux], { adults: 2, mealPlan: "CP", extraPersonsNoBed: 1 })).json.data.mealPlanTotal).toBe(500);
    expect((await calc([ids.rExec], { adults: 1, mealPlan: "CP" })).json.data.mealPlanTotal).toBe(200);
  });

  it("day use: Delux flat ₹1,200 single / ₹1,600 double up to 12 hours; Executive has none", async () => {
    const day = { bookingType: "HOURLY", checkOut: today };
    expect((await calc([ids.rDelux], { ...day, adults: 1, hours: 6 })).json.data.rooms[0].cost).toBe(1200);
    expect((await calc([ids.rDelux], { ...day, adults: 2, hours: 12 })).json.data.rooms[0].cost).toBe(1600);
    const tooLong = await calc([ids.rDelux], { ...day, adults: 2, hours: 13 });
    expect(tooLong.status).toBe(400);
    const exec = await calc([ids.rExec], { ...day, adults: 2, hours: 4 });
    expect(exec.status).toBe(400);
    expect(exec.json.message).toMatch(/not available for day use/);
  });
});
