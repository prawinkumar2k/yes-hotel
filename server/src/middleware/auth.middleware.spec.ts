import { describe, it, expect, vi } from "vitest";
import { authorize } from "./auth.middleware";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("authorize (RBAC middleware)", () => {
  it("denies a request with no authenticated user", () => {
    const req: any = {};
    const res = mockRes();
    const next = vi.fn();

    authorize("ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies HOUSEKEEPING access to a payments-only route", () => {
    const req: any = { user: { id: "u1", role: "HOUSEKEEPING" } };
    const res = mockRes();
    const next = vi.fn();

    authorize("ADMIN", "MANAGER")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies MAINTENANCE access to a coupons-only route", () => {
    const req: any = { user: { id: "u1", role: "MAINTENANCE" } };
    const res = mockRes();
    const next = vi.fn();

    authorize("ADMIN", "MANAGER")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows MANAGER access to a route that permits ADMIN and MANAGER", () => {
    const req: any = { user: { id: "u1", role: "MANAGER" } };
    const res = mockRes();
    const next = vi.fn();

    authorize("ADMIN", "MANAGER")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows ADMIN access to any authorized route", () => {
    const req: any = { user: { id: "u1", role: "ADMIN" } };
    const res = mockRes();
    const next = vi.fn();

    authorize("ADMIN")(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("denies CUSTOMER access to any admin-only route", () => {
    const req: any = { user: { id: "u1", role: "CUSTOMER" } };
    const res = mockRes();
    const next = vi.fn();

    authorize("ADMIN", "MANAGER", "RECEPTIONIST")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
