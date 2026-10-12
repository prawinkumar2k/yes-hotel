/**
 * Business dates and stay length: the single implementation used by server and client.
 *
 * A business date is a date-only string "YYYY-MM-DD" in the property's timezone
 * (Asia/Kolkata). Never derive a day from a Date with getDate()/toISOString():
 * 02:06 IST on 12 Oct is 20:36 UTC on 11 Oct.
 */

export const PROPERTY_TIMEZONE = "Asia/Kolkata";

export type BusinessDate = string; // "YYYY-MM-DD"

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PROPERTY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isBusinessDate(value: unknown): value is BusinessDate {
  if (typeof value !== "string" || !YMD.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** The property-local calendar date of an instant. A valid "YYYY-MM-DD" string is returned unchanged. */
export function toBusinessDate(value: Date | string | number): BusinessDate {
  if (typeof value === "string" && isBusinessDate(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid date: ${String(value)}`);
  return ymdFormatter.format(d); // en-CA formats as YYYY-MM-DD
}

/** Today's calendar date at the property (wall clock; the operational business date comes from night audit). */
export function todayBusinessDate(now: Date = new Date()): BusinessDate {
  return toBusinessDate(now);
}

/** Calendar arithmetic on business dates (no time component, no DST issues). */
export function addDays(date: BusinessDate, days: number): BusinessDate {
  if (!isBusinessDate(date)) throw new RangeError(`Not a business date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from a to b (b − a). */
export function daysBetween(a: BusinessDate, b: BusinessDate): number {
  const ms = (s: BusinessDate) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}

/** IST offset is fixed (+05:30, no DST). */
const IST_OFFSET = "+05:30";

/**
 * The UTC instants bounding a business date at the property: [start, end).
 * Use for querying timestamp fields (createdAt etc.) by day.
 */
export function businessDayRange(date: BusinessDate): { start: Date; end: Date } {
  if (!isBusinessDate(date)) throw new RangeError(`Not a business date: ${date}`);
  const start = new Date(`${date}T00:00:00${IST_OFFSET}`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Range covering business dates from..to inclusive. */
export function businessRange(from: BusinessDate, to: BusinessDate): { start: Date; end: Date } {
  return { start: businessDayRange(from).start, end: businessDayRange(to).end };
}

/** First day of the month containing `date`. */
export function startOfBusinessMonth(date: BusinessDate): BusinessDate {
  return `${date.slice(0, 7)}-01`;
}

/** Last day of the month containing `date`. */
export function endOfBusinessMonth(date: BusinessDate): BusinessDate {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // day 0 of next month
}

/** The UTC instants bounding the month (YYYY-MM or any date in it) at the property: [start, end). */
export function businessMonthRange(monthOrDate: string): { start: Date; end: Date } {
  const first = /^\d{4}-\d{2}$/.test(monthOrDate) ? `${monthOrDate}-01` : startOfBusinessMonth(monthOrDate);
  return businessRange(first, endOfBusinessMonth(first));
}

/** Sunday of the week containing `date` (week starts Sunday, as in the existing reports). */
export function startOfBusinessWeek(date: BusinessDate): BusinessDate {
  const [y, m, d] = date.split("-").map(Number);
  return addDays(date, -new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

/** Inclusive list of business dates from..to (continuous series for charts and room-night inventory). */
export function eachBusinessDate(from: BusinessDate, to: BusinessDate): BusinessDate[] {
  const out: BusinessDate[] = [];
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Nights of a stay: the number of calendar-date changes between check-in and
 * check-out at the property. Times of day are irrelevant: 12 Oct 14:00 → 14 Oct
 * 11:00 is 2 nights. A same-day (day-use) stay is 0.
 *
 * Billing callers that charge at least one night apply that policy themselves:
 * `Math.max(1, nights(a, b))`.
 */
export function nights(checkIn: Date | string | number, checkOut: Date | string | number): number {
  return Math.max(0, daysBetween(toBusinessDate(checkIn), toBusinessDate(checkOut)));
}

/** The business dates of each night of a stay: [checkIn, checkOut). */
export function stayNights(checkIn: Date | string | number, checkOut: Date | string | number): BusinessDate[] {
  const n = nights(checkIn, checkOut);
  const first = toBusinessDate(checkIn);
  return Array.from({ length: n }, (_, i) => addDays(first, i));
}
