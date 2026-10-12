import { afterEach, describe, expect, it, vi } from "vitest";
import mongoose, { Schema } from "mongoose";
import { propertyScoped } from "./propertyScoped";
import { Property } from "../Property";
import { accountChangeDenial } from "../../config/permissions";

const S = new Schema({ name: String, role: String });
S.plugin(propertyScoped, { appliesTo: (d: any) => d.role !== "CUSTOMER" });
const Doc = mongoose.models.PropertyScopedSpecDoc ?? mongoose.model("PropertyScopedSpecDoc", S);

function mockActiveProperties(ids: mongoose.Types.ObjectId[]) {
  const chain: any = { select: () => chain, limit: () => chain, lean: async () => ids.map((_id) => ({ _id })) };
  vi.spyOn(Property, "find").mockReturnValue(chain);
}

afterEach(() => vi.restoreAllMocks());

describe("propertyScoped plugin", () => {
  it("fills propertyId from the only active property", async () => {
    const id = new mongoose.Types.ObjectId();
    mockActiveProperties([id]);
    const d = new Doc({ name: "x", role: "RECEPTIONIST" });
    await d.validate();
    expect(String(d.get("propertyId"))).toBe(String(id));
  });

  it("rejects a document without propertyId when several properties exist", async () => {
    mockActiveProperties([new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]);
    await expect(new Doc({ name: "x", role: "RECEPTIONIST" }).validate()).rejects.toThrow(/propertyId is required/);
  });

  it("rejects when no property exists", async () => {
    mockActiveProperties([]);
    await expect(new Doc({ name: "x", role: "RECEPTIONIST" }).validate()).rejects.toThrow(/no active property/);
  });

  it("keeps an explicit propertyId and skips documents the rule does not apply to", async () => {
    mockActiveProperties([]);
    const explicit = new mongoose.Types.ObjectId();
    const d = new Doc({ name: "x", role: "RECEPTIONIST", propertyId: explicit });
    await d.validate();
    expect(String(d.get("propertyId"))).toBe(String(explicit));
    await expect(new Doc({ name: "guest", role: "CUSTOMER" }).validate()).resolves.toBeUndefined();
  });
});

describe("accountChangeDenial", () => {
  const cases: Array<[string, { targetRole?: string; newRole?: string }, boolean]> = [
    ["MANAGER", { newRole: "ADMIN" }, false],
    ["ADMIN", { newRole: "ADMIN" }, false],
    ["ADMIN", { newRole: "SUPER_ADMIN" }, false],
    ["SUPER_ADMIN", { newRole: "ADMIN" }, true],
    ["MANAGER", { targetRole: "SUPER_ADMIN" }, false],
    ["ADMIN", { targetRole: "ADMIN" }, false],
    ["SUPER_ADMIN", { targetRole: "ADMIN" }, true],
    ["SUPERVISOR", { newRole: "MANAGER" }, false], // higher than own
    ["MANAGER", { newRole: "MANAGER" }, true], // equal is not higher
    ["MANAGER", { targetRole: "RECEPTIONIST", newRole: "HOUSEKEEPING" }, true],
    ["RECEPTIONIST", { targetRole: "MANAGER" }, false], // cannot manage a higher account
  ];
  it.each(cases)("%s %o → allowed=%s", (actor, change, allowed) => {
    expect(accountChangeDenial(actor, change) === null).toBe(allowed);
  });
});
