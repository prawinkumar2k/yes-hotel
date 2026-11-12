/**
 * Guards for calls to outside services (Razorpay, email): never wait forever, retry only
 * temporary failures with growing, randomised waits, and stop calling a service that keeps failing.
 * Use ONLY for safe-to-repeat calls (reads). Never wrap an operation that moves money in a retry.
 */

export class TimeoutError extends Error {
  constructor(ms: number, label = "operation") {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export class CircuitOpenError extends Error {
  constructor(label = "service") {
    super(`${label} is temporarily unavailable (circuit open)`);
    this.name = "CircuitOpenError";
  }
}

export function withTimeout<T>(work: Promise<T>, ms: number, label?: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Temporary problems worth another try: timeouts, network drops, HTTP 429 and 5xx. Never 4xx (a bad request stays bad). */
export function isTransientError(err: any): boolean {
  if (!err) return false;
  if (err instanceof TimeoutError) return true;
  if (err instanceof CircuitOpenError) return false;
  const status = Number(err.statusCode ?? err.status ?? err.response?.status);
  if (status) return status === 429 || status >= 500;
  return ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "EPIPE"].includes(err.code);
}

export function backoffMs(attempt: number, baseMs = 500, capMs = 8000): number {
  const exp = Math.min(baseMs * 2 ** attempt, capMs);
  return Math.round(exp + Math.random() * exp * 0.2); // jitter so many callers don't retry together
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; capMs?: number; shouldRetry?: (e: any) => boolean; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const { attempts = 3, baseMs = 500, capMs = 8000, shouldRetry = isTransientError, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !shouldRetry(err)) throw err;
      await sleep(backoffMs(i, baseMs, capMs));
    }
  }
  throw lastErr;
}

/** After `threshold` failures in a row the circuit opens for `coolDownMs`: calls fail at once instead of piling up. */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(
    private label: string,
    private threshold = 5,
    private coolDownMs = 30_000,
    private now: () => number = Date.now,
  ) {}

  get isOpen(): boolean {
    return this.failures >= this.threshold && this.now() - this.openedAt < this.coolDownMs;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) throw new CircuitOpenError(this.label);
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      // Only service trouble counts; a 404 "no such order" is a normal answer, not an outage.
      if (isTransientError(err)) {
        this.failures += 1;
        if (this.failures >= this.threshold) this.openedAt = this.now();
      }
      throw err;
    }
  }
}
