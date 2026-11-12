import { describe, it, expect } from "vitest";
import { withTimeout, withRetry, CircuitBreaker, TimeoutError, CircuitOpenError, isTransientError } from "./resilience";

const noSleep = async () => {};

describe("resilience", () => {
  it("times out a call that never answers", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "x")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("retries temporary failures and then succeeds", async () => {
    let calls = 0;
    const r = await withRetry(async () => { if (++calls < 3) throw { statusCode: 503 }; return "ok"; }, { sleep: noSleep });
    expect(r).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a client error", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw { statusCode: 400 }; }, { sleep: noSleep })).rejects.toBeTruthy();
    expect(calls).toBe(1);
  });

  it("gives up after the attempt limit", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw { statusCode: 500 }; }, { attempts: 3, sleep: noSleep })).rejects.toBeTruthy();
    expect(calls).toBe(3);
  });

  it("classifies errors", () => {
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError({ statusCode: 404 })).toBe(false);
    expect(isTransientError({ statusCode: 429 })).toBe(true);
  });

  it("opens after repeated failures, then closes after the cool-down", async () => {
    let t = 0;
    const cb = new CircuitBreaker("svc", 2, 1000, () => t);
    const fail = async () => { throw { statusCode: 503 }; };
    await expect(cb.run(fail)).rejects.toBeTruthy();
    await expect(cb.run(fail)).rejects.toBeTruthy();
    await expect(cb.run(async () => "x")).rejects.toBeInstanceOf(CircuitOpenError);
    t = 1500;
    await expect(cb.run(async () => "x")).resolves.toBe("x");
  });

  it("a 404 does not trip the breaker", async () => {
    const cb = new CircuitBreaker("svc", 1, 1000);
    await expect(cb.run(async () => { throw { statusCode: 404 }; })).rejects.toBeTruthy();
    await expect(cb.run(async () => "x")).resolves.toBe("x");
  });
});
