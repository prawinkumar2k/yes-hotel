import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, FULL_ACCESS_ROLES, isFullAccessRole } from "./permissions";
import { UserRole } from "../models/User";

const MONEY_DESK = ["MANAGER", "RECEPTIONIST", "CASHIER"] as const;
const has = (role: string, page: string, action: string) =>
  ((DEFAULT_ROLE_PERMISSIONS as any)[role]?.[page] ?? []).includes(action);

describe("permission map", () => {
  it("defines an entry for every UserRole (single role enum)", () => {
    for (const role of Object.values(UserRole)) expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty(role);
  });

  it("full access is exactly SUPER_ADMIN and ADMIN", () => {
    expect([...FULL_ACCESS_ROLES].sort()).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(isFullAccessRole("MANAGER")).toBe(false);
    expect(isFullAccessRole(undefined)).toBe(false);
  });

  it("CUSTOMER has no staff permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.CUSTOMER).toEqual({});
  });

  const moneyMutations: Array<[string, string]> = [
    ["FOLIOS", "POST_CHARGE"], ["FOLIOS", "VOID_LINE"], ["FOLIOS", "EDIT"], ["FOLIOS", "SETTLE"],
    ["ADVANCES", "CREATE"], ["ADVANCES", "ADJUST"], ["ADVANCES", "REFUND"],
    ["REFUNDS", "CREATE"],
    ["CASHIER_SHIFTS", "OPEN_SHIFT"], ["CASHIER_SHIFTS", "CLOSE_SHIFT"], ["CASHIER_SHIFTS", "RECONCILE"],
  ];

  it.each(moneyMutations)("only the money desk holds %s:%s", (page, action) => {
    const holders = Object.keys(DEFAULT_ROLE_PERMISSIONS).filter((r) => has(r, page, action)).sort();
    expect(holders).toEqual([...MONEY_DESK].sort());
  });
});
