/**
 * Revenue Summary report: department rows add up to the subtotals and the grand total, a refund is never revenue,
 * and a bad period is refused.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { addDays, todayBusinessDate } from "../../../shared/dates";

const admin = new mongoose.Types.ObjectId();
const booking = new mongoose.Types.ObjectId();
const folio = new mongoose.Types.ObjectId();
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = () => jwt.sign({ id: String(admin), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });
const get = async (path: string) => {
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${tok()}` } });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};
// A quiet period far in the past, so no other test's data is in it.
const day = addDays(todayBusinessDate(), -4000);
const at = new Date(`${day}T10:00:00+05:30`);

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  await db().collection("users").insertOne({ _id: admin, role: "ADMIN", firstName: "Rev", lastName: "Adm", email: `rev-${String(admin).slice(-6)}@test.local`, passwordHash: "x", isActive: true });
  const line = (lineType: string, direction: string, amount: number, extra: Record<string, unknown> = {}) => ({ folio, booking, lineType, direction, amount, description: lineType, date: at, createdAt: at, ...extra });
  await db().collection("foliolines").insertMany([
    line("ROOM_CHARGE", "DEBIT", 1000, { coversNights: [day] }),
    line("TAX_CGST", "DEBIT", 25),
    line("TAX_SGST", "DEBIT", 25),
    line("RESTAURANT", "DEBIT", 300),
    line("LAUNDRY", "DEBIT", 100),
    line("REFUND", "DEBIT", 500), // money handed back: never revenue
    line("PAYMENT", "CREDIT", 1450),
  ]);
});

afterAll(async () => {
  await db().collection("foliolines").deleteMany({ folio });
  await db().collection("users").deleteMany({ _id: admin });
  await new Promise((r) => server.close(r));
});

describe("Revenue Summary", () => {
  it("lists charges by department, with GST, and leaves refunds and payments out", async () => {
    const r = await get(`/api/reports/revenue-summary?from=${day}&to=${day}`);
    expect(r.status).toBe(200);
    const d = r.json.data;
    const row = (k: string) => d.departments.flatMap((x: any) => x.rows).find((x: any) => x.key === k);
    expect(row("roomSales")).toMatchObject({ amount: 1000, taxVal: 1000, cgst: 25, sgst: 25, total: 1050 });
    expect(row("restaurant").amount).toBe(300);
    expect(row("laundry").amount).toBe(100);
    expect(d.grand.total).toBe(1450); // 1000 + 25 + 25 + 300 + 100; the 500 refund and the payment are not revenue
    expect(d.taxCollection).toBe(50);
  });

  it("the department subtotals add up to the grand total", async () => {
    const d = (await get(`/api/reports/revenue-summary?from=${day}&to=${day}`)).json.data;
    const sum = d.departments.reduce((t: number, x: any) => t + x.subtotal.total, 0);
    expect(Math.round(sum * 100) / 100).toBe(d.grand.total);
  });

  it("refuses an end date before the start date", async () => {
    expect((await get(`/api/reports/revenue-summary?from=${day}&to=${addDays(day, -1)}`)).status).toBe(400);
  });
});
