/**
 * Customer self-service.
 *
 *   Proof of a stay  = booking reference + the guest's mobile on that booking (last 10 digits).
 *                      Used to sign in without a password and to add a stay to an account.
 *                      Stays booked together (same groupId) come with it.
 *   Amount due       = open folio balance when the guest is in-house; before arrival, the
 *                      booking total less completed payments and advances held.
 *   Balance payment  = a Payment (and, in-house, a folio PAYMENT line) recorded once per
 *                      gateway payment id.
 */
import mongoose from "mongoose";
import crypto from "node:crypto";
import { Booking, BookingStatus } from "../models/Booking";
import { User, UserRole } from "../models/User";
import { Folio, FolioStatus } from "../models/Folio";
import { Payment } from "../models/Payment";
import { AdvancePayment } from "../models/AdvancePayment";
import { hashPassword } from "../utils/auth";
import { recomputeFolioBalance, recordFolioPayment } from "./folio.service";
import { isPlaceholderEmail } from "./guest-stats.service";

export class CustomerRuleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The booking proven by reference + mobile, or null (same answer for "no such booking" and "wrong mobile"). */
export async function findBookingByProof(bookingReference: string, mobile: string) {
  const ref = String(bookingReference ?? "").trim();
  const mob = digits(mobile);
  if (ref.length < 3 || mob.length < 10) return null;
  const booking: any = await Booking.findOne({ bookingReference: { $regex: `^${escapeRegex(ref)}$`, $options: "i" } });
  if (!booking || digits(booking.guestDetails?.phone) !== mob) return null;
  return booking;
}

/**
 * The customer account for a proven stay: the one already linked, else a customer with the
 * booking's real email, else a new customer account (no password; the guest signs in with
 * booking + mobile and can set a password later). Never a staff account.
 */
export async function customerAccountForBooking(booking: any) {
  if (booking.customer) {
    const linked = await User.findById(booking.customer);
    if (linked?.role === UserRole.CUSTOMER) return linked;
    if (linked) throw new CustomerRuleError("This booking belongs to a staff account; please contact Reception", 409);
  }
  const email = String(booking.guestDetails?.email ?? "").trim().toLowerCase();
  const mobile = digits(booking.guestDetails?.phone);
  const loginEmail = email && !isPlaceholderEmail(email) ? email : `guest+${mobile}@guests.yeshotels.local`;
  const existing = await User.findOne({ email: loginEmail });
  if (existing) {
    if (existing.role !== UserRole.CUSTOMER) throw new CustomerRuleError("This booking is linked to a staff email; please contact Reception", 409);
    if (!existing.isActive) throw new CustomerRuleError("This guest account is disabled", 403);
    return existing;
  }
  return User.create({
    firstName: booking.guestDetails?.firstName || "Guest",
    lastName: booking.guestDetails?.lastName && booking.guestDetails.lastName !== "." ? booking.guestDetails.lastName : "Guest",
    email: loginEmail,
    phone: booking.guestDetails?.phone,
    passwordHash: await hashPassword(crypto.randomBytes(24).toString("hex")),
    role: UserRole.CUSTOMER,
    isActive: true,
  } as any);
}

/** Links a proven stay (and the rooms booked with it) to the customer. Returns the linked booking ids. */
export async function linkStayToCustomer(booking: any, customerId: unknown) {
  const filter = booking.groupId ? { groupId: booking.groupId } : { _id: booking._id };
  const group = await Booking.find(filter).select("_id customer guestDetails").lean();
  const proof = digits(booking.guestDetails?.phone);
  // Only stays with the same mobile are linked, and never one already linked to someone else.
  const ids = group
    .filter((b: any) => (!b.customer || String(b.customer) === String(customerId)) && digits(b.guestDetails?.phone) === proof)
    .map((b: any) => b._id);
  if (ids.length) await Booking.updateMany({ _id: { $in: ids } }, { $set: { customer: customerId } });
  return ids.map(String);
}

/** What the guest still owes on a booking. */
export async function amountDueForBooking(booking: any) {
  if ([BookingStatus.CANCELLED, BookingStatus.NO_SHOW].includes(booking.status)) return { amountDue: 0, basis: "CLOSED" as const };
  const folio = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN }).lean();
  if (folio) {
    const t = await recomputeFolioBalance(String(folio._id));
    return { amountDue: r2(Math.max(0, t.balance)), basis: "FOLIO" as const, folioId: String(folio._id) };
  }
  if (booking.status === BookingStatus.CHECKED_OUT) return { amountDue: 0, basis: "CLOSED" as const };
  const [paid, adv] = await Promise.all([
    Payment.aggregate([{ $match: { booking: booking._id, status: { $in: ["COMPLETED", "PARTIALLY_REFUNDED"] } } }, { $group: { _id: null, t: { $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] } } } }]),
    AdvancePayment.aggregate([{ $match: { booking: booking._id } }, { $group: { _id: null, t: { $sum: { $subtract: ["$amount", { $ifNull: ["$totalRefunded", 0] }] } } } }]),
  ]);
  const received = (paid[0]?.t ?? 0) + (adv[0]?.t ?? 0);
  return { amountDue: r2(Math.max(0, (booking.totalAmount ?? 0) - received)), basis: "BOOKING" as const };
}

/**
 * Records a successful balance payment once (keyed by the gateway payment id): a Payment, plus a
 * folio PAYMENT line when the guest is in-house. Before arrival the Payment is posted to the folio
 * at check-in by the existing check-in flow.
 */
export async function recordBalancePayment(p: {
  booking: any;
  amount: number;
  gatewayPaymentId: string;
  gatewayOrderId?: string;
  signature?: string;
  method: "RAZORPAY";
  req?: any;
}) {
  const already = await Payment.findOne({ razorpayPaymentId: p.gatewayPaymentId }).lean();
  if (already) return { payment: already, duplicate: true };
  const session = await mongoose.startSession();
  try {
    let payment: any;
    await session.withTransaction(async () => {
      const folio = await Folio.findOne({ booking: p.booking._id, status: FolioStatus.OPEN }).session(session);
      if (folio) {
        const out = await recordFolioPayment(
          {
            folioId: String(folio._id),
            bookingId: String(p.booking._id),
            amount: p.amount,
            method: p.method,
            description: "Online payment (guest)",
            postedBy: String(p.booking.customer ?? "GUEST"),
            propertyId: p.booking.propertyId,
            clientRequestId: `gw:${p.gatewayPaymentId}`,
            reference: p.gatewayPaymentId,
          },
          { req: p.req, session },
        );
        payment = out.payment;
        await Payment.updateOne({ _id: payment._id }, { $set: { razorpayPaymentId: p.gatewayPaymentId, razorpayOrderId: p.gatewayOrderId, razorpaySignature: p.signature } }, { session });
      } else {
        const { nextTransactionId } = await import("./folio.service");
        [payment] = await (Payment as any).create(
          [{
            propertyId: p.booking.propertyId,
            booking: p.booking._id,
            amount: p.amount,
            currency: "INR",
            method: p.method,
            status: "COMPLETED",
            transactionId: await nextTransactionId(session),
            clientRequestId: `gw:${p.gatewayPaymentId}`,
            razorpayPaymentId: p.gatewayPaymentId,
            razorpayOrderId: p.gatewayOrderId,
            razorpaySignature: p.signature,
            reference: p.gatewayPaymentId,
          }],
          { session },
        );
      }
    });
    const due = await amountDueForBooking(await Booking.findById(p.booking._id));
    await Booking.updateOne({ _id: p.booking._id }, { $set: { paymentStatus: due.amountDue <= 0 ? "PAID" : "PARTIAL" } });
    return { payment, duplicate: false };
  } catch (e: any) {
    if (e?.code === 11000) return { payment: await Payment.findOne({ razorpayPaymentId: p.gatewayPaymentId }).lean(), duplicate: true };
    throw e;
  } finally {
    await session.endSession();
  }
}
