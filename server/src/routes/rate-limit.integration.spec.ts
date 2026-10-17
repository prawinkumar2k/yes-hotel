/**
 * The whole hotel shares one internet connection. Request budgets are per signed-in user, public
 * read-only pages are never limited, and one person's wrong passwords never lock out another.
 * (A budget of 5 here so the limit is reached quickly.)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";

const a = new mongoose.Types.ObjectId();
const b = new mongoose.Types.ObjectId();
let server: Server;
let base = "";
const saved = { api: process.env.RATE_LIMIT_API_MAX, auth: process.env.RATE_LIMIT_AUTH_MAX };
const tok = (id: mongoose.Types.ObjectId) => jwt.sign({ id: String(id), role: "ADMIN" }, getJwtSecret(), { expiresIn: "5m" });
const get = (path: string, id?: mongoose.Types.ObjectId) => fetch(base + path, { headers: id ? { Authorization: `Bearer ${tok(id)}` } : {} }).then((r) => r.status);
const login = (email: string) => fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "wrong-password" }) }).then((r) => r.status);

beforeAll(async () => {
  process.env.RATE_LIMIT_API_MAX = "5";
  process.env.RATE_LIMIT_AUTH_MAX = "3";
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  process.env.RATE_LIMIT_API_MAX = saved.api;
  process.env.RATE_LIMIT_AUTH_MAX = saved.auth;
  if (saved.api === undefined) delete process.env.RATE_LIMIT_API_MAX;
  if (saved.auth === undefined) delete process.env.RATE_LIMIT_AUTH_MAX;
  await new Promise((r) => server.close(r));
});

describe("request limits on a shared connection", () => {
  it("each signed-in user has their own budget", async () => {
    for (let i = 0; i < 5; i++) expect(await get("/api/admin/stats", a)).not.toBe(429);
    expect(await get("/api/admin/stats", a)).toBe(429);
    expect(await get("/api/admin/stats", b)).not.toBe(429); // same connection, other user: unaffected
  });

  it("public website data is never limited", async () => {
    for (let i = 0; i < 12; i++) {
      expect(await get("/api/rooms/categories")).not.toBe(429);
      expect(await get("/api/public/settings")).not.toBe(429);
    }
  });

  it("wrong passwords lock only that account's attempts, not the whole desk", async () => {
    for (let i = 0; i < 3; i++) await login("someone@yeshotels.com");
    expect(await login("someone@yeshotels.com")).toBe(429);
    expect(await login("reception@yeshotels.com")).not.toBe(429);
  });
});
