/**
 * A walk-in with several rooms takes ONE payment. It must be shared across the rooms' bills in proportion to what each room
 * costs. Putting all of it on the first room leaves that room "overpaid" (so checkout refunds the excess) while every other
 * room shows as unpaid and is charged again.
 *
 * Returns one amount per room, in the same order. The amounts add up to `paid` exactly and none exceeds its room's total.
 */
export function splitAdvanceAcrossRooms(paid: number, roomTotals: number[]): number[] {
  const cents = (n: number) => Math.round((Number(n) || 0) * 100);
  const totals = roomTotals.map((t) => Math.max(0, cents(t)));
  const sum = totals.reduce((a, b) => a + b, 0);
  let left = Math.min(cents(paid), sum);
  if (totals.length <= 1 || sum === 0) return [Math.max(0, left) / 100, ...totals.slice(1).map(() => 0)].slice(0, Math.max(1, totals.length));
  const out = totals.map((t) => Math.min(t, Math.floor((left * t) / sum)));
  let rest = left - out.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0 && i < out.length * 2; i++) {
    const k = i % out.length;
    if (out[k] < totals[k]) { out[k] += 1; rest -= 1; }
  }
  return out.map((c) => c / 100);
}
