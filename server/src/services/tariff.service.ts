/**
 * The hotel's tariff rules in one place (walk-in pricing, day use, early check-in / late check-out):
 *   - one adult in a room takes the single price, two or more the double price;
 *   - extra person / bed / child rates can differ by room category (blank = the hotel-wide rate in Settings);
 *   - CP (breakfast) adds a fixed amount per room by occupancy, plus breakfast for each extra person;
 *   - day use is a flat price by occupancy (not per hour), up to a maximum number of hours, and some categories have none.
 */
export class TariffError extends Error {
  status = 400;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pos = (v: unknown) => (num(v) > 0 ? num(v) : undefined);

/**
 * Group check-in: one registration, several rooms. The adults (and children) are shared out evenly across the rooms,
 * the first rooms taking the remainder; every room has at least one adult. Men are placed first, then women, so each
 * room's registration card and invoice header show its own counts.
 */
export function splitAcrossRooms(adults: unknown, children: unknown, roomCount: number, male?: unknown) {
  const rooms = Math.max(1, Math.floor(roomCount) || 1);
  const a = Math.max(rooms, Math.floor(Number(adults)) || rooms);
  const c = Math.max(0, Math.floor(Number(children)) || 0);
  let maleLeft = male === undefined || male === null || male === "" ? undefined : Math.min(a, Math.max(0, Math.floor(Number(male)) || 0));
  return Array.from({ length: rooms }, (_, i) => {
    const ad = Math.floor(a / rooms) + (i < a % rooms ? 1 : 0);
    const ch = Math.floor(c / rooms) + (i < c % rooms ? 1 : 0);
    let maleCount: number | undefined;
    let femaleCount: number | undefined;
    if (maleLeft !== undefined) {
      maleCount = Math.min(ad, maleLeft);
      maleLeft -= maleCount;
      femaleCount = ad - maleCount;
    }
    return { adults: ad, children: ch, maleCount, femaleCount };
  });
}

/** Nightly room price: the single price when every room has at most one adult, else the category's double price. */
export function categoryNightlyRate(cat: any, adults: unknown, roomCount: number) {
  const single = num(cat?.singleOccupancyPrice);
  return single > 0 && Number(adults) <= roomCount ? single : (cat?.basePrice ?? 0);
}

/** Day-use price for the stay: flat by occupancy. Categories with no day use are refused. */
export function dayUseRate(cat: any, adults: unknown, roomCount: number, hours: unknown) {
  if (cat?.dayUseAllowed === false) throw new TariffError(`${cat?.name ?? "This room type"} rooms are not available for day use`);
  const maxHours = pos(cat?.dayUseMaxHours) ?? 12;
  if (Number(hours) > maxHours) throw new TariffError(`Day use is up to ${maxHours} hours; for longer, book it as a night`);
  const single = pos(cat?.dayUseSinglePrice);
  const double = pos(cat?.dayUseDoublePrice);
  const flat = Number(adults) <= roomCount ? single ?? double : double ?? single;
  // Categories without day-use prices keep the older per-hour price.
  return flat ?? num(cat?.hourlyPrice) * Number(hours);
}

/** Extra person / bed / child rates: those typed at registration, else the room category's, else the hotel-wide rate. */
export function stayExtraRates(settings: any, overrides: any, cat?: any) {
  const pick = (v: unknown, categoryRate: unknown, fallback: number) =>
    v !== undefined && v !== null && v !== "" && Number(v) >= 0 ? Number(v) : pos(categoryRate) ?? fallback;
  return {
    extraPersonRate: pick(overrides?.extraPersonRate, cat?.extraPersonRate, settings?.extraPersonRate ?? 800),
    extraBedRate: pick(overrides?.extraBedRate, cat?.extraBedRate, settings?.extraBedRate ?? 1200),
    childRateNoBed: pick(overrides?.childRateNoBed, cat?.childRateNoBed, settings?.childRateNoBed ?? 400),
    childRateWithBed: pick(overrides?.childRateWithBed, cat?.childRateWithBed, settings?.childRateWithBed ?? 600),
  };
}

/**
 * Meal plan charge for the whole stay. CP with the hotel's room supplements set: a fixed amount per room
 * (single or double occupancy) plus breakfast for every extra person and child. Any other plan: the per-person rate.
 */
export function mealPlanCharge(p: {
  plan: string;
  adults: number;
  children: number;
  extraGuests: number;
  roomCount: number;
  nights: number;
  settings: any;
  perPersonRates: Record<string, number>;
}) {
  const { settings: s, plan, nights } = p;
  const cpSingle = num(s?.cpSingleSupplement);
  const cpDouble = num(s?.cpDoubleSupplement);
  if (plan === "CP" && (cpSingle > 0 || cpDouble > 0)) {
    const rooms = Math.max(1, p.roomCount);
    const adults = Math.max(rooms, Math.floor(p.adults) || rooms);
    const doubles = Math.min(rooms, adults - rooms);
    const singles = rooms - doubles;
    const extraAdults = Math.max(0, adults - 2 * rooms);
    const breakfastGuests = extraAdults + Math.max(0, p.children) + Math.max(0, p.extraGuests);
    const perNight = singles * (cpSingle || cpDouble) + doubles * (cpDouble || cpSingle) + breakfastGuests * num(s?.extraBreakfastRate);
    return perNight * nights;
  }
  const rate = p.perPersonRates[plan] || 0;
  return rate * (p.adults + p.children + p.extraGuests) * nights;
}

/** Early check-in / late check-out up to the allowed hours: a flat fee by occupancy (blank = not configured). */
export function earlyLateFlatFee(settings: any, adults: unknown, hours: number) {
  const maxHours = pos(settings?.earlyLateMaxHours) ?? 6;
  if (hours > maxHours) return undefined;
  const single = pos(settings?.earlyLateFeeSingle);
  const double = pos(settings?.earlyLateFeeDouble);
  return Number(adults) <= 1 ? single ?? double : double ?? single;
}
