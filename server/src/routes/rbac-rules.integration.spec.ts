/**
 * Access rules approved after step 1 (N2–N5), over HTTP against the real app:
 * account-management guards, staff property assignment, housekeeping room access,
 * property listing, POS settle/void split, approval floors by priority, night-audit view.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const oid = () => new mongoose.Types.ObjectId();
// The single test property created by vitest.setup.ts (a second one would disable the default).
let P: mongoose.Types.ObjectId;
const roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "RECEPTIONIST", "CASHIER", "FINANCE", "HOUSEKEEPING", "MAINTENANCE", "RESTAURANT", "CUSTOMER"] as const;
type Role = (typeof roles)[number];
const users = Object.fromEntries(roles.map((r) => [r, oid()])) as Record<Role, mongoose.Types.ObjectId>;
const otherAdmin = oid();
const otherSuper = oid();
const receptionTarget = oid();
const createdEmails: string[] = [];

let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const tok = (role: Role) => jwt.sign({ id: String(users[role]), role }, getJwtSecret(), { expiresIn: "5m" });
async function call(role: Role, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${tok(role)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const user = (_id: mongoose.Types.ObjectId, role: string, tag: string) => ({
  _id, role, firstName: "Rules", lastName: tag, email: `rules-${tag}-${_id}@test.local`, passwordHash: "x", isActive: true,
  ...(role !== "CUSTOMER" && role !== "SUPER_ADMIN" ? { propertyId: P, propertyIds: [P] } : {}),
});

const fixtures = { order: oid(), order2: oid(), apprCritical: oid(), apprHigh: oid(), apprHigh2: oid(), ticketCritical: oid(), ticketHigh: oid(), room: oid() };

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();

  P = (await db().collection("properties").findOne({ code: "TEST-PROPERTY" }))!._id as mongoose.Types.ObjectId;
  await db().collection("users").insertMany([
    ...roles.map((r) => user(users[r], r, r.toLowerCase())),
    user(otherAdmin, "ADMIN", "other-admin"),
    user(otherSuper, "SUPER_ADMIN", "other-super"),
    user(receptionTarget, "RECEPTIONIST", "target"),
  ]);
  const order = (_id: mongoose.Types.ObjectId) => ({
    _id, propertyId: P, kotNumber: `KOT-RULES-${_id}`, status: "SERVED",
    items: [{ name: "Tea", quantity: 1, unitPrice: 50, totalPrice: 50 }], subtotal: 50, taxAmount: 3, grandTotal: 53, totalAmount: 53,
  });
  await db().collection("restaurantorders").insertMany([order(fixtures.order), order(fixtures.order2)]);
  const approval = (_id: mongoose.Types.ObjectId, priority: string) => ({
    _id, propertyId: P, category: "MAINTENANCE", title: `Rules ${priority}`, description: "test", requestedBy: users.RECEPTIONIST,
    priority, status: "PENDING", confidentialLevel: "MANAGER",
  });
  await db().collection("taskapprovals").insertMany([approval(fixtures.apprCritical, "CRITICAL"), approval(fixtures.apprHigh, "HIGH"), approval(fixtures.apprHigh2, "HIGH")]);
  const ticket = (_id: mongoose.Types.ObjectId, priority: string) => ({
    _id, propertyId: P, room: fixtures.room, issueTitle: `Rules ${priority}`, priority, status: "IN_PROGRESS",
  });
  await db().collection("maintenancetickets").insertMany([ticket(fixtures.ticketCritical, "CRITICAL"), ticket(fixtures.ticketHigh, "HIGH")]);
});

afterAll(async () => {
  const createdUsers = await db().collection("users").find({ email: { $in: createdEmails } }).project({ _id: 1 }).toArray();
  const allUserIds = [...Object.values(users), otherAdmin, otherSuper, receptionTarget, ...createdUsers.map((u) => u._id)];
  await db().collection("staffprofiles").deleteMany({ user: { $in: allUserIds } });
  await db().collection("users").deleteMany({ _id: { $in: allUserIds } });
  await db().collection("restaurantorders").deleteMany({ _id: { $in: [fixtures.order, fixtures.order2] } });
  await db().collection("taskapprovals").deleteMany({ _id: { $in: [fixtures.apprCritical, fixtures.apprHigh, fixtures.apprHigh2] } });
  await db().collection("maintenancetickets").deleteMany({ _id: { $in: [fixtures.ticketCritical, fixtures.ticketHigh] } });
  await new Promise<void>((r) => server.close(() => r()));
});

const newStaff = (role: string, tag: string) => {
  const email = `rules-new-${tag}-${Date.now()}@test.local`;
  createdEmails.push(email);
  return { firstName: "New", lastName: "Staff", email, password: "secret123", role, department: "FRONT_DESK", employmentStatus: "FULL_TIME" };
};

describe("N3: account management guards", () => {
  it("MANAGER cannot create an ADMIN", async () => {
    expect((await call("MANAGER", "POST", "/api/staff", newStaff("ADMIN", "m-admin"))).status).toBe(403);
  });
  it("ADMIN cannot create an ADMIN (SUPER_ADMIN only)", async () => {
    expect((await call("ADMIN", "POST", "/api/staff", newStaff("ADMIN", "a-admin"))).status).toBe(403);
  });
  it("SUPER_ADMIN can create an ADMIN", async () => {
    expect((await call("SUPER_ADMIN", "POST", "/api/staff", newStaff("ADMIN", "s-admin"))).status).toBe(201);
  });
  it("MANAGER cannot edit, disable or reset a SUPER_ADMIN", async () => {
    expect((await call("MANAGER", "PATCH", `/api/staff/${otherSuper}`, { firstName: "Hacked" })).status).toBe(403);
    expect((await call("MANAGER", "PATCH", `/api/staff/${otherSuper}`, { isActive: false })).status).toBe(403);
    expect((await call("MANAGER", "POST", `/api/staff/${otherSuper}/reset-password`, { newPassword: "owned123" })).status).toBe(403);
  });
  it("ADMIN cannot edit, disable or reset another ADMIN or a SUPER_ADMIN", async () => {
    expect((await call("ADMIN", "PATCH", `/api/staff/${otherAdmin}`, { isActive: false })).status).toBe(403);
    expect((await call("ADMIN", "POST", `/api/staff/${otherAdmin}/reset-password`, { newPassword: "owned123" })).status).toBe(403);
    expect((await call("ADMIN", "PATCH", `/api/staff/${otherSuper}`, { firstName: "Hacked" })).status).toBe(403);
  });
  it("nobody below SUPER_ADMIN can promote someone to ADMIN", async () => {
    expect((await call("MANAGER", "PATCH", `/api/staff/${receptionTarget}`, { role: "ADMIN" })).status).toBe(403);
    expect((await call("ADMIN", "PATCH", `/api/staff/${receptionTarget}`, { role: "ADMIN" })).status).toBe(403);
  });
  it("MANAGER can still manage lower roles", async () => {
    expect((await call("MANAGER", "PATCH", `/api/staff/${receptionTarget}`, { firstName: "Renamed" })).status).toBe(200);
  });
});

describe("N1: staff accounts always get a property", () => {
  it("a staff user created by a MANAGER inherits the manager's property", async () => {
    const body = newStaff("RECEPTIONIST", "prop");
    const res = await call("MANAGER", "POST", "/api/staff", body);
    expect(res.status).toBe(201);
    const created = await db().collection("users").findOne({ email: body.email });
    expect(String(created?.propertyId)).toBe(String(P));
  });
  it("an unknown propertyId is rejected", async () => {
    const res = await call("MANAGER", "POST", "/api/staff", { ...newStaff("RECEPTIONIST", "badprop"), propertyId: String(oid()) });
    expect(res.status).toBe(400);
  });
});

describe("N4 / N5", () => {
  it("HOUSEKEEPING can view rooms but not create, edit or delete them", async () => {
    expect([401, 403]).not.toContain((await call("HOUSEKEEPING", "GET", "/api/rooms")).status);
    expect((await call("HOUSEKEEPING", "POST", "/api/rooms", {})).status).toBe(403);
    expect((await call("HOUSEKEEPING", "PATCH", `/api/rooms/${oid()}`, {})).status).toBe(403);
    expect((await call("HOUSEKEEPING", "DELETE", `/api/rooms/${oid()}`)).status).toBe(403);
  });
  it.each(["CUSTOMER", "MANAGER", "RECEPTIONIST"] as const)("%s cannot list properties", async (role) => {
    expect((await call(role, "GET", "/api/properties")).status).toBe(403);
  });
});

describe("N2: POS roles", () => {
  it("CASHIER cannot create orders or void, but can settle (BILLED)", async () => {
    expect((await call("CASHIER", "POST", "/api/pos/orders", {})).status).toBe(403);
    expect((await call("CASHIER", "PATCH", `/api/pos/orders/${fixtures.order}/status`, { status: "CANCELLED", reason: "test" })).status).toBe(403);
    expect((await call("CASHIER", "PATCH", `/api/pos/orders/${fixtures.order}/status`, { status: "BILLED" })).status).toBe(200);
  });
  it("RESTAURANT can create orders but cannot settle or void", async () => {
    expect([401, 403]).not.toContain((await call("RESTAURANT", "POST", "/api/pos/orders", {})).status);
    expect((await call("RESTAURANT", "PATCH", `/api/pos/orders/${fixtures.order2}/status`, { status: "BILLED" })).status).toBe(403);
    expect((await call("RESTAURANT", "PATCH", `/api/pos/orders/${fixtures.order2}/status`, { status: "CANCELLED", reason: "test" })).status).toBe(403);
  });
  it("MANAGER void requires a reason and is written to the audit trail", async () => {
    expect((await call("MANAGER", "PATCH", `/api/pos/orders/${fixtures.order2}/status`, { status: "CANCELLED" })).status).toBe(400);
    expect((await call("MANAGER", "PATCH", `/api/pos/orders/${fixtures.order2}/status`, { status: "CANCELLED", reason: "Guest complaint" })).status).toBe(200);
    const log = await db().collection("auditlogs").findOne({ action: "pos.order_voided", resourceId: String(fixtures.order2) });
    expect(log?.metadata?.voidReason).toBe("Guest complaint");
    expect(log?.metadata?.previousStatus).toBe("SERVED");
  });
});

describe("N2: approval floors by priority", () => {
  it("SUPERVISOR cannot approve a CRITICAL task approval; MANAGER can", async () => {
    expect((await call("SUPERVISOR", "POST", `/api/task-approvals/${fixtures.apprCritical}/approve`, {})).status).toBe(403);
    expect((await call("MANAGER", "POST", `/api/task-approvals/${fixtures.apprCritical}/approve`, {})).status).toBe(200);
  });
  it("SUPERVISOR can approve a HIGH task approval; RECEPTIONIST cannot", async () => {
    expect((await call("RECEPTIONIST", "POST", `/api/task-approvals/${fixtures.apprHigh2}/approve`, {})).status).toBe(403);
    expect((await call("SUPERVISOR", "POST", `/api/task-approvals/${fixtures.apprHigh}/approve`, {})).status).toBe(200);
  });
  it("maintenance: SUPERVISOR cannot complete a CRITICAL ticket but can complete a HIGH one", async () => {
    expect((await call("SUPERVISOR", "PATCH", `/api/admin/maintenance/${fixtures.ticketCritical}`, { status: "RESOLVED" })).status).toBe(403);
    expect((await call("SUPERVISOR", "PATCH", `/api/admin/maintenance/${fixtures.ticketHigh}`, { status: "RESOLVED" })).status).toBe(200);
  });
});

describe("N2: night audit", () => {
  it.each(["SUPERVISOR", "RECEPTIONIST"] as const)("%s can view status only", async (role) => {
    expect([401, 403]).not.toContain((await call(role, "GET", "/api/night-audit/status")).status);
    expect((await call(role, "GET", "/api/night-audit/preview")).status).toBe(403);
    expect((await call(role, "POST", "/api/night-audit/run", {})).status).toBe(403);
  });
  it("CASHIER cannot run the night audit", async () => {
    expect((await call("CASHIER", "POST", "/api/night-audit/run", {})).status).toBe(403);
  });
});
