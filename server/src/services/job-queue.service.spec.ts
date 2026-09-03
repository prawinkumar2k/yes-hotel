import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Job, JobStatus } from "../models/Job";
import { enqueueJob, processNextJob, registerJobHandler, _clearHandlers, getDeadLetterJobs, computeBackoffMs } from "./job-queue.service";

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
  await Job.deleteMany({ type: { $regex: /^jq-spec\./ } });
  _clearHandlers();
});

describe("job-queue.service", () => {
  it("processes a due job successfully and marks it COMPLETED", async () => {
    let called: any = null;
    registerJobHandler("jq-spec.echo", async (payload) => {
      called = payload;
    });
    const job = await enqueueJob("jq-spec.echo", { hello: "world" });

    const status = await processNextJob();

    expect(status).toBe(JobStatus.COMPLETED);
    expect(called).toEqual({ hello: "world" });
    const updated = await Job.findById(job._id);
    expect(updated?.status).toBe(JobStatus.COMPLETED);
  });

  it("retries a failing job with backoff, incrementing attempts, before eventually dead-lettering", async () => {
    let callCount = 0;
    registerJobHandler("jq-spec.always_fails", async () => {
      callCount++;
      throw new Error(`synthetic failure #${callCount}`);
    });
    const job = await enqueueJob("jq-spec.always_fails", {}, { maxAttempts: 2 });

    // First attempt: fails, scheduled for retry (not due yet — backoff pushes nextAttemptAt into the future).
    const status1 = await processNextJob();
    expect(status1).toBe(JobStatus.PENDING);
    let updated = await Job.findById(job._id);
    expect(updated?.attempts).toBe(1);
    expect(updated?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    // Not due yet — processNextJob should find nothing to claim.
    const noneDue = await processNextJob();
    expect(noneDue).toBeNull();
    expect(callCount).toBe(1);

    // Force it due now (simulating time passing) and let it fail its final attempt.
    await Job.updateOne({ _id: job._id }, { $set: { nextAttemptAt: new Date() } });
    const status2 = await processNextJob();
    expect(status2).toBe(JobStatus.DEAD_LETTER);
    updated = await Job.findById(job._id);
    expect(updated?.attempts).toBe(2);
    expect(updated?.lastError).toContain("synthetic failure #2");

    const deadLetters = await getDeadLetterJobs();
    expect(deadLetters.some((j) => j._id.toString() === job._id.toString())).toBe(true);
  });

  it("does not claim a job whose type has no registered handler, and does not burn an attempt on it", async () => {
    const job = await enqueueJob("jq-spec.no_handler_registered", {});
    const status = await processNextJob();
    expect(status).toBe(JobStatus.PENDING);
    const updated = await Job.findById(job._id);
    expect(updated?.attempts).toBe(0);
  });

  it("computeBackoffMs grows with attempts and stays capped", () => {
    const b0 = computeBackoffMs(0, 1000, 60000);
    const b5 = computeBackoffMs(5, 1000, 60000);
    const b20 = computeBackoffMs(20, 1000, 60000);
    expect(b5).toBeGreaterThan(b0);
    expect(b20).toBeLessThanOrEqual(60000 * 1.2 + 1); // capped + max jitter
  });
});
