import { describe, expect, it, vi } from "vitest";
import { requestContext } from "./requestContext.middleware";
import { errorHandler } from "./errorHandler.middleware";

function mockRes() {
  const headers: Record<string, string> = {};
  const res: any = {};
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = vi.fn((k: string, v: string) => {
    headers[k] = v;
  });
  res.getHeader = (k: string) => headers[k];
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("requestContext middleware", () => {
  it("generates a fresh request id and echoes it as X-Request-Id when none is provided", () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    requestContext(req, res, next);

    expect(req.id).toBeTruthy();
    expect(typeof req.id).toBe("string");
    expect(res.getHeader("X-Request-Id")).toBe(req.id);
    expect(next).toHaveBeenCalledOnce();
  });

  it("reuses an incoming x-request-id header instead of generating a new one", () => {
    const req: any = { headers: { "x-request-id": "upstream-trace-id-123" } };
    const res = mockRes();
    const next = vi.fn();

    requestContext(req, res, next);

    expect(req.id).toBe("upstream-trace-id-123");
    expect(res.getHeader("X-Request-Id")).toBe("upstream-trace-id-123");
  });
});

describe("errorHandler middleware", () => {
  it("returns a generic 500 with the request id, and does not leak the raw error message to the client", () => {
    const req: any = { id: "test-request-id", method: "GET", path: "/api/whatever" };
    const res = mockRes();
    const next = vi.fn();

    errorHandler(new Error("some internal database connection string leaked here"), req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.requestId).toBe("test-request-id");
    expect(res.body.message).not.toContain("database connection string");
  });

  it("delegates to next(err) instead of double-sending when headers were already sent", () => {
    const req: any = { id: "test-request-id", method: "GET", path: "/api/whatever" };
    const res = mockRes();
    res.headersSent = true;
    const next = vi.fn();

    errorHandler(new Error("late error"), req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
