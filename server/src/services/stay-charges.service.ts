/**
 * Posts a stay's charges to its bill (folio) — the one place that does it, for walk-in
 * registration, check-in and any stay checked in without charges yet:
 *   room tariff for every night (marked with the nights it covers, so the night audit never
 *   charges them again), extra persons / beds, meal plan and other charges, then CGST + SGST.
 *
 * Prices including GST (booking.pricesIncludeTax): the amounts typed are what the guest pays.
 * The GST is worked out of them, the charge lines carry the value excluding GST and the GST
 * lines the tax, so the bill total equals the agreed price.
 */
import type { ClientSession } from "mongoose";
import { FolioLineType } from "../models/FolioLine";
import { HotelSettings } from "../models/HotelSettings";
import { postCharge } from "./folio.service";
import { stayExtraRates } from "./tariff.service";
import { computeRoomTax, loadGstRules, netOfIncludedTax, pricesIncludeTax } from "./tax.service";
import { nights as countNights, stayNights, toBusinessDate } from "../../../shared/dates";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Extra-person / bed rates: those agreed at registration (stored on the booking), else the room category's, else the property defaults. */
export function walkInExtraRates(settings: any, overrides: any, category?: any) {
  return stayExtraRates(settings, overrides, category);
}

export type StayChargeResult = { taxable: number; cgst: number; sgst: number; tax: number; total: number };

export async function postStayCharges(p: {
  booking: any;
  folioId: string;
  roomNumber?: string;
  postedBy: string;
  req?: any;
  session?: ClientSession;
  /** Meal plan and other charges agreed at registration (primary room only). */
  mealPlanTotal?: number;
  otherCharges?: number;
  otherChargesDesc?: string;
}): Promise<StayChargeResult> {
  const b = p.booking;
  const checkIn = new Date(b.checkInDate);
  const checkOut = new Date(b.checkOutDate);
  const hourly = b.stayType === "HOURLY";
  const nights = Math.max(1, countNights(checkIn, checkOut));
  const covered = hourly ? [toBusinessDate(checkIn)] : stayNights(checkIn, checkOut);
  const settings: any = await HotelSettings.findOne().session(p.session ?? null).lean();
  const x = walkInExtraRates(settings, b.extraRates);
  const per = hourly ? 1 : nights;
  const inclusive = pricesIncludeTax(b);
  // The agreed nightly price; bookings without one (website) use their total, which already
  // includes GST when the prices include it, and excludes it otherwise.
  const rate = Number(b.ratePerNight) || (inclusive ? Number(b.totalAmount) : Number(b.totalAmount) - Number(b.taxAmount || 0)) / per || 0;
  const room = `Room ${p.roomNumber ?? ""}`.trim();

  // Charges at the agreed prices (including GST when the booking's prices include it).
  const charges: { lineType: FolioLineType; description: string; amount: number; coversNights?: string[] }[] = [
    {
      lineType: FolioLineType.ROOM_CHARGE,
      description: hourly ? `Room Charge (Hourly) — ${room} (${b.hours || 1} hours)` : `Room Tariff — ${room} (${nights} night${nights > 1 ? "s" : ""} @ ₹${r2(rate).toLocaleString("en-IN")})`,
      amount: r2(rate * per),
      coversNights: covered,
    },
    { lineType: FolioLineType.EXTRA_BED, description: `Adult Extra Pax (No Bed) (${b.extraPersonsNoBed} pax × ${nights} nights)`, amount: (b.extraPersonsNoBed ?? 0) * x.extraPersonRate * nights },
    { lineType: FolioLineType.EXTRA_BED, description: `Adult Extra Pax (With Bed) (${b.extraPersonsWithBed} bed(s) × ${nights} nights)`, amount: (b.extraPersonsWithBed ?? 0) * x.extraBedRate * nights },
    { lineType: FolioLineType.EXTRA_BED, description: `Child 3-12 (No Bed) (${b.extraChildrenNoBed} child(ren) × ${nights} nights)`, amount: (b.extraChildrenNoBed ?? 0) * x.childRateNoBed * nights },
    { lineType: FolioLineType.EXTRA_BED, description: `Child 3-12 (With Bed) (${b.extraChildrenWithBed} bed(s) × ${nights} nights)`, amount: (b.extraChildrenWithBed ?? 0) * x.childRateWithBed * nights },
    { lineType: FolioLineType.ADDON, description: `Meal Plan (${b.mealPlan || "plan"})`, amount: Number(p.mealPlanTotal) || 0 },
    { lineType: FolioLineType.ADDON, description: p.otherChargesDesc || "Other Charges", amount: Number(p.otherCharges) || 0 },
  ].filter((c) => c.amount > 0);

  const gross = r2(charges.reduce((t, c) => t + c.amount, 0));
  if (gross <= 0) return { taxable: 0, cgst: 0, sgst: 0, tax: 0, total: 0 };
  const tax = computeRoomTax(await loadGstRules(), { checkIn, checkOut, nightlyValue: gross / per, inclusive });
  const amounts = inclusive ? netOfIncludedTax(charges.map((c) => c.amount), tax.tax) : charges.map((c) => c.amount);

  const common = { folioId: p.folioId, bookingId: String(b._id), date: new Date(), postedBy: p.postedBy };
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    await postCharge({ ...common, lineType: c.lineType, description: c.description, amount: amounts[i], ...(c.coversNights ? { coversNights: c.coversNights } : {}) }, { req: p.req, session: p.session });
  }
  const pct = Math.max(...tax.lines.map((l) => l.rate)) / 2;
  if (tax.cgst > 0) await postCharge({ ...common, lineType: FolioLineType.TAX_CGST, description: `CGST (${pct}%) on Room Tariff`, amount: tax.cgst }, { req: p.req, session: p.session });
  if (tax.sgst > 0) await postCharge({ ...common, lineType: FolioLineType.TAX_SGST, description: `SGST (${pct}%) on Room Tariff`, amount: tax.sgst }, { req: p.req, session: p.session });

  return { taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, tax: tax.tax, total: inclusive ? gross : r2(gross + tax.tax) };
}
