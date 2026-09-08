import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerNotificationJobHandlers } from "./notificationRetry.job";
import { processNextJob, enqueueJob, _clearHandlers } from "../services/job-queue.service";
import { Job, JobStatus } from "../models/Job";
import { NotificationLog, NotificationType, NotificationStatus } from "../models/NotificationLog";
import * as notificationService from "../services/notification.service";

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
  await NotificationLog.deleteMany({ subject: /^retry-spec/ });
  // This job type ("notification.email_retry") isn't test-namespaced the
  // way job-queue.service.spec.ts's "jq-spec.*" jobs are — it's the real
  // production type name. Without cleaning it here, a job left PENDING by
  // an earlier `pnpm test` run against this same persistent local test DB
  // sits there indefinitely and gets claimed by processNextJob() ahead of
  // the job THIS test just created (claims oldest-due-first, and a stale
  // job's nextAttemptAt is always in the past) — confirmed as the actual
  // cause of a real, reproduced test failure (expected DEAD_LETTER after
  // one attempt, got PENDING — a leftover job with a different maxAttempts
  // was claimed instead of this test's own).
  await Job.deleteMany({ type: "notification.email_retry" });
  _clearHandlers();
  registerNotificationJobHandlers();
});

describe("notification retry job handler", () => {
  it("updates the original NotificationLog row to SENT when the retry succeeds", async () => {
    const failedLog = await NotificationLog.create({
      type: NotificationType.BOOKING_CONFIRMATION,
      recipientEmail: "retry-spec@test.local",
      subject: "retry-spec original attempt",
      body: "body",
      status: NotificationStatus.FAILED,
      errorMessage: "simulated SMTP failure",
    });

    const fakeSendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(notificationService, "getTransporter").mockReturnValue({ sendMail: fakeSendMail } as any);

    await enqueueJob("notification.email_retry", {
      notificationLogId: failedLog._id.toString(),
      recipientEmail: "retry-spec@test.local",
      subject: "retry-spec original attempt",
      body: "body",
    });

    const status = await processNextJob();
    expect(status).toBe(JobStatus.COMPLETED);
    expect(fakeSendMail).toHaveBeenCalledOnce();

    const updated = await NotificationLog.findById(failedLog._id);
    expect(updated?.status).toBe(NotificationStatus.SENT);

    vi.restoreAllMocks();
  });

  it("throws (letting the queue retry/backoff) when no transporter is configured", async () => {
    vi.spyOn(notificationService, "getTransporter").mockReturnValue(null);

    await enqueueJob("notification.email_retry", {
      notificationLogId: new mongoose.Types.ObjectId().toString(),
      recipientEmail: "retry-spec-none@test.local",
      subject: "retry-spec no transporter",
      body: "body",
    }, { maxAttempts: 1 });

    const status = await processNextJob();
    expect(status).toBe(JobStatus.DEAD_LETTER);

    vi.restoreAllMocks();
  });
});
