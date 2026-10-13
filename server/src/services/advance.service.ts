import mongoose from "mongoose";
import { AdvancePayment, IAdvancePayment, AdvancePaymentStatus, AdvancePaymentMethod } from "../models/AdvancePayment";
import { AdvanceAdjustment, AdvanceAdjustmentType, AdvanceAdjustmentStatus } from "../models/AdvanceAdjustment";
import { postCharge } from "./folio.service";
import { FolioLineType } from "../models/FolioLine";
import { HotelSettings } from "../models/HotelSettings";
import { createAuditLog } from "./audit.service";
import type { Request } from "express";
import { todayBusinessDate } from "../../../shared/dates";
import { nextSequence, ensureSequenceAtLeast } from "./counter.service";

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE NUMBER GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function generateAdvanceNumber(session?: mongoose.ClientSession): Promise<string> {
  const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
  const prefix = settings?.advancePrefix ?? "ADV";
  const ym = todayBusinessDate().slice(0, 7).replace("-", ""); // YYYYMM at the property
  // Atomic counter (was countDocuments()+1, which collided under concurrency), continuing
  // from the highest number already issued this month.
  const series = `${prefix}-${ym}-`;
  const last = await AdvancePayment.findOne({ advanceNumber: { $regex: `^${series}\\d+$` } }).sort({ advanceNumber: -1 }).select("advanceNumber").lean();
  if (last) await ensureSequenceAtLeast(`advance:${ym}`, Number(last.advanceNumber.slice(series.length)), session);
  const seq = await nextSequence(`advance:${ym}`, session);
  return `${prefix}-${ym}-${String(seq).padStart(4, "0")}`;
}

/** Statuses from which money can still be drawn (applied or refunded). */
const DRAWABLE = [AdvancePaymentStatus.RECEIVED, AdvancePaymentStatus.PARTIALLY_ADJUSTED, AdvancePaymentStatus.PARTIALLY_REFUNDED];

/** One rule for an advance's status, from its amounts. */
export function advanceStatusFor(a: { remainingBalance: number; totalAdjusted: number; totalRefunded: number }): AdvancePaymentStatus {
  if (a.remainingBalance <= 0) return a.totalAdjusted > 0 ? AdvancePaymentStatus.FULLY_ADJUSTED : AdvancePaymentStatus.REFUNDED;
  if (a.totalRefunded > 0) return AdvancePaymentStatus.PARTIALLY_REFUNDED;
  if (a.totalAdjusted > 0) return AdvancePaymentStatus.PARTIALLY_ADJUSTED;
  return AdvancePaymentStatus.RECEIVED;
}


// ─────────────────────────────────────────────────────────────────────────────
// RECEIVE ADVANCE
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiveAdvanceParams {
  propertyId?: string;
  bookingId?: string;
  guestId: string;
  amount: number;
  method: AdvancePaymentMethod;
  paymentChannelId?: string;
  referenceNumber?: string;
  razorpayPaymentId?: string;
  purpose?: string;
  receivedBy: string;
  notes?: string;
}

export async function receiveAdvance(
  params: ReceiveAdvanceParams,
  opts: { req?: Request } = {}
): Promise<IAdvancePayment> {
  if (params.amount <= 0) throw new Error("Advance amount must be positive");

  let resolvedPropertyId = params.propertyId || (opts.req as any)?.propertyId || (opts.req as any)?.user?.propertyId;
  if (!resolvedPropertyId && params.bookingId) {
    const { Booking } = await import("../models/Booking");
    const bk = await Booking.findById(params.bookingId).lean();
    if (bk) resolvedPropertyId = bk.propertyId || (bk as any).property;
  }
  if (!resolvedPropertyId) {
    const { Property } = await import("../models/Property");
    const prop = await Property.findOne().lean();
    resolvedPropertyId = prop?._id;
  }

  const advanceNumber = await generateAdvanceNumber();
  if (params.bookingId) {
    const { Booking } = await import("../models/Booking");
    const bk = await Booking.findById(params.bookingId).select("status").lean();
    if (!bk) throw new Error("Booking not found");
    if (["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(String(bk.status))) {
      throw new Error(`Cannot take an advance against a ${bk.status} booking`);
    }
  }

  const advance = await AdvancePayment.create({
    propertyId: resolvedPropertyId,
    advanceNumber,
    booking: params.bookingId,
    guest: params.guestId,
    amount: params.amount,
    totalAdjusted: 0,
    totalRefunded: 0,
    remainingBalance: params.amount,
    method: params.method,
    paymentChannel: params.paymentChannelId,
    referenceNumber: params.referenceNumber,
    razorpayPaymentId: params.razorpayPaymentId,
    status: AdvancePaymentStatus.RECEIVED,
    receivedAt: new Date(),
    receivedBy: params.receivedBy,
    purpose: params.purpose,
    notes: params.notes,
  });

  await createAuditLog({
    req: opts.req,
    action: "advance.received",
    resourceType: "AdvancePayment",
    resourceId: advance._id.toString(),
    metadata: {
      advanceNumber,
      bookingId: params.bookingId,
      guestId: params.guestId,
      amount: params.amount,
      method: params.method,
    },
  });

  return advance;
}


// ─────────────────────────────────────────────────────────────────────────────
// ADJUST ADVANCE (apply to folio)
// ─────────────────────────────────────────────────────────────────────────────

export interface AdjustAdvanceParams {
  advancePaymentId: string;
  folioId: string;
  bookingId: string;
  amount: number;
  performedBy: string;
  reason?: string;
}

/**
 * Atomically:
 * 1. Validates the advance has sufficient remainingBalance.
 * 2. Decrements remainingBalance on the AdvancePayment (atomic compare-and-decrement).
 * 3. Creates an AdvanceAdjustment record.
 * 4. Posts an ADVANCE_ADJUSTMENT credit line to the folio.
 * 5. Updates AdvancePayment.status.
 *
 * CONCURRENCY SAFETY: the $inc with a $gte guard on remainingBalance prevents
 * two concurrent adjustments from over-drawing the advance, identical to the
 * refund guard on Payment.refundedAmount.
 */
export async function adjustAdvance(
  params: AdjustAdvanceParams,
  opts: { req?: Request; session?: mongoose.ClientSession }
): Promise<{ adjustment: InstanceType<typeof AdvanceAdjustment>; remainingBalance: number }> {
  if (params.amount <= 0) throw new Error("Adjustment amount must be positive");

  // Atomic: only decrement if there's enough remaining
  const advance = await AdvancePayment.findOneAndUpdate(
    {
      _id: params.advancePaymentId,
      remainingBalance: { $gte: params.amount },
      status: { $in: DRAWABLE },
    },
    {
      $inc: { remainingBalance: -params.amount, totalAdjusted: params.amount },
    },
    { returnDocument: "after", session: opts.session }
  );

  if (!advance) {
    const existingQuery = AdvancePayment.findById(params.advancePaymentId);
    const existing = await (opts.session ? existingQuery.session(opts.session) : existingQuery).lean();
    if (!existing) throw new Error("Advance payment not found");
    if (existing.remainingBalance < params.amount) {
      throw new Error(
        `Insufficient advance balance. Available: ₹${existing.remainingBalance}, requested: ₹${params.amount}`
      );
    }
    throw new Error("Advance is not in a state that allows adjustment");
  }
  // TypeScript narrowing: advance is non-null beyond this point

  // Determine new status
  await AdvancePayment.findByIdAndUpdate(advance._id, { status: advanceStatusFor(advance) }, { session: opts.session });

  // Create adjustment record
  const [adjustment] = await AdvanceAdjustment.create(
    [
      {
        advancePayment: advance._id,
        folio: params.folioId,
        booking: params.bookingId,
        type: AdvanceAdjustmentType.ADJUSTMENT,
        status: AdvanceAdjustmentStatus.COMPLETED,
        amount: params.amount,
        performedBy: params.performedBy,
        performedAt: new Date(),
        reason: params.reason,
      },
    ],
    { session: opts.session }
  );

  // Post credit to folio
  const { line } = await postCharge(
    {
      folioId: params.folioId,
      bookingId: params.bookingId,
      lineType: FolioLineType.ADVANCE_ADJUSTMENT,
      description: `Advance adjustment — ${advance.advanceNumber}`,
      amount: params.amount,
      date: new Date(),
      postedBy: params.performedBy,
      advancePaymentId: advance._id.toString(),
      notes: params.reason,
    },
    opts
  );

  // Link folioLine back to adjustment
  await AdvanceAdjustment.findByIdAndUpdate(adjustment._id, { folioLine: line._id }, { session: opts.session });

  await createAuditLog({
    req: opts.req,
    action: "advance.adjusted",
    resourceType: "AdvanceAdjustment",
    resourceId: adjustment._id.toString(),
    metadata: {
      advanceNumber: advance.advanceNumber,
      amount: params.amount,
      folioId: params.folioId,
      remainingBalance: advance.remainingBalance,
    },
  });

  return { adjustment, remainingBalance: advance.remainingBalance };
}


// ─────────────────────────────────────────────────────────────────────────────
// REFUND ADVANCE (cash back to guest)
// ─────────────────────────────────────────────────────────────────────────────

export interface RefundAdvanceParams {
  advancePaymentId: string;
  amount: number;
  performedBy: string;
  reason: string;
}

export async function refundAdvance(
  params: RefundAdvanceParams,
  opts: { req?: Request; session?: mongoose.ClientSession } = {}
): Promise<{ adjustment: InstanceType<typeof AdvanceAdjustment>; remainingBalance: number }> {
  if (params.amount <= 0) throw new Error("Refund amount must be positive");
  if (!params.reason || params.reason.trim().length < 3) throw new Error("A refund reason is required");
  // Balance decrement, status and the adjustment record commit together.
  if (!opts.session) {
    const session = await mongoose.startSession();
    try {
      let out: any;
      await session.withTransaction(async () => { out = await refundAdvance(params, { ...opts, session }); });
      return out;
    } finally {
      await session.endSession();
    }
  }
  const session = opts.session;

  const advance = await AdvancePayment.findOneAndUpdate(
    { _id: params.advancePaymentId, remainingBalance: { $gte: params.amount }, status: { $in: DRAWABLE } },
    { $inc: { remainingBalance: -params.amount, totalRefunded: params.amount } },
    { returnDocument: "after", session }
  );
  if (!advance) {
    const existing = await AdvancePayment.findById(params.advancePaymentId).session(session);
    if (!existing) throw new Error("Advance payment not found");
    if (existing.remainingBalance < params.amount) {
      throw new Error(`Insufficient advance balance for refund. Available: ₹${existing.remainingBalance}`);
    }
    throw new Error("Advance is not in a refundable state");
  }
  await AdvancePayment.findByIdAndUpdate(advance._id, { status: advanceStatusFor(advance) }, { session });

  const [adjustment] = await AdvanceAdjustment.create(
    [{
      advancePayment: advance._id,
      type: AdvanceAdjustmentType.REFUND,
      status: AdvanceAdjustmentStatus.COMPLETED,
      amount: params.amount,
      performedBy: params.performedBy,
      performedAt: new Date(),
      reason: params.reason,
    }],
    { session }
  );

  await createAuditLog({
    req: opts.req,
    action: "advance.refunded",
    resourceType: "AdvanceAdjustment",
    resourceId: adjustment._id.toString(),
    metadata: { advanceNumber: advance.advanceNumber, amount: params.amount, remainingBalance: advance.remainingBalance, reason: params.reason },
  });

  return { adjustment, remainingBalance: advance.remainingBalance };
}

/**
 * Applies a booking's available advances to its folio, oldest first, up to `maxAmount`
 * (never more than the folio's outstanding balance). Returns the amount applied.
 */
export async function applyAdvancesToFolio(
  params: { bookingId: string; guestId?: string; folioId: string; maxAmount: number; performedBy: string; reason?: string },
  opts: { req?: Request; session?: mongoose.ClientSession }
): Promise<number> {
  const { recomputeFolioBalance } = await import("./folio.service");
  const due = (await recomputeFolioBalance(params.folioId, { session: opts.session })).balance;
  let left = Math.round(Math.min(params.maxAmount, Math.max(0, due)) * 100) / 100;
  if (left <= 0) return 0;
  const q = AdvancePayment.find({
    $or: [{ booking: params.bookingId }, ...(params.guestId ? [{ guest: params.guestId, booking: { $in: [null, undefined] } }] : [])],
    remainingBalance: { $gt: 0 },
    status: { $in: DRAWABLE },
  }).sort({ receivedAt: 1 });
  const advances = await (opts.session ? q.session(opts.session) : q);
  let applied = 0;
  for (const adv of advances) {
    if (left <= 0) break;
    const take = Math.round(Math.min(left, adv.remainingBalance) * 100) / 100;
    await adjustAdvance(
      { advancePaymentId: adv._id.toString(), folioId: params.folioId, bookingId: params.bookingId, amount: take, performedBy: params.performedBy, reason: params.reason },
      opts
    );
    applied += take;
    left = Math.round((left - take) * 100) / 100;
  }
  return Math.round(applied * 100) / 100;
}

/**
 * Restores an advance when the folio line that applied it is reversed.
 * Called by reverseFolioLine inside the same transaction.
 */
export async function restoreAdvanceForReversedLine(
  line: { _id: unknown; advancePaymentId?: unknown; amount: number },
  opts: { session?: mongoose.ClientSession; performedBy: string; reason: string }
) {
  if (!line.advancePaymentId) return;
  const adv = await AdvancePayment.findOneAndUpdate(
    { _id: line.advancePaymentId, totalAdjusted: { $gte: line.amount } },
    { $inc: { remainingBalance: line.amount, totalAdjusted: -line.amount } },
    { returnDocument: "after", session: opts.session }
  );
  if (!adv) return;
  await AdvancePayment.findByIdAndUpdate(adv._id, { status: advanceStatusFor(adv) }, { session: opts.session });
  await AdvanceAdjustment.updateOne({ folioLine: line._id }, { status: AdvanceAdjustmentStatus.REVERSED }, { session: opts.session });
  await AdvanceAdjustment.create(
    [{ advancePayment: adv._id, type: AdvanceAdjustmentType.REVERSAL, status: AdvanceAdjustmentStatus.COMPLETED, amount: line.amount, performedBy: opts.performedBy, performedAt: new Date(), reason: opts.reason }],
    { session: opts.session }
  );
}

/**
 * Reconciliation: for each advance, amount = applied + refunded + remaining, and the
 * applied amount equals its (unreversed) folio ADVANCE_ADJUSTMENT lines. Read-only.
 */
export async function reconcileAdvances(filter: Record<string, unknown> = {}) {
  const { FolioLine } = await import("../models/FolioLine");
  const advances = await AdvancePayment.find(filter).lean();
  const lines = await FolioLine.find({ advancePaymentId: { $in: advances.map((a) => a._id) } }).lean();
  const reversed = new Set(
    (await FolioLine.find({ reversedLineId: { $in: lines.map((l) => l._id) } }).select("reversedLineId").lean()).map((l: any) => String(l.reversedLineId))
  );
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rows = advances.map((a) => {
    const onFolio = r2(lines.filter((l: any) => String(l.advancePaymentId) === String(a._id) && !reversed.has(String(l._id))).reduce((t, l: any) => t + l.amount, 0));
    const identity = r2(a.amount - a.totalAdjusted - a.totalRefunded - a.remainingBalance);
    const issues: string[] = [];
    if (identity !== 0) issues.push(`amount ≠ applied + refunded + remaining (off by ₹${identity})`);
    if (onFolio !== r2(a.totalAdjusted)) issues.push(`applied ₹${a.totalAdjusted} but folio lines show ₹${onFolio}`);
    if (a.status !== advanceStatusFor(a) && !["VOIDED", "TRANSFERRED", "EXPIRED"].includes(a.status)) issues.push(`status ${a.status}, expected ${advanceStatusFor(a)}`);
    return { advanceId: String(a._id), advanceNumber: a.advanceNumber, booking: a.booking ? String(a.booking) : null, amount: a.amount, applied: a.totalAdjusted, refunded: a.totalRefunded, remaining: a.remainingBalance, onFolio, status: a.status, issues };
  });
  const totals = rows.reduce((t, r) => ({ received: t.received + r.amount, applied: t.applied + r.applied, refunded: t.refunded + r.refunded, remaining: t.remaining + r.remaining }), { received: 0, applied: 0, refunded: 0, remaining: 0 });
  return { totals, count: rows.length, mismatches: rows.filter((r) => r.issues.length), rows };
}


// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdvanceSummary(bookingId: string): Promise<{
  advances: IAdvancePayment[];
  totalReceived: number;
  totalAdjusted: number;
  totalRefunded: number;
  totalRemaining: number;
}> {
  const advances = await AdvancePayment.find({ booking: bookingId }).lean();
  const totalReceived = advances.reduce((s, a) => s + a.amount, 0);
  const totalAdjusted = advances.reduce((s, a) => s + a.totalAdjusted, 0);
  const totalRefunded = advances.reduce((s, a) => s + a.totalRefunded, 0);
  const totalRemaining = advances.reduce((s, a) => s + a.remainingBalance, 0);
  return { advances, totalReceived, totalAdjusted, totalRefunded, totalRemaining };
}
