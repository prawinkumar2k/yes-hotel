/**
 * Pure booking-total math & authoritative revenue management engine, isolated
 * from ad-hoc frontend logic so that financial invariants (never negative,
 * discount caps by role, dynamic surge on high occupancy, and Indian GST rate tiers)
 * are enforced server-side.
 */

export interface DynamicPricingParams {
  basePrice: number;
  nights: number;
  ratePlanMultiplier?: number;
  occupancyPct?: number; // 0 to 100
  requestedDiscountAmount?: number;
  userRole?: string; // "RECEPTIONIST", "MANAGER", "ADMIN", etc.
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

  // Indian Hospitality GST Tiers:
  // Nightly rate <= ₹7,500 -> 12% GST (6% CGST + 6% SGST)
  // Nightly rate > ₹7,500 -> 18% GST (9% CGST + 9% SGST)
  const taxRate = effectiveNightlyRate > 7500 ? 0.18 : 0.12;

  const cgst = Math.round((taxableAmount * (taxRate / 2)) * 100) / 100;
  const sgst = Math.round((taxableAmount * (taxRate / 2)) * 100) / 100;
  const taxAmount = Math.round((cgst + sgst) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

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

/**
 * Backward compatibility wrapper for legacy calculateBookingTotals
 */
export function calculateBookingTotals(roomCharges: number, discountAmount: number): { taxableAmount: number; taxAmount: number; totalAmount: number } {
  const res = calculateDynamicBookingTotals({
    basePrice: roomCharges,
    nights: 1,
    requestedDiscountAmount: discountAmount,
    userRole: "ADMIN",
  });
  return {
    taxableAmount: res.taxableAmount,
    taxAmount: res.taxAmount,
    totalAmount: res.totalAmount,
  };
}
