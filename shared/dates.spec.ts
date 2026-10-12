import { describe, expect, it } from "vitest";
import {
  addDays,
  businessDayRange,
  daysBetween,
  eachBusinessDate,
  isBusinessDate,
  nights,
  stayNights,
  toBusinessDate,
} from "./dates";

describe("toBusinessDate (Asia/Kolkata)", () => {
  it("buckets 02:06 IST on 12 Oct (20:36 UTC on 11 Oct) into 12 Oct", () => {
    expect(toBusinessDate(new Date("2026-10-11T20:36:00Z"))).toBe("2026-10-12");
  });
  it("buckets 23:59 IST into the same day and 00:00 IST into the next", () => {
    expect(toBusinessDate(new Date("2026-10-12T18:29:59Z"))).toBe("2026-10-12");
    expect(toBusinessDate(new Date("2026-10-12T18:30:00Z"))).toBe("2026-10-13");
  });
  it("passes a business date through and rejects garbage", () => {
    expect(toBusinessDate("2026-10-12")).toBe("2026-10-12");
    expect(() => toBusinessDate("not a date")).toThrow(RangeError);
  });
  it("the stored shift businessDate 2026-10-11T19:47Z is IST 12 Oct", () => {
    expect(toBusinessDate("2026-10-11T19:47:12.382Z")).toBe("2026-10-12");
  });
});

describe("calendar arithmetic", () => {
  it("validates real dates only", () => {
    expect(isBusinessDate("2026-02-29")).toBe(false);
    expect(isBusinessDate("2028-02-29")).toBe(true);
    expect(isBusinessDate("2026-10-12T00:00")).toBe(false);
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-10-12", "2026-10-14")).toBe(2);
    expect(daysBetween("2026-10-14", "2026-10-12")).toBe(-2);
  });
  it("gives the UTC bounds of an IST day", () => {
    const { start, end } = businessDayRange("2026-10-12");
    expect(start.toISOString()).toBe("2026-10-11T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-12T18:30:00.000Z");
  });
  it("produces a continuous inclusive series", () => {
    expect(eachBusinessDate("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("nights", () => {
  it("YES-BKG-3010: 12 Oct → 14 Oct is 2 nights (was shown as 1)", () => {
    expect(nights("2026-10-12T06:09:43.082Z", "2026-10-14T06:09:43.082Z")).toBe(2);
  });
  it("ignores time of day: 14:00 check-in, 11:00 check-out", () => {
    expect(nights(new Date("2026-10-12T08:30:00Z"), new Date("2026-10-14T05:30:00Z"))).toBe(2);
  });
  it("uses the IST date, not the UTC date", () => {
    // 01:00 IST 13 Oct (19:30 UTC 12 Oct) → 11:00 IST 14 Oct is ONE night in IST (UTC dates would say 2)
    expect(nights(new Date("2026-10-12T19:30:00Z"), new Date("2026-10-14T05:30:00Z"))).toBe(1);
  });
  it("day use is 0 nights; reversed dates are 0", () => {
    expect(nights("2026-10-12", "2026-10-12")).toBe(0);
    expect(nights("2026-10-14", "2026-10-12")).toBe(0);
  });
  it("lists the night dates of a stay", () => {
    expect(stayNights("2026-10-12", "2026-10-14")).toEqual(["2026-10-12", "2026-10-13"]);
  });
});
