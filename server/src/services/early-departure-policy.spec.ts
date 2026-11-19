import { describe, it, expect } from "vitest";
import { wantsUnusedNightsCredited } from "./early-departure.service";

describe("early departure policy", () => {
  it("gives no refund unless staff explicitly choose to credit the unused nights", () => {
    expect(wantsUnusedNightsCredited(undefined)).toBe(false);
    expect(wantsUnusedNightsCredited({ body: {} })).toBe(false);
    expect(wantsUnusedNightsCredited({ body: { creditUnusedNights: "true" } })).toBe(false);
    expect(wantsUnusedNightsCredited({ body: { creditUnusedNights: true } })).toBe(true);
  });
});
