import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuditLog } from "./audit.service";
import { AuditLog, AuditActorType } from "../models/AuditLog";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await AuditLog.deleteMany({ action: { $regex: /^audit-spec\./ } });
});

describe("createAuditLog without a req (webhook / system-originated events)", () => {
  it("actually persists an entry when called with no req at all — regression test for a bug where req?.headers['user-agent'] threw and was silently swallowed", async () => {
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "audit-spec.system_event",
      resourceType: "Booking",
      resourceId: "irrelevant-id",
      metadata: { note: "no req passed" },
    });

    const entry = await AuditLog.findOne({ action: "audit-spec.system_event" });
    expect(entry).not.toBeNull();
    expect(entry?.actorType).toBe(AuditActorType.SYSTEM);
    expect(entry?.userAgent).toBeUndefined();
  });

  it("still records req-based context (ip/user-agent/actor) when a real req IS provided", async () => {
    const fakeReq = {
      ip: "127.0.0.1",
      headers: { "user-agent": "vitest-agent" },
      user: { id: new mongoose.Types.ObjectId().toString(), role: "ADMIN" },
    } as any;

    await createAuditLog({
      req: fakeReq,
      action: "audit-spec.user_event",
      resourceType: "Booking",
      resourceId: "irrelevant-id",
    });

    const entry = await AuditLog.findOne({ action: "audit-spec.user_event" });
    expect(entry).not.toBeNull();
    expect(entry?.actorType).toBe(AuditActorType.USER);
    expect(entry?.userAgent).toBe("vitest-agent");
    expect(entry?.ipAddress).toBe("127.0.0.1");
  });
});
