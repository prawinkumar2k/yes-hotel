import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { auditIsDue, runDueNightAudits } from "./nightAudit.job";

// 2026-10-22 00:10 and 23:50 at the property (Asia/Kolkata, UTC+5:30)
const at = (hhmm: string, day = "2026-10-22") => new Date(`${day}T${hhmm}:00+05:30`);

describe("automatic night audit: when a business date is due", () => {
  it("yesterday's date is closed after the configured time, not before", () => {
    expect(auditIsDue("2026-10-21", at("00:04"), "00:05")).toBe(false);
    expect(auditIsDue("2026-10-21", at("00:05"), "00:05")).toBe(true);
    expect(auditIsDue("2026-10-21", at("09:30"), "00:05")).toBe(true);
  });

  it("today's business date is never closed early", () => {
    expect(auditIsDue("2026-10-22", at("23:59"), "00:05")).toBe(false);
  });

  it("a date missed while the server was down is closed at once, whatever the time", () => {
    expect(auditIsDue("2026-10-19", at("00:01"), "00:05")).toBe(true);
  });

  it("a later configured time is respected", () => {
    expect(auditIsDue("2026-10-21", at("01:59"), "02:00")).toBe(false);
    expect(auditIsDue("2026-10-21", at("02:00"), "02:00")).toBe(true);
  });
});

describe("automatic night audit: switched off in Settings", () => {
  let before: any = null;
  const db = () => mongoose.connection.db!;
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGODB_URI as string);
    before = await db().collection("hotelsettings").findOne({});
    await db().collection("hotelsettings").updateMany({}, { $set: { autoNightAuditEnabled: false } });
  });
  afterAll(async () => {
    if (before) await db().collection("hotelsettings").updateMany({}, before.autoNightAuditEnabled === undefined ? { $unset: { autoNightAuditEnabled: "" } } : { $set: { autoNightAuditEnabled: before.autoNightAuditEnabled } });
    await mongoose.connection.close();
  });
  it("does nothing", async () => {
    if (!before) return; // no settings document in this database
    expect(await runDueNightAudits(at("03:00"))).toBe(0);
  });
});
