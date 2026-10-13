/**
 * Audit log (append-only, filters, CSV export), login/session tracking and the guest
 * profile endpoint, over HTTP against the real app.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { hashPassword } from "../utils/auth";
import { AuditLog } from "../models/AuditLog";

const oid = () => new mongoose.Types.ObjectId();
const admin = oid();
const customer = oid();
const staff = oid();
const tag = String(oid()).slice(-6);
const email = (k: string) => `audit-${k}-${tag}@test.local`;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = (id: mongoose.Types.ObjectId, role: string) => jwt.sign({ id: String(id), role }, getJwtSecret(), { expiresIn: "5m" });

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id;
  const passwordHash = await hashPassword("Correct-Horse-1");
  await db().collection("users").insertMany([
    { _id: admin, role: "ADMIN", firstName: "Audit", lastName: "Admin", email: email("admin"), passwordHash, isActive: true, propertyId: P, propertyIds: [P] },
    { _id: customer, role: "CUSTOMER", firstName: "Audit", lastName: "Guest", email: email("guest"), passwordHash, isActive: true },
    { _id: staff, role: "RECEPTIONIST", firstName: "Audit", lastName: "Desk", email: email("desk"), passwordHash, isActive: true, propertyId: P, propertyIds: [P] },
  ]);
});

afterAll(async () => {
  await db().collection("users").deleteMany({ _id: { $in: [admin, customer, staff] } });
  await AuditLog.collection.deleteMany({ $or: [{ "metadata.email": { $regex: tag } }, { resourceId: { $in: [String(admin), String(customer), String(staff)] } }] });
  await new Promise((r) => server.close(r));
});

describe("login and session tracking", () => {
  it("records successful and failed logins, and lastLogin", async () => {
    const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "spec-agent" }, body: JSON.stringify({ email: email("admin"), password: "wrong-password-1" }) });
    expect(bad.status).toBe(401);
    const ok = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "spec-agent" }, body: JSON.stringify({ email: email("admin"), password: "Correct-Horse-1" }) });
    expect(ok.status).toBe(200);
    const u = await db().collection("users").findOne({ _id: admin });
    expect(Date.now() - +new Date(u!.lastLogin)).toBeLessThan(60_000);
    const logs = await AuditLog.find({ resourceId: String(admin), action: { $in: ["auth.login", "auth.login_failed"] } }).lean();
    expect(logs.map((l) => l.action).sort()).toEqual(["auth.login", "auth.login_failed"]);
    expect(logs.every((l) => l.userAgent === "spec-agent" && !!l.ipAddress)).toBe(true);
  });

  it("an authenticated request updates lastActiveAt (refreshed sessions count as activity)", async () => {
    await fetch(`${base}/api/guests/my/profile`, { headers: { Authorization: `Bearer ${tok(staff, "RECEPTIONIST")}` } });
    await new Promise((r) => setTimeout(r, 300));
    const u = await db().collection("users").findOne({ _id: staff });
    expect(u?.lastActiveAt).toBeTruthy();
  });
});

describe("audit log", () => {
  it("is append-only through the app", async () => {
    const entry: any = await (AuditLog as any).create({ propertyId: oid(), actorType: "SYSTEM", actorRole: "SYSTEM", action: "audit-spec.append", resourceType: "Test", metadata: { email: tag } });
    await expect(AuditLog.updateOne({ _id: entry._id }, { action: "tampered" })).rejects.toThrow(/append-only/);
    await expect(AuditLog.deleteOne({ _id: entry._id })).rejects.toThrow(/append-only/);
    entry.action = "tampered";
    await expect(entry.save()).rejects.toThrow(/append-only/);
    await AuditLog.collection.deleteOne({ _id: entry._id });
  });

  it("filters by action prefix and exports CSV with before/after, IP and user agent", async () => {
    const list = await fetch(`${base}/api/audit-logs?action=auth.&actorRole=ADMIN&limit=500`, { headers: { Authorization: `Bearer ${tok(admin, "ADMIN")}` } });
    const json: any = await list.json();
    expect(list.status).toBe(200);
    expect(json.data.logs.every((l: any) => l.action.startsWith("auth."))).toBe(true);

    const csv = await fetch(`${base}/api/audit-logs/export?action=auth.login`, { headers: { Authorization: `Bearer ${tok(admin, "ADMIN")}` } });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await csv.text();
    expect(text.split("\r\n")[0]).toContain("before,after");
    expect(text).toContain("spec-agent");

    const denied = await fetch(`${base}/api/audit-logs/export`, { headers: { Authorization: `Bearer ${tok(staff, "RECEPTIONIST")}` } });
    expect(denied.status).toBe(403);
  });
});

describe("guest profile", () => {
  it("customers resolve their profile from their account; staff get 403, not 401", async () => {
    const asCustomer = await fetch(`${base}/api/guests/my/profile`, { headers: { Authorization: `Bearer ${tok(customer, "CUSTOMER")}` } });
    expect([200, 404]).toContain(asCustomer.status); // 404 = no guest profile yet; never 401
    const asStaff = await fetch(`${base}/api/guests/my/profile`, { headers: { Authorization: `Bearer ${tok(staff, "RECEPTIONIST")}` } });
    expect(asStaff.status).toBe(403);
  });
});
