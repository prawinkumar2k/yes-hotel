import { describe, expect, it } from "vitest";
import { splitAdvanceAcrossRooms } from "./advance-split";

const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
describe("splitAdvanceAcrossRooms", () => {
  it("full payment for 7 rooms: every room is fully paid, nothing is left on room 1", () => {
    const totals = Array(7).fill(2010.01);
    const out = splitAdvanceAcrossRooms(14070.07, totals);
    expect(out).toEqual(totals);
    expect(sum(out)).toBe(14070.07);
  });
  it("part payment is shared in proportion and adds up exactly", () => {
    const out = splitAdvanceAcrossRooms(4000, Array(7).fill(2010.01));
    expect(sum(out)).toBe(4000);
    out.forEach((x) => { expect(x).toBeGreaterThan(0); expect(x).toBeLessThanOrEqual(2010.01); });
  });
  it("never allocates more than a room costs", () => {
    const out = splitAdvanceAcrossRooms(5000, [1000, 4000]);
    expect(out).toEqual([1000, 4000]);
    expect(splitAdvanceAcrossRooms(9999, [1000, 2000])).toEqual([1000, 2000]);
  });
  it("one room gets the whole payment", () => {
    expect(splitAdvanceAcrossRooms(1500, [2010.01])).toEqual([1500]);
  });
  it("different room prices", () => {
    const out = splitAdvanceAcrossRooms(3000, [1000, 2000, 3000]);
    expect(sum(out)).toBe(3000);
    expect(out).toEqual([500, 1000, 1500]);
  });
});
