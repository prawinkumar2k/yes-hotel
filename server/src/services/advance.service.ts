import mongoose from "mongoose";
import { AdvancePayment, IAdvancePayment, AdvancePaymentStatus, AdvancePaymentMethod } from "../models/AdvancePayment";
import { AdvanceAdjustment, AdvanceAdjustmentType, AdvanceAdjustmentStatus } from "../models/AdvanceAdjustment";
import { postCharge } from "./folio.service";
import { FolioLineType } from "../models/FolioLine";
import { HotelSettings } from "../models/HotelSettings";
import { createAuditLog } from "./audit.service";
import type { Request } from "express";

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE NUMBER GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function generateAdvanceNumber(): Promise<string> {
  const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
  const prefix = settings?.advancePrefix ?? "ADV";
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", ""); // YYYYMM
  const count = await AdvancePayment.countDocuments();
  return `${prefix}-${dateStr}-${String(count + 1).padStart(4, "0")}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// RECEIVE ADVANCE
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiveAdvanceParams {
  bookingId?: string;
  guestId: string;
  amount: number;
  method: AdvancePaymentMethod;
  referenceNumber?: string;
  razorpayPaymentId?: string;
  purpose?: string;
  receivedBy: string;
  notes?: string;
}

export async function receiveAdvance(
  params: ReceiveAdvanceParams,
  opts: { req?: Request }
): Promise<IAdvancePayment> {
  if (params.amount <= 0) throw new Error("Advance amount must be positive");

  const advanceNumber = await generateAdvanceNumber();

  const advance = await AdvancePayment.create({
    advanceNumber,
    booking: params.bookingId,
    guest: params.guestId,
    amount: params.amount,
    totalAdjusted: 0,
    totalRefunded: 0,
    remainingBalance: params.amount,
    method: params.method,
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
  opts: { req?: Request }
): Promise<{ adjustment: InstanceType<typeof AdvanceAdjustment>; remainingBalance: number }> {
  if (params.amount <= 0) throw new Error("Adjustment amount must be positive");

  // Atomic: only decrement if there's enough remaining
  const advance = await AdvancePayment.findOneAndUpdate(
    {
      _id: params.advancePaymentId,
      remainingBalance: { $gte: params.amount },
      status: {
        $in: [
          AdvancePaymentStatus.RECEIVED,
          AdvancePaymentStatus.PARTIALLY_ADJUSTED,
        ],
      },
    },
    {
      $inc: { remainingBalance: -params.amount, totalAdjusted: params.amount },
    },
    { returnDocument: "after" }
  );

  if (!advance) {
    const existing = await AdvancePayment.findById(params.advancePaymentId).lean();
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
  const newStatus =
    advance.remainingBalance === 0
      ? AdvancePaymentStatus.FULLY_ADJUSTED
      : AdvancePaymentStatus.PARTIALLY_ADJUSTED;

  await AdvancePayment.findByIdAndUpdate(advance._id, { status: newStatus });

  // Create adjustment record
  const adjustment = await AdvanceAdjustment.create({
    advancePayment: advance._id,
    folio: params.folioId,
    booking: params.bookingId,
    type: AdvanceAdjustmentType.ADJUSTMENT,
    status: AdvanceAdjustmentStatus.COMPLETED,
    amount: params.amount,
    performedBy: params.performedBy,
    performedAt: new Date(),
    reason: params.reason,
  });

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
  await AdvanceAdjustment.findByIdAndUpdate(adjustment._id, { folioLine: line._id });

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
  opts: { req?: Request }
): Promise<{ adjustment: InstanceType<typeof AdvanceAdjustment>; remainingBalance: number }> {
  if (params.amount <= 0) throw new Error("Refund amount must be positive");

  const advance = await AdvancePayment.findOneAndUpdate(
    {
      _id: params.advancePaymentId,
      remainingBalance: { $gte: params.amount },
      status: {
        $in: [
          AdvancePaymentStatus.RECEIVED,
          AdvancePaymentStatus.PARTIALLY_ADJUSTED,
        ],
      },
    },
    {
      $inc: { remainingBalance: -params.amount, totalRefunded: params.amount },
    },
    { returnDocument: "after" }
  );

  if (!advance) {
    const existing = await AdvancePayment.findById(params.advancePaymentId);
    if (!existing) throw new Error("Advance payment not found");
    if (existing.remainingBalance < params.amount) {
      throw new Error(
        `Insufficient advance balance for refund. Available: ₹${existing.remainingBalance}`
      );
    }
    throw new Error("Advance is not in a refundable state");
  }

  const newStatus =
    advance.remainingBalance === 0
      ? AdvancePaymentStatus.REFUNDED
      : AdvancePaymentStatus.PARTIALLY_REFUNDED;

  await AdvancePayment.findByIdAndUpdate(advance._id, { status: newStatus });

  const adjustment = await AdvanceAdjustment.create({
    advancePayment: advance._id,
    type: AdvanceAdjustmentType.REFUND,
    status: AdvanceAdjustmentStatus.COMPLETED,
    amount: params.amount,
    performedBy: params.performedBy,
    performedAt: new Date(),
    reason: params.reason,
  });

  await createAuditLog({
    req: opts.req,
    action: "advance.refunded",
    resourceType: "AdvanceAdjustment",
    resourceId: adjustment._id.toString(),
    metadata: {
      advanceNumber: advance.advanceNumber,
      amount: params.amount,
      remainingBalance: advance.remainingBalance,
    },
  });

  return { adjustment, remainingBalance: advance.remainingBalance };
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
