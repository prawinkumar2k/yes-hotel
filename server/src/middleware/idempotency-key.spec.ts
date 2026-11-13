import { describe, it, expect, beforeEach } from "vitest";
import { idempotencyKey, _resetIdempotencyStore } from "./idempotency-key";

function mk(key?: string) {
  const req: any = { method: "POST", baseUrl: "/x", path: "/walk-in", header: (n: string) => (n === "Idempotency-Key" ? key : undefined) };
  const res: any = { statusCode: 200, headers: {} as any, body: undefined as any,
    setHeader(k: string, v: string) { this.headers[k] = v; }, status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; }, on() {} };
  return { req, res };
}

describe("idempotencyKey", () => {
  beforeEach(_resetIdempotencyStore);

  it("passes through without a key", () => {
    const { req, res } = mk(); let called = 0;
    idempotencyKey(req, res, () => called++);
    expect(called).toBe(1);
  });

  it("replays a successful response and does not run the handler twice", () => {
    const a = mk("k1"); let runs = 0;
    idempotencyKey(a.req, a.res, () => { runs++; a.res.status(201).json({ success: true, id: 1 }); });
    const b = mk("k1");
    idempotencyKey(b.req, b.res, () => { runs++; });
    expect(runs).toBe(1);
    expect(b.res.statusCode).toBe(201);
    expect(b.res.body).toEqual({ success: true, id: 1 });
    expect(b.res.headers["Idempotent-Replay"]).toBe("true");
  });

  it("returns 409 while the first request is still running", () => {
    const a = mk("k2"); idempotencyKey(a.req, a.res, () => {});
    const b = mk("k2"); let runs = 0; idempotencyKey(b.req, b.res, () => runs++);
    expect(runs).toBe(0);
    expect(b.res.statusCode).toBe(409);
  });

  it("allows a retry after a failed attempt", () => {
    const a = mk("k3"); idempotencyKey(a.req, a.res, () => { a.res.status(400).json({ success: false }); });
    const b = mk("k3"); let runs = 0; idempotencyKey(b.req, b.res, () => runs++);
    expect(runs).toBe(1);
  });
});
