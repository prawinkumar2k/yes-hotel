/**
 * Pure booking-total math, isolated from DB/request handling so the actual
 * arithmetic invariants (never negative, discount never exceeds the taxable
 * base, tax computed on the post-discount amount, total = taxable + tax) can
 * be unit-tested directly rather than only exercised indirectly through a
 * full booking-creation integration test.
 */
export const GST_RATE = 0.18;

export interface BookingTotals {
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * @param roomCharges  basePrice * nights, always >= 0 by construction (a
 *   negative basePrice or negative night count should never reach here —
 *   callers are responsible for that upstream validation).
 * @param discountAmount  Already capped at roomCharges by
 *   coupon.service#calculateDiscount — this function re-clamps anyway so it
 *   holds even if a caller passes an uncapped value.
 */
export function calculateBookingTotals(roomCharges: number, discountAmount: number): BookingTotals {
  const taxableAmount = Math.max(roomCharges - Math.max(discountAmount, 0), 0);
  const taxAmount = Math.round(taxableAmount * GST_RATE);
  const totalAmount = taxableAmount + taxAmount;
  return { taxableAmount, taxAmount, totalAmount };
}
