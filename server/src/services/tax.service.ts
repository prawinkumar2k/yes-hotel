/**
 * GST: the single tax implementation.
 *
 * Rules are effective-dated slabs per supply category. Defaults below reflect the
 * Indian GST rates; Property Settings can override them (HotelSettings.gstRules).
 *
 * - ROOM (accommodation): the slab is chosen by the value actually charged per room
 *   per night (after discounts), using the rule in force on that night's date.
 *   From 22 Sep 2025: ≤ ₹7,500 → 5% (no ITC), > ₹7,500 → 18%.
 * - FOOD (restaurant / room service) and SERVICE (laundry, spa, transport, add-ons):
 *   a single rate per period.
 *
 * Supplies at the hotel are intra-state (place of supply = the property), so tax is
 * always split equally into CGST + SGST; there is no IGST for these supplies.
 */
import { type BusinessDate, stayNights, toBusinessDate } from "@shared/dates";

export type TaxCategory = "ROOM" | "FOOD" | "SERVICE";

export interface TaxBand {
  /** Inclusive upper bound of the per-night value for this band; null = no upper bound. */
  upTo: number | null;
  /** Total GST percentage (CGST + SGST). */
  rate: number;
}

export interface GstRule {
  category: TaxCategory;
  effectiveFrom: BusinessDate; // inclusive
  effectiveTo?: BusinessDate | null; // inclusive; null/undefined = open-ended
  bands: TaxBand[]; // ascending by upTo; last band has upTo null
}

export const DEFAULT_GST_RULES: GstRule[] = [
  // Accommodation before the Sept 2025 rationalisation.
  {
    category: "ROOM",
    effectiveFrom: "2017-07-01",
    effectiveTo: "2025-09-21",
    bands: [{ upTo: 1000, rate: 0 }, { upTo: 7500, rate: 12 }, { upTo: null, rate: 18 }],
  },
  // From 22 Sep 2025.
  { category: "ROOM", effectiveFrom: "2025-09-22", bands: [{ upTo: 7500, rate: 5 }, { upTo: null, rate: 18 }] },
  { category: "FOOD", effectiveFrom: "2017-07-01", bands: [{ upTo: null, rate: 5 }] },
  { category: "SERVICE", effectiveFrom: "2017-07-01", bands: [{ upTo: null, rate: 18 }] },
];

export interface TaxLine {
  category: TaxCategory;
  date: BusinessDate;
  taxable: number;
  rate: number; // total %, e.g. 5
  cgst: number;
  sgst: number;
  tax: number;
}

export interface TaxResult {
  taxable: number;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
  /** Per night (ROOM) or single entry (FOOD / SERVICE). */
  lines: TaxLine[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Validates a rule set; throws with a message suitable for a 400 response. */
export function validateGstRules(rules: GstRule[]): void {
  const byCat = new Map<TaxCategory, GstRule[]>();
  for (const r of rules) {
    if (!["ROOM", "FOOD", "SERVICE"].includes(r.category)) throw new Error(`Unknown tax category ${r.category}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom)) throw new Error("effectiveFrom must be YYYY-MM-DD");
    if (r.effectiveTo && r.effectiveTo < r.effectiveFrom) throw new Error("effectiveTo is before effectiveFrom");
    if (!r.bands?.length) throw new Error(`${r.category} rule from ${r.effectiveFrom} has no bands`);
    r.bands.forEach((b, i) => {
      if (!(b.rate >= 0 && b.rate <= 40)) throw new Error(`GST rate ${b.rate}% is out of range`);
      const last = i === r.bands.length - 1;
      if (last !== (b.upTo === null)) throw new Error("Only the last band may (and must) be open-ended (upTo: null)");
      if (i > 0 && b.upTo !== null && b.upTo <= (r.bands[i - 1].upTo as number)) throw new Error("Band limits must increase");
    });
    byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  }
  for (const [cat, list] of byCat) {
    const sorted = [...list].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].effectiveTo;
      if (!prevEnd || prevEnd >= sorted[i].effectiveFrom) throw new Error(`${cat} rules overlap at ${sorted[i].effectiveFrom}`);
    }
  }
}

function ruleFor(rules: GstRule[], category: TaxCategory, date: BusinessDate): GstRule {
  const rule = rules.find(
    (r) => r.category === category && r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date),
  );
  if (!rule) throw new Error(`No ${category} GST rule in force on ${date}`);
  return rule;
}

/** Total GST % for a category on a date; for ROOM, `perNightValue` selects the band. */
export function gstRate(rules: GstRule[], category: TaxCategory, date: BusinessDate, perNightValue = 0): number {
  const rule = ruleFor(rules, category, date);
  const band = rule.bands.find((b) => b.upTo === null || perNightValue <= b.upTo)!;
  return band.rate;
}

function line(category: TaxCategory, date: BusinessDate, taxable: number, rate: number): TaxLine {
  const half = round2((taxable * rate) / 200);
  return { category, date, taxable: round2(taxable), rate, cgst: half, sgst: half, tax: round2(half * 2) };
}

function sum(lines: TaxLine[]): TaxResult {
  const taxable = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const cgst = round2(lines.reduce((s, l) => s + l.cgst, 0));
  const sgst = round2(lines.reduce((s, l) => s + l.sgst, 0));
  const tax = round2(cgst + sgst);
  return { taxable, cgst, sgst, tax, total: round2(taxable + tax), lines };
}

/**
 * Room-stay GST. `nightlyValue` is what is charged per room per night after discounts
 * (it selects the slab). Each night is taxed under the rule in force on its date.
 */
export function computeRoomTax(
  rules: GstRule[],
  stay: { checkIn: Date | string; checkOut: Date | string; nightlyValue: number; rooms?: number },
): TaxResult {
  const rooms = Math.max(1, stay.rooms ?? 1);
  const dates = stayNights(stay.checkIn, stay.checkOut);
  const nightsList = dates.length ? dates : [toBusinessDate(stay.checkIn)]; // day use: one charge at check-in date
  return sum(
    nightsList.map((d) => line("ROOM", d, stay.nightlyValue * rooms, gstRate(rules, "ROOM", d, stay.nightlyValue))),
  );
}

/** One room night (night audit posting). */
export function computeRoomNightTax(rules: GstRule[], nightDate: BusinessDate, nightlyValue: number): TaxResult {
  return sum([line("ROOM", nightDate, nightlyValue, gstRate(rules, "ROOM", nightDate, nightlyValue))]);
}

/** FOOD / SERVICE supply on a date. */
export function computeSupplyTax(
  rules: GstRule[],
  category: Exclude<TaxCategory, "ROOM">,
  date: Date | string,
  taxable: number,
): TaxResult {
  const d = toBusinessDate(date);
  return sum([line(category, d, taxable, gstRate(rules, category, d))]);
}

/**
 * Splits an already-quoted total tax into CGST/SGST halves (e.g. tax the guest was
 * quoted at booking time). Halves are rounded so that cgst + sgst === tax exactly.
 */
export function splitTax(tax: number): { cgst: number; sgst: number } {
  const cgst = round2(tax / 2);
  return { cgst, sgst: round2(tax - cgst) };
}

/** GST category of a folio charge line type; null for lines that are not taxable supplies. */
export function taxCategoryForLine(lineType: string): TaxCategory | null {
  switch (lineType) {
    case "ROOM_CHARGE":
    case "EXTRA_BED":
    case "EXTRA_PERSON":
    case "EARLY_CHECK_IN":
    case "LATE_CHECK_OUT":
      return "ROOM";
    case "RESTAURANT":
    case "MINIBAR":
      return "FOOD";
    case "LAUNDRY":
    case "SPA":
    case "TRANSPORT":
    case "ADDON":
      return "SERVICE";
    default:
      return null;
  }
}

/**
 * GST on a single folio charge posted on `date`. Accommodation lines use
 * `nightlyValue` (the per-night value of the stay) to pick the slab; when it is not
 * known the charge itself is treated as one night.
 */
export function computeChargeTax(
  rules: GstRule[],
  lineType: string,
  amount: number,
  date: Date | string,
  opts: { nightlyValue?: number } = {},
): TaxResult | null {
  const category = taxCategoryForLine(lineType);
  if (!category) return null;
  const d = toBusinessDate(date);
  if (category === "ROOM") {
    const rate = gstRate(rules, "ROOM", d, opts.nightlyValue ?? amount);
    return sum([line("ROOM", d, amount, rate)]);
  }
  return computeSupplyTax(rules, category, d, amount);
}

/** The rules in force: settings overrides when present and valid, otherwise defaults. */
export async function loadGstRules(): Promise<GstRule[]> {
  const { HotelSettings } = await import("../models/HotelSettings");
  const settings: any = await HotelSettings.findOne().sort({ updatedAt: -1 }).select("gstRules").lean();
  const custom: GstRule[] | undefined = settings?.gstRules?.length ? settings.gstRules : undefined;
  if (!custom) return DEFAULT_GST_RULES;
  validateGstRules(custom);
  return custom;
}

/** Async conveniences for callers that do not hold the rules already. */
export const taxService = {
  rules: loadGstRules,
  async roomStay(stay: Parameters<typeof computeRoomTax>[1]) {
    return computeRoomTax(await loadGstRules(), stay);
  },
  async roomNight(nightDate: BusinessDate, nightlyValue: number) {
    return computeRoomNightTax(await loadGstRules(), nightDate, nightlyValue);
  },
  async supply(category: Exclude<TaxCategory, "ROOM">, date: Date | string, taxable: number) {
    return computeSupplyTax(await loadGstRules(), category, date, taxable);
  },
  split: splitTax,
};
