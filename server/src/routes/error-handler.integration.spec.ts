/**
 * A bad request is answered as a bad request (400 / 413), never as a server failure (500), and
 * the server keeps serving afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createServer } from "../../index";

let server: Server;
let base = "";

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
});

describe("bad requests", () => {
  it("malformed JSON → 400 with a clear message", async () => {
    const r = await fetch(base + "/api/booking-enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
    expect(r.status).toBe(400);
    expect((await r.json()).message).toMatch(/not valid JSON/);
  });

  it("the server is still healthy afterwards", async () => {
    expect((await fetch(base + "/api/health")).status).toBe(200);
  });
});
