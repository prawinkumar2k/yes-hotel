/**
 * Cashier shift ledger: the one place a shift's expected drawer cash is computed.
 *
 *   expectedCash = openingFloat + cash collected (folio payments + restaurant bills) + cash advances
 *                  − cash refunds − paid-outs
 *
 * Transactions count toward a shift when the shift's cashier posted them between
 * openedAt and the shift's cut-off. The cut-off is closedAt, or handoverInitiatedAt once a
 * handover has started (the drawer is frozen at the count), or now for an open shift.
 */
import mongoose from "mongoose";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment } from "../models/AdvancePayment";
import { AdvanceAdjustment, AdvanceAdjustmentType } from "../models/AdvanceAdjustment";
import { Refund, RefundStatus } from "../models/Refund";
import { CashierShift, CashierShiftStatus, IDenominationBreakdown } from "../models/CashierShift";
import { HotelSettings } from "../models/HotelSettings";
import { nextSequence, ensureSequenceAtLeast } from "./counter.service";
import { todayBusinessDate } from "../../../shared/dates";

export type Mode = "CASH" | "UPI" | "CARD" | "GATEWAY" | "OTHER";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeDenominationTotal(d?: Partial<IDenominationBreakdown>): number {
  if (!d) return 0;
  return (
    (Number(d.n2000) || 0) * 2000 +
    (Number(d.n500) || 0) * 500 +
    (Number(d.n200) || 0) * 200 +
    (Number(d.n100) || 0) * 100 +
    (Number(d.n50) || 0) * 50 +
    (Number(d.n20) || 0) * 20 +
    (Number(d.n10) || 0) * 10 +
    (Number(d.coins) || 0)
  );
}

/**
 * Resolves the counted cash. When a denomination breakdown is given it must add up to the
 * stated amount (a mismatch is an error, not silently overridden).
 */
export function resolveCount(stated: number | undefined, denominations?: Partial<IDenominationBreakdown>): { total: number; denominations?: IDenominationBreakdown } {
  if (!denominations) {
    if (stated == null || Number.isNaN(stated)) throw new ShiftRuleError("Enter the counted cash or a denomination breakdown");
    return { total: r2(stated) };
  }
  const sum = computeDenominationTotal(denominations);
  if (stated != null && r2(stated) !== r2(sum)) {
    throw new ShiftRuleError(`Denominations add up to ₹${sum.toFixed(2)}, but ₹${Number(stated).toFixed(2)} was entered. Recount.`);
  }
  return { total: r2(sum), denominations: { ...(denominations as any), total: r2(sum) } };
}

export class ShiftRuleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ShiftRuleError";
  }
}

/** The payment mode of a money movement: Payment.method first, then channel type, then (legacy only) the description. */
export function modeOf(method?: string, channelType?: string, description?: string): Mode {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return "CASH";
  if (m === "UPI") return "UPI";
  if (m === "CARD") return "CARD";
  if (m === "RAZORPAY" || m === "GATEWAY" || m === "ONLINE") return "GATEWAY";
  const c = (channelType || "").toUpperCase();
  if (c === "CASH" || c === "UPI" || c === "CARD" || c === "GATEWAY") return c as Mode;
  const d = (description || "").toUpperCase();
  if (d.includes("UPI")) return "UPI";
  if (d.includes("CARD")) return "CARD";
  if (d.includes("RAZORPAY") || d.includes("ONLINE")) return "GATEWAY";
  if (d.includes("CASH")) return "CASH";
  return "OTHER";
}

export function shiftCutoff(shift: { closedAt?: Date | null; handoverInitiatedAt?: Date | null }): Date {
  return shift.closedAt ?? shift.handoverInitiatedAt ?? new Date();
}

export async function computeShiftLedger(shift: any) {
  const cashierId = shift.cashier?._id || shift.cashier;
  const from = shift.openedAt;
  const to = shiftCutoff(shift);
  const totals = { CASH: 0, UPI: 0, CARD: 0, GATEWAY: 0, OTHER: 0 } as Record<Mode, number>;
  let cashCollected = 0;
  let cashAdvances = 0;
  let cashRefunds = 0;
  const items: any[] = [];

  // 1. Folio payments and refunds posted by this cashier
  const folioLines = await FolioLine.find({
    postedBy: String(cashierId),
    lineType: { $in: [FolioLineType.PAYMENT, FolioLineType.REFUND] },
    postedAt: { $gte: from, $lte: to },
  })
    .populate("paymentId")
    .populate("paymentChannelId")
    .lean();
  for (const l of folioLines as any[]) {
    const mode = modeOf(l.paymentId?.method, l.paymentChannelId?.type, l.description);
    const amount = Number(l.amount) || 0;
    if (l.lineType === FolioLineType.PAYMENT) {
      totals[mode] += amount;
      if (mode === "CASH") cashCollected += amount;
      items.push({ id: l._id, type: "FOLIO_PAYMENT", description: l.description, amount, mode, date: l.postedAt, reference: l.paymentId?.transactionId || l.paymentId?.razorpayPaymentId || "" });
    } else {
      // A refund at the desk is cash unless it names another mode.
      const refundMode = mode === "OTHER" ? "CASH" : mode;
      if (refundMode === "CASH") cashRefunds += amount;
      else totals[refundMode] -= amount;
      items.push({ id: l._id, type: "FOLIO_REFUND", description: l.description, amount: -amount, mode: refundMode, date: l.postedAt, reference: "" });
    }
  }

  // 2. Advances received by this cashier
  const advances = await AdvancePayment.find({ receivedBy: cashierId, receivedAt: { $gte: from, $lte: to } }).populate("paymentChannel").lean();
  for (const a of advances as any[]) {
    const mode = modeOf(a.method, a.paymentChannel?.type);
    const amount = Number(a.amount) || 0;
    totals[mode] += amount;
    if (mode === "CASH") cashAdvances += amount;
    items.push({ id: a._id, type: "ADVANCE_PAYMENT", description: `Advance Deposit (${a.advanceNumber || "Receipt"})`, amount, mode, date: a.receivedAt, reference: a.referenceNumber || a.razorpayPaymentId || a.advanceNumber });
  }

  // 3. Advance refunds paid out by this cashier (returned in the advance's own mode)
  const advRefunds = await AdvanceAdjustment.find({ performedBy: cashierId, type: AdvanceAdjustmentType.REFUND, performedAt: { $gte: from, $lte: to } })
    .populate("advancePayment")
    .lean();
  for (const r of advRefunds as any[]) {
    const mode = modeOf(r.advancePayment?.method);
    const amount = Number(r.amount) || 0;
    if (mode === "CASH") cashRefunds += amount;
    else totals[mode] -= amount;
    items.push({ id: r._id, type: "ADVANCE_REFUND", description: `Advance refund (${r.advancePayment?.advanceNumber || ""}): ${r.reason || ""}`, amount: -amount, mode, date: r.performedAt, reference: "" });
  }

  // 4. Payment refunds initiated by this cashier, in the original payment's mode
  const refunds = await Refund.find({ initiatedBy: cashierId, status: RefundStatus.COMPLETED, createdAt: { $gte: from, $lte: to } }).populate("payment").lean();
  for (const r of refunds as any[]) {
    const mode = modeOf(r.payment?.method);
    const amount = Number(r.amount) || 0;
    if (mode === "CASH") cashRefunds += amount;
    else totals[mode] -= amount;
    items.push({ id: r._id, type: "PAYMENT_REFUND", description: `Refund: ${r.reason}`, amount: -amount, mode, date: r.createdAt, reference: r.razorpayRefundId || "" });
  }

  // 5. Restaurant bills settled by this cashier (ROOM settlements go to the folio, not the drawer)
  const { RestaurantOrder } = await import("../models/RestaurantOrder");
  const posBills = await RestaurantOrder.find({ "settlement.settledBy": cashierId, "settlement.settledAt": { $gte: from, $lte: to }, "settlement.mode": { $ne: "ROOM" } }).lean();
  for (const o of posBills as any[]) {
    const mode = modeOf(o.settlement.mode);
    const amount = Number(o.settlement.amount) || 0;
    totals[mode] += amount;
    if (mode === "CASH") cashCollected += amount;
    items.push({ id: o._id, type: "POS_BILL", description: `Restaurant ${o.kotNumber}`, amount, mode, date: o.settlement.settledAt, reference: o.settlement.reference || o.kotNumber });
  }

  // 6. Room service / counter sales (water bottle, dental kit, early check-in …): money in
  let counterSales = 0;
  for (const c of (shift.counterSales || []) as any[]) {
    const mode = modeOf(c.mode);
    const amount = Number(c.amount) || 0;
    counterSales += amount;
    totals[mode] += amount;
    if (mode === "CASH") cashCollected += amount;
    items.push({ id: c._id, type: "COUNTER_SALE", description: `${c.description}${c.quantity > 1 ? ` ×${c.quantity}` : ""}${c.roomNumber ? ` (Room ${c.roomNumber})` : ""}`, amount, mode, date: c.createdAt, reference: c.reference || "" });
  }

  // 7. Paid-outs (cash drops, petty cash)
  const totalPaidOut = (shift.paidOuts || []).reduce((t: number, p: any) => t + (Number(p.amount) || 0), 0);

  const openingFloat = Number(shift.openingFloat) || 0;
  return {
    cashCollected: r2(cashCollected),
    cashAdvances: r2(cashAdvances),
    cashRefunds: r2(cashRefunds),
    totalPaidOut: r2(totalPaidOut),
    totalCounterSales: r2(counterSales),
    expectedCash: r2(openingFloat + cashCollected + cashAdvances - cashRefunds - totalPaidOut),
    expectedUpi: r2(totals.UPI),
    expectedCard: r2(totals.CARD),
    expectedGateway: r2(totals.GATEWAY),
    expectedOther: r2(totals.OTHER),
    cutoff: to,
    itemizedTransactions: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

export async function varianceThreshold(): Promise<number> {
  const s = await HotelSettings.findOne().sort({ updatedAt: -1 }).select("cashVarianceThreshold").lean();
  return Number((s as any)?.cashVarianceThreshold ?? 100);
}

/**
 * Variance rule: zero → RECONCILED. Any variance needs a reason. A variance within the
 * threshold is RECONCILED with its reason; above it the shift stays CLOSED until a manager
 * accepts it.
 */
export function varianceOutcome(variance: number, reason: string | undefined, threshold: number) {
  const v = r2(variance);
  if (v === 0) return { status: CashierShiftStatus.RECONCILED, acceptanceRequired: false };
  if (!reason || reason.trim().length < 3) {
    throw new ShiftRuleError(`Cash variance of ₹${v.toFixed(2)}: a reason is required.`);
  }
  if (Math.abs(v) > threshold) return { status: CashierShiftStatus.CLOSED, acceptanceRequired: true };
  return { status: CashierShiftStatus.RECONCILED, acceptanceRequired: false };
}

export async function generateShiftNumber(session?: mongoose.ClientSession): Promise<string> {
  const ym = todayBusinessDate().slice(0, 7).replace("-", "");
  const series = `SHF-${ym}-`;
  const last = await CashierShift.findOne({ shiftNumber: { $regex: `^${series}\\d+$` } }).sort({ shiftNumber: -1 }).select("shiftNumber").lean();
  if (last) await ensureSequenceAtLeast(`shift:${ym}`, Number(last.shiftNumber.slice(series.length)), session);
  const seq = await nextSequence(`shift:${ym}`, session);
  return `${series}${String(seq).padStart(4, "0")}`;
}

/** Mongo duplicate-key on the one-active-shift indexes → a readable rule error. */
export function activeShiftConflict(err: any): ShiftRuleError | null {
  if (err?.code !== 11000) return null;
  const idx = String(err?.message || "");
  if (idx.includes("one_active_shift_per_drawer")) return new ShiftRuleError("This drawer already has an active shift. Close or hand it over first.", 409);
  if (idx.includes("one_active_shift_per_cashier")) return new ShiftRuleError("This cashier already has an active shift.", 409);
  return null;
}
