/**
 * RBAC integration: real Express app (createServer) over HTTP against the test DB.
 *
 * Money-desk mutations (folios, advances, refunds, cashier shifts, group advances)
 * are allowed only for SUPER_ADMIN / ADMIN / MANAGER / RECEPTIONIST / CASHIER.
 * Customers get 403 on every one of them and may read only their own folio.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const oid = () => new mongoose.Types.ObjectId();
const ids = {
  property: oid(),
  customer: oid(),
  otherCustomer: oid(),
  receptionist: oid(),
  cashier: oid(),
  manager: oid(),
  finance: oid(),
  housekeeping: oid(),
  superAdmin: oid(),
  ownBooking: oid(),
  otherBooking: oid(),
  ownFolio: oid(),
};
const users: Array<[keyof typeof ids, string, boolean]> = [
  ["customer", "CUSTOMER", false],
  ["otherCustomer", "CUSTOMER", false],
  ["receptionist", "RECEPTIONIST", true],
  ["cashier", "CASHIER", true],
  ["manager", "MANAGER", true],
  ["finance", "FINANCE", true],
  ["housekeeping", "HOUSEKEEPING", true],
  ["superAdmin", "SUPER_ADMIN", false],
];

let server: Server;
let base = "";
const token = (who: keyof typeof ids) => {
  const role = users.find(([k]) => k === who)![1];
  return jwt.sign({ id: String(ids[who]), role }, getJwtSecret(), { expiresIn: "5m" });
};
const call = async (who: keyof typeof ids, method: string, path: string, body: unknown = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token(who)}`, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return res.status;
};

const fakeId = "000000000000000000000000";
const MONEY_MUTATIONS: Array<[string, string]> = [
  ["PUT", `/api/folios/booking/${fakeId}/bill-edit`],
  ["POST", `/api/folios/${fakeId}/charges`],
  ["DELETE", `/api/folios/${fakeId}/lines/${fakeId}`],
  ["POST", `/api/folios/${fakeId}/reconcile`],
  ["POST", `/api/folios/${fakeId}/finalize`],
  ["POST", `/api/folios/${fakeId}/settle`],
  ["POST", `/api/advances`],
  ["POST", `/api/advances/${fakeId}/adjust`],
  ["POST", `/api/advances/${fakeId}/refund`],
  ["POST", `/api/refunds/initiate`],
  ["POST", `/api/cashier-shifts/open`],
  ["POST", `/api/cashier-shifts/${fakeId}/paid-out`],
  ["POST", `/api/cashier-shifts/${fakeId}/handover/initiate`],
  ["POST", `/api/cashier-shifts/${fakeId}/handover/confirm`],
  ["POST", `/api/cashier-shifts/${fakeId}/close`],
  ["PATCH", `/api/group-bookings/${fakeId}/advance`],
];

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();

  const db = mongoose.connection.db!;
  await db.collection("users").insertMany(
    users.map(([k, role, staffWithProperty]) => ({
      _id: ids[k],
      firstName: "RBAC",
      lastName: k,
      email: `rbac-${k}-${ids[k]}@test.local`,
      passwordHash: "x",
      role,
      isActive: true,
      ...(staffWithProperty ? { propertyId: ids.property } : {}),
    })),
  );
  await db.collection("bookings").insertMany([
    { _id: ids.ownBooking, bookingReference: `RBAC-OWN-${ids.ownBooking}`, customer: ids.customer, status: "CHECKED_IN" },
    { _id: ids.otherBooking, bookingReference: `RBAC-OTHER-${ids.otherBooking}`, customer: ids.otherCustomer, status: "CHECKED_IN" },
  ]);
  await db.collection("folios").insertOne({ _id: ids.ownFolio, booking: ids.ownBooking, status: "OPEN", balance: 0 });
});

afterAll(async () => {
  const db = mongoose.connection.db!;
  const userIds = users.map(([k]) => ids[k]);
  await db.collection("users").deleteMany({ _id: { $in: userIds } });
  await db.collection("bookings").deleteMany({ _id: { $in: [ids.ownBooking, ids.otherBooking] } });
  await db.collection("folios").deleteMany({ _id: ids.ownFolio });
  // Anything a permitted role managed to create while probing (validation should prevent it).
  await db.collection("cashiershifts").deleteMany({ cashier: { $in: userIds } });
  await db.collection("advancepayments").deleteMany({ createdBy: { $in: userIds } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("money-desk mutations", () => {
  for (const [method, path] of MONEY_MUTATIONS) {
    it(`CUSTOMER gets 403 on ${method} ${path}`, async () => {
      expect(await call("customer", method, path)).toBe(403);
    });
  }

  for (const role of ["finance", "housekeeping"] as const) {
    it(`${role.toUpperCase()} gets 403 on every money mutation`, async () => {
      for (const [method, path] of MONEY_MUTATIONS) {
        expect(await call(role, method, path), `${method} ${path}`).toBe(403);
      }
    });
  }

  for (const role of ["receptionist", "cashier", "manager", "superAdmin"] as const) {
    it(`${role} passes authorization on every money mutation`, async () => {
      for (const [method, path] of MONEY_MUTATIONS) {
        // Fake ids / empty bodies are rejected by the handlers; only auth failures matter here.
        expect([401, 403], `${method} ${path}`).not.toContain(await call(role, method, path));
      }
    });
  }
});

describe("customer folio read access", () => {
  it("customer can read their own booking's folio", async () => {
    expect(await call("customer", "GET", `/api/folios/booking/${ids.ownBooking}`)).toBe(200);
  });

  it("customer gets 403 on someone else's folio", async () => {
    expect(await call("customer", "GET", `/api/folios/booking/${ids.otherBooking}`)).toBe(403);
  });

  it("customer read does not create a folio for a booking that has none", async () => {
    const db = mongoose.connection.db!;
    await db.collection("folios").deleteOne({ _id: ids.ownFolio });
    expect(await call("customer", "GET", `/api/folios/booking/${ids.ownBooking}`)).toBe(404);
    expect(await db.collection("folios").countDocuments({ booking: ids.ownBooking })).toBe(0);
    await db.collection("folios").insertOne({ _id: ids.ownFolio, booking: ids.ownBooking, status: "OPEN", balance: 0 });
  });
});

describe("single role system", () => {
  it.each([
    ["/api/settings"],
    ["/api/staff"],
    ["/api/payment-channels"],
    ["/api/group-bookings"],
    ["/api/complaints"],
  ])("SUPER_ADMIN is no longer denied on %s", async (path) => {
    expect([401, 403]).not.toContain(await call("superAdmin", "GET", path));
  });

  it("CUSTOMER is rejected (403) by property-scoped staff routes", async () => {
    expect(await call("customer", "GET", "/api/advances")).toBe(403);
  });
});
