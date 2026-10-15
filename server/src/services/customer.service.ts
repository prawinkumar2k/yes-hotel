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

// ─────────────────────────────────────────────── email one-time code sign-in
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_GAP_MS = 45 * 1000;

const otpHash = (email: string, code: string) =>
  crypto.createHmac("sha256", process.env.JWT_ACCESS_SECRET || "dev-otp-secret").update(`${email}:${code}`).digest("hex");

/** A guest the email belongs to: a customer account, or any booking made with that email. Never staff. */
async function guestKnownByEmail(email: string) {
  const user = await User.findOne({ email }).select("role isActive").lean();
  if (user) return user.role === UserRole.CUSTOMER && user.isActive !== false;
  return Boolean(await Booking.exists({ "guestDetails.email": email }));
}

/**
 * Emails a 6-digit sign-in code when the address belongs to a guest. The caller always shows the
 * same reply, so the form can't be used to discover who has stayed at the hotel.
 * Returns how delivery went: SENT, DEV_LOGGED (no mail server, development), UNKNOWN (no guest),
 * TOO_SOON (a code was sent seconds ago), or UNAVAILABLE (no mail server in production).
 */
export async function requestLoginOtp(rawEmail: string, ip?: string): Promise<"SENT" | "DEV_LOGGED" | "UNKNOWN" | "TOO_SOON" | "UNAVAILABLE"> {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!(await guestKnownByEmail(email))) return "UNKNOWN";
  const { LoginOtp } = await import("../models/LoginOtp");
  const recent = await LoginOtp.findOne({ email, consumedAt: { $exists: false } }).sort({ createdAt: -1 }).lean();
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < OTP_RESEND_GAP_MS) return "TOO_SOON";

  const { getTransporter } = await import("./notification.service");
  const transporter = getTransporter();
  if (!transporter && process.env.NODE_ENV === "production") return "UNAVAILABLE";

  const code = String(crypto.randomInt(100000, 1000000));
  // Older unused codes stop working once a new one is issued.
  await LoginOtp.updateMany({ email, consumedAt: { $exists: false } }, { $set: { consumedAt: new Date() } });
  await LoginOtp.create({ email, codeHash: otpHash(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), ip });

  const subject = `${code} is your YES HOTELS sign-in code`;
  const text = `Your YES HOTELS sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.\n\nYES HOTELS, Hosa Road Junction, Bengaluru · +91 87698 28787`;
  if (!transporter) {
    console.log(`\n🔐 [DEV ONLY — no mail server] sign-in code for ${email}: ${code}\n`);
    return "DEV_LOGGED";
  }
  await transporter.sendMail({
    from: `"YES HOTELS" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px"><img src="${(process.env.CLIENT_URL || "").replace(/\/$/, "")}/brand/yes-hotels-logo-sm.png" alt="YES HOTELS" style="height:72px"><p>Your sign-in code is</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:8px 0">${code}</p><p style="color:#555">It expires in 10 minutes. If you didn't ask for it, ignore this email.</p><p style="color:#888;font-size:12px">YES HOTELS · Hosa Road Junction, Bengaluru · +91 87698 28787</p></div>`,
  });
  return "SENT";
}

/** Checks a code; on success returns the guest's customer account (created if needed) with their bookings linked. */
export async function verifyLoginOtp(rawEmail: string, rawCode: string) {
  const email = String(rawEmail || "").trim().toLowerCase();
  const code = String(rawCode || "").trim();
  const { LoginOtp } = await import("../models/LoginOtp");
  const otp = await LoginOtp.findOne({ email, consumedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!otp) throw new CustomerRuleError("This code has expired. Ask for a new one.", 401);
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new CustomerRuleError("Too many wrong codes. Ask for a new one.", 429);
  const expected = Buffer.from(otp.codeHash, "hex");
  const given = Buffer.from(otpHash(email, code), "hex");
  if (!/^\d{6}$/.test(code) || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    await LoginOtp.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } });
    throw new CustomerRuleError("That code is not right. Check the email and try again.", 401);
  }
  // Single use, even under concurrent submits.
  const claimed = await LoginOtp.updateOne({ _id: otp._id, consumedAt: { $exists: false } }, { $set: { consumedAt: new Date() } });
  if (!claimed.modifiedCount) throw new CustomerRuleError("This code was already used. Ask for a new one.", 401);

  let user: any = await User.findOne({ email });
  if (user && user.role !== UserRole.CUSTOMER) throw new CustomerRuleError("Staff sign in with their password", 403);
  if (user && user.isActive === false) throw new CustomerRuleError("This guest account is disabled", 403);
  if (!user) {
    const b: any = await Booking.findOne({ "guestDetails.email": email }).sort({ createdAt: -1 }).lean();
    if (!b) throw new CustomerRuleError("No guest account or booking uses this email", 404);
    user = await User.create({
      firstName: b.guestDetails?.firstName || "Guest",
      lastName: b.guestDetails?.lastName && b.guestDetails.lastName !== "." ? b.guestDetails.lastName : "Guest",
      email,
      phone: b.guestDetails?.phone,
      passwordHash: await hashPassword(crypto.randomBytes(24).toString("hex")),
      role: UserRole.CUSTOMER,
      isActive: true,
    } as any);
  }
  // The email is now proven: its unlinked bookings belong to this guest.
  const linked = await Booking.updateMany({ "guestDetails.email": email, customer: { $exists: false } }, { $set: { customer: user._id } });
  return { user, linkedBookings: linked.modifiedCount };
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
