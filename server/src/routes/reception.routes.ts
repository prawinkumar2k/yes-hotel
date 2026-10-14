/**
 * Reception — Cashier & Billing and the checkout handoff.
 *
 *   GET  /api/reception/billing-queue                    in-house stays to bill: due out / overdue /
 *                                                       checkout initiated, with balance and advances
 *   POST /api/reception/bookings/:id/checkout/initiate   Front Desk sends the stay to billing
 *   POST /api/reception/folios/:folioId/payments         record money received (idempotent per clientRequestId)
 *   POST /api/reception/folios/:folioId/apply-advances   apply the guest's advances (capped at the amount due)
 *   POST /api/reception/folios/:folioId/refunds          return a guest credit (queued for verification)
 *   GET  /api/reception/payments/:id/receipt             payment receipt data
 *
 * Checkout itself stays POST /api/bookings/:id/check-out (it requires the bill at exactly ₹0).
 */
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { protect } from "../middleware/auth.middleware";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment, AdvancePaymentStatus } from "../models/AdvancePayment";
import { Payment } from "../models/Payment";
import { recordFolioPayment, recomputeFolioBalance, postCharge } from "../services/folio.service";
import { applyAdvancesToFolio } from "../services/advance.service";
import { submitForVerification } from "../services/verification.service";
import { VerificationType } from "../models/VerificationRequest";
import { createAuditLog } from "../services/audit.service";
import { businessDayRange, todayBusinessDate } from "../../../shared/dates";
import "../models/Room";
import "../models/RoomCategory";
import "../models/User";

const router = Router();
router.use(protect, requirePropertyAccess);

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const METHODS = ["CASH", "CARD", "UPI", "RAZORPAY"] as const;
const actorId = (req: Request) => String((req as any).user?.id ?? "");
const guestName = (b: any) => `${b.guestDetails?.firstName ?? ""} ${b.guestDetails?.lastName ?? ""}`.replace(/\s+\.$/, "").trim();
const fail = (res: Response, status: number, message: string, extra: Record<string, unknown> = {}) => res.status(status).json({ success: false, message, ...extra });

async function openFolio(folioId: string) {
  if (!mongoose.Types.ObjectId.isValid(folioId)) return { error: [400, "Invalid folio"] as const };
  const folio = await Folio.findById(folioId);
  if (!folio) return { error: [404, "Folio not found"] as const };
  if (folio.status !== FolioStatus.OPEN) return { error: [409, `The folio is ${folio.status}; it can no longer take payments`] as const };
  return { folio };
}

/** Advances still available for a booking (linked to it, or the guest's unallocated deposits). */
async function availableAdvances(booking: any) {
  const advances = await AdvancePayment.find({
    $or: [{ booking: booking._id }, ...(booking.customer ? [{ guest: booking.customer, booking: { $in: [null, undefined] } }] : [])],
    remainingBalance: { $gt: 0 },
    status: { $in: [AdvancePaymentStatus.RECEIVED, AdvancePaymentStatus.PARTIALLY_ADJUSTED, AdvancePaymentStatus.PARTIALLY_REFUNDED] },
  } as any).select("advanceNumber remainingBalance method").lean();
  return { total: r2(advances.reduce((t, a: any) => t + (a.remainingBalance || 0), 0)), advances };
}

// ── Billing queue ────────────────────────────────────────────────────────────
router.get("/billing-queue", requirePermission("CASHIER_DESK", "VIEW"), async (req: Request, res: Response) => {
  try {
    const endToday = businessDayRange(todayBusinessDate()).end;
    const scope = (req as any).propertyId ? { propertyId: (req as any).propertyId } : {};
    const all = req.query.all === "true";
    const bookings = await Booking.find({
      ...scope,
      status: BookingStatus.CHECKED_IN,
      ...(all ? {} : { $or: [{ checkOutDate: { $lt: endToday } }, { "checkoutClearance.status": "PENDING" }] }),
    } as any)
      .populate("assignedRoom", "roomNumber")
      .populate("roomCategory", "name")
      .sort({ checkOutDate: 1 })
      .lean();
    const folios = await Folio.find({ booking: { $in: bookings.map((b) => b._id) } }).lean();
    const folioOf = new Map(folios.map((f: any) => [String(f.booking), f]));
    const rows = await Promise.all(
      bookings.map(async (b: any) => {
        const f: any = folioOf.get(String(b._id));
        const totals = f ? await recomputeFolioBalance(String(f._id)) : null;
        const adv = await availableAdvances(b);
        return {
          bookingId: b._id,
          bookingReference: b.bookingReference,
          billNumber: b.billNumber,
          guest: guestName(b),
          phone: b.guestDetails?.phone,
          room: b.assignedRoom?.roomNumber,
          category: b.roomCategory?.name,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          overdue: new Date(b.checkOutDate) < businessDayRange(todayBusinessDate()).start,
          checkoutInitiated: b.checkoutClearance?.status === "PENDING" || b.checkoutClearance?.status === "CLEARED",
          checkoutInitiatedAt: b.checkoutClearance?.initiatedAt,
          folioId: f?._id,
          folioStatus: f?.status,
          charges: totals ? r2(totals.totalCharges + totals.totalTax - totals.totalDiscounts) : 0,
          paid: totals ? r2(totals.totalPaid) : 0,
          advancesApplied: totals ? r2(totals.totalAdvanceAdjusted) : 0,
          refunded: totals ? r2((totals as any).totalRefunded ?? 0) : 0,
          balance: totals ? totals.balance : 0,
          advanceAvailable: adv.total,
          readyToCheckOut: !!f && totals?.balance === 0,
        };
      }),
    );
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    return fail(res, 500, error.message);
  }
});

// ── Front Desk → billing handoff ─────────────────────────────────────────────
router.post("/bookings/:id/checkout/initiate", requirePermission("CHECK_OUT", "CHECK_OUT"), async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return fail(res, 404, "Booking not found");
    if (booking.status !== BookingStatus.CHECKED_IN) return fail(res, 409, `Only an in-house stay can be sent for checkout (this one is ${booking.status})`);
    if (booking.checkoutClearance?.status) {
      return res.json({ success: true, message: "Already waiting in Cashier & Billing", data: booking.checkoutClearance });
    }
    booking.checkoutClearance = { status: "PENDING", initiatedBy: actorId(req) as any, initiatedAt: new Date(), note: req.body?.note };
    await booking.save();
    await createAuditLog({ req, action: "booking.checkout_initiated", resourceType: "Booking", resourceId: String(booking._id), metadata: { bookingReference: booking.bookingReference } });
    return res.json({ success: true, message: "Sent to Cashier & Billing for settlement", data: booking.checkoutClearance });
  } catch (error: any) {
    return fail(res, 500, error.message);
  }
});

// ── Record a payment ─────────────────────────────────────────────────────────
router.post("/folios/:folioId/payments", requirePermission("PAYMENTS", "CREATE"), async (req: Request, res: Response) => {
  const { amount, method, reference, clientRequestId, notes } = req.body ?? {};
  const amt = r2(Number(amount));
  if (!(amt > 0)) return fail(res, 400, "Enter an amount greater than zero");
  const mode = String(method ?? "").toUpperCase();
  if (!METHODS.includes(mode as any)) return fail(res, 400, "Choose a payment method: CASH, CARD, UPI or RAZORPAY");
  if ((mode === "CARD" || mode === "UPI") && !(typeof reference === "string" && reference.trim())) return fail(res, 400, `A ${mode} reference (approval code / UTR) is required`);
  const key = typeof clientRequestId === "string" && clientRequestId.trim() ? clientRequestId.trim() : undefined;
  if (!key) return fail(res, 400, "Missing clientRequestId (duplicate-submission protection)");

  // Same submission again (double click / retry): return the payment already recorded.
  const already = await Payment.findOne({ clientRequestId: key }).lean();
  if (already) return res.json({ success: true, duplicate: true, message: "This payment was already recorded", data: { payment: already } });

  const found = await openFolio(String(req.params.folioId));
  if ("error" in found) return fail(res, found.error[0], found.error[1]);
  const { folio } = found;
  const session = await mongoose.startSession();
  try {
    let out: any;
    await session.withTransaction(async () => {
      const due = (await recomputeFolioBalance(String(folio._id), { session })).balance;
      if (amt > due) {
        throw Object.assign(new Error(due <= 0 ? "Nothing is due on this bill" : `Only ₹${due.toFixed(2)} is due; the payment would overpay the bill`), { status: 409 });
      }
      const booking = await Booking.findById(folio.booking).session(session);
      out = await recordFolioPayment(
        {
          folioId: String(folio._id),
          bookingId: String(folio.booking),
          amount: amt,
          method: mode,
          description: `Payment (${mode})`,
          postedBy: actorId(req),
          notes,
          propertyId: booking?.propertyId,
          clientRequestId: key,
          reference: typeof reference === "string" ? reference.trim() : undefined,
        },
        { req, session },
      );
    });
    const totals = await recomputeFolioBalance(String(folio._id));
    return res.status(201).json({ success: true, message: `₹${amt.toLocaleString("en-IN")} received (${mode})`, data: { payment: out.payment, balance: totals.balance } });
  } catch (error: any) {
    if (error?.code === 11000) {
      const p = await Payment.findOne({ clientRequestId: key }).lean();
      return res.json({ success: true, duplicate: true, message: "This payment was already recorded", data: { payment: p } });
    }
    return fail(res, error.status ?? 500, error.message);
  } finally {
    await session.endSession();
  }
});

// ── Apply advances ───────────────────────────────────────────────────────────
router.post("/folios/:folioId/apply-advances", requirePermission("ADVANCES", "ADJUST"), async (req: Request, res: Response) => {
  const found = await openFolio(String(req.params.folioId));
  if ("error" in found) return fail(res, found.error[0], found.error[1]);
  const { folio } = found;
  const session = await mongoose.startSession();
  try {
    let applied = 0;
    await session.withTransaction(async () => {
      const booking = await Booking.findById(folio.booking).session(session);
      applied = await applyAdvancesToFolio(
        {
          bookingId: String(folio.booking),
          guestId: booking?.customer ? String(booking.customer) : undefined,
          folioId: String(folio._id),
          maxAmount: req.body?.amount ? Number(req.body.amount) : Number.MAX_SAFE_INTEGER,
          performedBy: actorId(req),
          reason: "Applied at billing",
        },
        { req, session },
      );
    });
    const totals = await recomputeFolioBalance(String(folio._id));
    return res.json({ success: true, message: applied > 0 ? `₹${applied.toLocaleString("en-IN")} of advance applied to the bill` : "No advance available to apply", data: { applied, balance: totals.balance } });
  } catch (error: any) {
    return fail(res, 400, error.message);
  } finally {
    await session.endSession();
  }
});

// ── Refund a guest credit ────────────────────────────────────────────────────
router.post("/folios/:folioId/refunds", requirePermission("REFUNDS", "CREATE"), async (req: Request, res: Response) => {
  const { amount, method, reason } = req.body ?? {};
  const amt = r2(Number(amount));
  if (!(amt > 0)) return fail(res, 400, "Enter the refund amount");
  if (!(typeof reason === "string" && reason.trim().length >= 3)) return fail(res, 400, "A refund reason is required");
  const mode = String(method ?? "CASH").toUpperCase();
  const found = await openFolio(String(req.params.folioId));
  if ("error" in found) return fail(res, found.error[0], found.error[1]);
  const { folio } = found;
  const session = await mongoose.startSession();
  try {
    let line: any;
    await session.withTransaction(async () => {
      const credit = -(await recomputeFolioBalance(String(folio._id), { session })).balance;
      if (amt > credit) throw Object.assign(new Error(credit <= 0 ? "The guest has no credit to refund" : `The guest's credit is ₹${credit.toFixed(2)}`), { status: 409 });
      ({ line } = await postCharge(
        { folioId: String(folio._id), bookingId: String(folio.booking), lineType: FolioLineType.REFUND, description: `Refund to guest (${mode})`, amount: amt, date: new Date(), postedBy: actorId(req), notes: reason.trim() },
        { req, session },
      ));
    });
    const booking: any = await Booking.findById(folio.booking).populate("assignedRoom", "roomNumber").lean();
    await submitForVerification({
      type: VerificationType.REFUND,
      subjectKey: `folioLine:${line._id}:refund`,
      returnQueue: "CASHIER",
      summary: `Refund ₹${amt.toLocaleString("en-IN")} (${mode}) to ${guestName(booking)}`,
      amount: amt,
      bookingId: folio.booking,
      folioId: folio._id,
      details: { bookingReference: booking?.bookingReference, guest: guestName(booking), room: booking?.assignedRoom?.roomNumber, method: mode, reason: reason.trim(), folioLineId: String(line._id) },
      note: reason.trim(),
      req,
    });
    const totals = await recomputeFolioBalance(String(folio._id));
    return res.status(201).json({ success: true, message: `Refund of ₹${amt.toLocaleString("en-IN")} recorded and sent for verification`, data: { line, balance: totals.balance } });
  } catch (error: any) {
    return fail(res, error.status ?? 500, error.message);
  } finally {
    await session.endSession();
  }
});

// ── Payment receipt ──────────────────────────────────────────────────────────
router.get("/payments/:id/receipt", requirePermission("PAYMENTS", "VIEW"), async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return fail(res, 400, "Invalid payment");
    const payment: any = await Payment.findById(req.params.id).lean();
    if (!payment) return fail(res, 404, "Payment not found");
    const booking: any = await Booking.findById(payment.booking).populate("assignedRoom", "roomNumber").populate("roomCategory", "name").lean();
    const line: any = await FolioLine.findOne({ paymentId: payment._id }).lean();
    const folio: any = line ? await Folio.findById(line.folio).lean() : null;
    const totals = folio ? await recomputeFolioBalance(String(folio._id)) : null;
    return res.json({
      success: true,
      data: {
        payment,
        booking: booking && {
          bookingReference: booking.bookingReference,
          billNumber: booking.billNumber,
          guest: guestName(booking),
          phone: booking.guestDetails?.phone,
          email: booking.guestDetails?.email,
          room: booking.assignedRoom?.roomNumber,
          category: booking.roomCategory?.name,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
        },
        receivedBy: line?.postedBy,
        balanceAfter: totals?.balance ?? null,
      },
    });
  } catch (error: any) {
    return fail(res, 500, error.message);
  }
});

export default router;
