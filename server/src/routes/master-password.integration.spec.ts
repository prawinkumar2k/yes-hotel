/**
 * Owner's master password:
 *   opens a staff account even after its own password changed, and every use is audited;
 *   never opens a guest (CUSTOMER) account or a disabled account; wrong value fails;
 *   with MASTER_PASSWORD_HASH unset the feature is off.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { createServer } from "../../index";
import { hashPassword } from "../utils/auth";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const MASTER = `Master-Test-${tag}-Key`;
const ids = { staff: oid(), guest: oid(), disabled: oid() };
const email = (k: string) => `mp-${k}-${tag}@test.local`;
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;

const login = async (e: string, password: string) => {
  const res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password }) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

beforeAll(async () => {
  const salt = crypto.randomBytes(16);
  process.env.MASTER_PASSWORD_HASH = `scrypt:${salt.toString("hex")}:${crypto.scryptSync(MASTER, salt, 32).toString("hex")}`;
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const hash = await hashPassword("Own-Password-123");
  const u = (_id: mongoose.Types.ObjectId, k: string, role: string, isActive = true) => ({ _id, role, firstName: "Mp", lastName: k, email: email(k), passwordHash: hash, isActive });
  await db().collection("users").insertMany([u(ids.staff, "staff", "RECEPTIONIST"), u(ids.guest, "guest", "CUSTOMER"), u(ids.disabled, "disabled", "HOUSEKEEPING", false)]);
});

afterAll(async () => {
  delete process.env.MASTER_PASSWORD_HASH;
  await db().collection("refreshtokens").deleteMany({ user: { $in: Object.values(ids) } });
  await db().collection("users").deleteMany({ _id: { $in: Object.values(ids) } });
  await new Promise((r) => server.close(r));
});

describe("Owner's master password", () => {
  it("opens a staff account and is recorded in the audit log", async () => {
    expect((await login(email("staff"), "Own-Password-123")).status).toBe(200);
    const r = await login(email("staff"), MASTER);
    expect(r.status).toBe(200);
    expect(r.json.data.role).toBe("RECEPTIONIST");
    const audit = await db().collection("auditlogs").findOne({ action: "auth.master_password_login", resourceId: String(ids.staff) });
    expect(audit).toBeTruthy();
  });

  it("never opens a guest account or a disabled account; a wrong value fails", async () => {
    expect((await login(email("guest"), MASTER)).status).toBe(401);
    expect((await login(email("disabled"), MASTER)).status).toBe(401);
    expect((await login(email("staff"), MASTER + "x")).status).toBe(401);
  });

  it("is off when no master password is configured", async () => {
    const saved = process.env.MASTER_PASSWORD_HASH;
    delete process.env.MASTER_PASSWORD_HASH;
    expect((await login(email("staff"), MASTER)).status).toBe(401);
    process.env.MASTER_PASSWORD_HASH = saved;
  });
});
