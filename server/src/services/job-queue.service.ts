import { Job, JobStatus, IJob } from "../models/Job";
import { logger } from "./logger.service";

/**
 * A real, durable (MongoDB-backed, not in-memory) job queue. This is a
 * deliberate choice given this project's actual infrastructure: no
 * Redis/BullMQ is provisioned in this environment, and pretending an
 * in-memory queue is "production durable infrastructure" would be worse
 * than honestly building on the database that's already there and already
 * verified. Jobs survive a process restart because they live in MongoDB,
 * not in a JS array — that's the property that actually matters for
 * "durable". If a Redis-backed queue (BullMQ) is provisioned later, this
 * module is the one thing that would need replacing; nothing about the
 * job payloads or handler contract is Mongo-specific.
 *
 * NOT a distributed exactly-once scheduler across many worker processes —
 * the atomic claim (findOneAndUpdate) prevents two workers from processing
 * the SAME job concurrently, but this app currently runs a single Node
 * process per deployment, so that guarantee is more than sufficient here.
 */

export type JobHandler = (payload: any) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

/** Exposed for tests that need a clean handler registry between runs. */
export function _clearHandlers(): void {
  handlers.clear();
}

export async function enqueueJob(
  type: string,
  payload: Record<string, any>,
  opts: { maxAttempts?: number; delayMs?: number } = {}
): Promise<IJob> {
  return Job.create({
    type,
    payload,
    maxAttempts: opts.maxAttempts ?? 5,
    nextAttemptAt: new Date(Date.now() + (opts.delayMs ?? 0)),
  });
}

/** Exponential backoff with a cap, plus jitter to avoid a thundering herd if many jobs fail at once. */
export function computeBackoffMs(attempts: number, baseMs = 5000, capMs = 30 * 60 * 1000): number {
  const exp = Math.min(baseMs * 2 ** attempts, capMs);
  const jitter = Math.random() * exp * 0.2;
  return Math.round(exp + jitter);
}

/**
 * Atomically claims and processes ONE due job, if any. Returns the job's
 * final status, or null if there was no due job to claim.
 */
export async function processNextJob(): Promise<JobStatus | null> {
  const claimed = await Job.findOneAndUpdate(
    { status: JobStatus.PENDING, nextAttemptAt: { $lte: new Date() } },
    { $set: { status: JobStatus.PROCESSING } },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" }
  );
  if (!claimed) return null;

  const handler = handlers.get(claimed.type);
  if (!handler) {
    // No handler registered — not the job's fault, don't burn a retry
    // attempt on it. Put it back as PENDING for whenever a handler exists
    // (e.g. a deploy that hasn't registered handlers yet).
    claimed.status = JobStatus.PENDING;
    await claimed.save();
    logger.warn("job_no_handler", { jobId: claimed._id.toString(), type: claimed.type });
    return JobStatus.PENDING;
  }

  try {
    await handler(claimed.payload);
    claimed.status = JobStatus.COMPLETED;
    await claimed.save();
    logger.info("job_completed", { jobId: claimed._id.toString(), type: claimed.type, attempts: claimed.attempts + 1 });
    return JobStatus.COMPLETED;
  } catch (error: any) {
    claimed.attempts += 1;
    claimed.lastError = error?.message ?? String(error);
    if (claimed.attempts >= claimed.maxAttempts) {
      claimed.status = JobStatus.DEAD_LETTER;
      logger.error("job_dead_lettered", {
        jobId: claimed._id.toString(),
        type: claimed.type,
        attempts: claimed.attempts,
        lastError: claimed.lastError,
      });
    } else {
      claimed.status = JobStatus.PENDING;
      claimed.nextAttemptAt = new Date(Date.now() + computeBackoffMs(claimed.attempts));
      logger.warn("job_retry_scheduled", {
        jobId: claimed._id.toString(),
        type: claimed.type,
        attempts: claimed.attempts,
        nextAttemptAt: claimed.nextAttemptAt,
        lastError: claimed.lastError,
      });
    }
    await claimed.save();
    return claimed.status;
  }
}

export interface JobWorker {
  stop: () => void;
}

let activeWorker: JobWorker | null = null;

/**
 * Starts the process-wide job worker if one isn't already running (safe to
 * call from createServer() even if it's invoked more than once — Vite's dev
 * middleware plugin, repeated test imports). stopJobWorker() is what
 * graceful shutdown (node-build.ts) calls so an in-flight job finishes
 * rather than the process exiting mid-job.
 */
export function ensureJobWorkerStarted(opts?: { intervalMs?: number; batchSize?: number }): void {
  if (activeWorker) return;
  activeWorker = startJobWorker(opts);
}

export function stopJobWorker(): void {
  activeWorker?.stop();
  activeWorker = null;
}

/**
 * Starts a polling worker loop. Returns a handle whose stop() clears the
 * interval — wired into graceful shutdown (node-build.ts) so an in-flight
 * job finishes rather than being cut off, and no new poll starts after
 * shutdown begins.
 */
export function startJobWorker(opts: { intervalMs?: number; batchSize?: number } = {}): JobWorker {
  const intervalMs = opts.intervalMs ?? 5000;
  const batchSize = opts.batchSize ?? 5;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    for (let i = 0; i < batchSize; i++) {
      if (stopped) break;
      const result = await processNextJob().catch((err) => {
        logger.error("job_worker_tick_error", { message: err?.message });
        return null;
      });
      if (result === null) break; // nothing due — stop draining this tick
    }
  };

  const interval = setInterval(tick, intervalMs);
  interval.unref?.();
  // Kick off immediately rather than waiting for the first interval tick.
  void tick();

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}

export async function getDeadLetterJobs(): Promise<IJob[]> {
  return Job.find({ status: JobStatus.DEAD_LETTER }).sort({ updatedAt: -1 });
}
