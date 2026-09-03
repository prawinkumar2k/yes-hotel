import { Coupon, ICoupon } from "../models/Coupon";
import { Booking, BookingStatus } from "../models/Booking";

export interface CouponCalculation {
  coupon: ICoupon;
  discount: number;
}

/**
 * Single authoritative coupon validation + discount calculation.
 * Used both by the checkout preview endpoint and by booking creation —
 * the frontend-supplied discount is never trusted.
 */
export async function validateAndCalculateCoupon(params: {
  code: string;
  bookingAmount: number;
  roomCategoryId?: string;
  guestEmail?: string;
}): Promise<CouponCalculation> {
  const { code, bookingAmount, roomCategoryId, guestEmail } = params;

  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new Error("Invalid or inactive coupon");

  const now = new Date();
  if (now < coupon.startDate || now > coupon.expiryDate) {
    throw new Error("Coupon expired or not active yet");
  }

  if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
    throw new Error("Coupon usage limit reached");
  }

  if (coupon.minBookingAmount && bookingAmount < coupon.minBookingAmount) {
    throw new Error(`Minimum booking amount of ₹${coupon.minBookingAmount} required`);
  }

  if (coupon.applicableRoomCategories && coupon.applicableRoomCategories.length > 0) {
    if (!roomCategoryId || !coupon.applicableRoomCategories.map((c) => c.toString()).includes(roomCategoryId)) {
      throw new Error("Coupon not applicable to this room category");
    }
  }

  if (guestEmail && coupon.perUserLimit) {
    const pastUses = await Booking.countDocuments({
      "guestDetails.email": guestEmail,
      appliedCoupon: coupon.code,
      status: { $ne: BookingStatus.CANCELLED },
      couponRedeemed: true,
    });
    if (pastUses >= coupon.perUserLimit) {
      throw new Error("You have exceeded the usage limit for this coupon");
    }
  }

  const discount = calculateDiscount(
    { discountType: coupon.discountType, discountValue: coupon.discountValue, maxDiscount: coupon.maxDiscount },
    bookingAmount
  );

  return { coupon, discount };
}

/**
 * Pure discount math, isolated from DB access so it can be unit-tested directly.
 */
export function calculateDiscount(
  coupon: { discountType: string; discountValue: number; maxDiscount?: number },
  bookingAmount: number
): number {
  let discount = 0;
  if (coupon.discountType === "FIXED") {
    discount = coupon.discountValue;
  } else {
    discount = (bookingAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  }
  discount = Math.min(discount, bookingAmount);
  return Math.round(discount);
}

/**
 * Atomically marks a coupon as redeemed for a booking once payment succeeds.
 * The $expr guard re-checks the usage limit at increment time so concurrent
 * payments cannot push timesUsed past usageLimit — this is the point of
 * truth for consumption, not booking creation.
 */
export async function redeemCouponForBooking(bookingId: string): Promise<boolean> {
  const booking = await Booking.findById(bookingId);
  if (!booking || !booking.appliedCoupon || booking.couponRedeemed) return false;

  const filter: any = { code: booking.appliedCoupon, isActive: true };
  const update: any = { $inc: { timesUsed: 1 } };

  const coupon = await Coupon.findOneAndUpdate(
    {
      ...filter,
      $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { $expr: { $lt: ["$timesUsed", "$usageLimit"] } }],
    },
    update,
    { new: true }
  );

  if (!coupon) return false;

  booking.couponRedeemed = true;
  await booking.save();
  return true;
}

/**
 * Releases a coupon redemption when the booking it was used on is cancelled.
 * Without this, a cancelled (and refunded) booking permanently consumes a
 * usageLimit slot forever, and the per-user limit check already excludes
 * CANCELLED bookings — this keeps the global counter consistent with that
 * same rule instead of only fixing it on one side.
 */
export async function releaseCouponForCancelledBooking(bookingId: string): Promise<boolean> {
  const booking = await Booking.findById(bookingId);
  if (!booking || !booking.appliedCoupon || !booking.couponRedeemed) return false;

  await Coupon.updateOne(
    { code: booking.appliedCoupon, timesUsed: { $gt: 0 } },
    { $inc: { timesUsed: -1 } }
  );

  booking.couponRedeemed = false;
  await booking.save();
  return true;
}
