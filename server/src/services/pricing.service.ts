/**
 * Pure booking-total math & authoritative revenue management engine, isolated
 * from ad-hoc frontend logic so that financial invariants (never negative,
 * discount caps by role, dynamic surge on high occupancy, and Indian GST rate tiers)
 * are enforced server-side.
 */
import { addDays, todayBusinessDate, type BusinessDate } from "../../../shared/dates";
import { computeRoomTax, type GstRule } from "./tax.service";

export interface DynamicPricingParams {
  basePrice: number;
  nights: number;
  ratePlanMultiplier?: number;
  occupancyPct?: number; // 0 to 100
  requestedDiscountAmount?: number;
  userRole?: string; // "RECEPTIONIST", "MANAGER", "ADMIN", etc.
  /** GST rules in force (taxService.rules()). */
  gstRules: GstRule[];
  /** First night of the stay; defaults to today at the property. Each night is taxed under the rule of its date. */
  checkIn?: BusinessDate;
}

export interface DynamicPricingResult {
  nightlyRate: number;
  grossRoomCharges: number;
  appliedDiscountAmount: number;
  taxableAmount: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  taxAmount: number;
  totalAmount: number;
  surgeMultiplier: number;
}

/**
 * Calculates role-gated maximum allowed manual discount.
 * - RECEPTIONIST / CASHIER: Max 10% of gross room charges or ₹1,000 (whichever is lower)
 * - MANAGER: Max 25% of gross room charges or ₹5,000 (whichever is lower)
 * - ADMIN / SUPER_ADMIN: Max 100% (unlimited)
 */
export function getMaxAllowedDiscount(grossRoomCharges: number, role: string = "RECEPTIONIST"): number {
  const upperRole = role.toUpperCase();
  if (upperRole === "ADMIN" || upperRole === "SUPER_ADMIN") {
    return grossRoomCharges;
  }
  if (upperRole === "MANAGER") {
    return Math.min(grossRoomCharges * 0.25, 5000);
  }
  // Default staff / receptionist limit
  return Math.min(grossRoomCharges * 0.10, 1000);
}

/**
 * Authoritative Revenue Management & Pricing Calculator
 */
export function calculateDynamicBookingTotals(params: DynamicPricingParams): DynamicPricingResult {
  const basePrice = Math.max(0, params.basePrice);
  const nights = Math.max(1, params.nights);
  const planMultiplier = Math.max(0.1, params.ratePlanMultiplier ?? 1.0);

  // Dynamic occupancy surge adjustment
  let surgeMultiplier = 1.0;
  const occ = params.occupancyPct ?? 0;
  if (occ >= 90) {
    surgeMultiplier = 1.25; // 25% high occupancy surge
  } else if (occ >= 80) {
    surgeMultiplier = 1.15; // 15% surge
  }

  const effectiveNightlyRate = Math.round(basePrice * planMultiplier * surgeMultiplier);
  const grossRoomCharges = effectiveNightlyRate * nights;

  // Enforce role-gated discount caps
  const maxDiscount = getMaxAllowedDiscount(grossRoomCharges, params.userRole ?? "RECEPTIONIST");
  const requestedDiscount = Math.max(0, params.requestedDiscountAmount ?? 0);
  const appliedDiscountAmount = Math.min(requestedDiscount, maxDiscount, grossRoomCharges);

  const taxableAmount = Math.max(0, grossRoomCharges - appliedDiscountAmount);

  // GST via taxService: the slab is chosen by the value actually charged per
  // night (after discount), and each night uses the rule in force on its date.
  const checkIn = params.checkIn ?? todayBusinessDate();
  const tax = computeRoomTax(params.gstRules, {
    checkIn,
    checkOut: addDays(checkIn, nights),
    nightlyValue: taxableAmount / nights,
  });
  const taxRate = Math.max(...tax.lines.map((l) => l.rate)) / 100;
  const { cgst, sgst } = tax;
  const taxAmount = tax.tax;
  const totalAmount = tax.total;

  return {
    nightlyRate: effectiveNightlyRate,
    grossRoomCharges,
    appliedDiscountAmount,
    taxableAmount,
    taxRate,
    cgst,
    sgst,
    taxAmount,
    totalAmount,
    surgeMultiplier,
  };
}

