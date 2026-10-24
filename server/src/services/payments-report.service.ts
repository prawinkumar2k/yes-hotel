/**
 * Payments and refunds report: every payment taken (booking payments and advance deposits) and every refund given in a
 * period, one list with totals and a split by payment method. Refunds can be started from the rows that still have money
 * to give back.
 */
import { Booking } from "../models/Booking";
import { Payment } from "../models/Payment";
import { Refund } from "../models/Refund";
import { AdvancePayment } from "../models/AdvancePayment";
import { AdvanceAdjustment } from "../models/AdvanceAdjustment";
import { Guest } from "../models/Guest";
import { businessDayRange } from "../../../shared/dates";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const PAID = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"];

export type PaymentsReportRow = {
  kind: "PAYMENT" | "ADVANCE" | "REFUND";
  id: string;
  at: Date;
  bookingRef?: string;
  bookingId?: string;
  guest?: string;
  method: string;
  reference?: string;
  status: string;
  amount: number;
  refunded: number;
  refundable: number;
  note?: string;
};

export async function paymentsRefundsReport(p: { from: string; to: string; method?: string; search?: string; scope: Record<string, unknown> }) {
  const range = { $gte: businessDayRange(p.from).start, $lt: businessDayRange(p.to).end };
  const scopedBookingIds = Object.keys(p.scope).length ? await Booking.find(p.scope as any).distinct("_id") : null;
  const byBooking = scopedBookingIds ? { booking: { $in: scopedBookingIds } } : {};

  const [payments, advances, refunds, advanceRefunds] = await Promise.all([
    Payment.find({ ...p.scope, createdAt: range, status: { $in: PAID } } as any).lean(),
    AdvancePayment.find({ ...p.scope, receivedAt: range } as any).lean(),
    Refund.find({ ...byBooking, createdAt: range } as any).populate("payment", "method").lean(),
    AdvanceAdjustment.find({ ...byBooking, type: "REFUND", status: "COMPLETED", performedAt: range } as any).populate("advancePayment", "method advanceNumber").lean(),
  ]);

  // Names and booking numbers in one go.
  const bookingIds = new Set<string>();
  for (const x of [...payments, ...advances, ...refunds, ...advanceRefunds] as any[]) if (x.booking) bookingIds.add(String(x.booking));
  const bookings = new Map<string, any>((await Booking.find({ _id: { $in: [...bookingIds] } }).select("bookingReference guestDetails").lean()).map((b: any) => [String(b._id), b]));
  const guestIds = advances.map((a: any) => a.guest).filter(Boolean);
  const guests = new Map<string, string>((await Guest.find({ _id: { $in: guestIds } }).select("fullName").lean()).map((g: any) => [String(g._id), g.fullName]));
  const nameOf = (bookingId?: unknown, guestId?: unknown) => {
    const b = bookingId ? bookings.get(String(bookingId)) : undefined;
    const fromBooking = b ? `${b.guestDetails?.firstName ?? ""} ${b.guestDetails?.lastName ?? ""}`.trim() : "";
    return fromBooking || (guestId ? guests.get(String(guestId)) : "") || "";
  };

  const rows: PaymentsReportRow[] = [];
  for (const x of payments as any[]) {
    const refunded = Number(x.refundedAmount) || 0;
    rows.push({
      kind: "PAYMENT", id: String(x._id), at: x.createdAt, bookingRef: bookings.get(String(x.booking))?.bookingReference, bookingId: String(x.booking),
      guest: nameOf(x.booking), method: x.method, reference: x.razorpayPaymentId || x.transactionId || x.reference, status: x.status,
      amount: r2(x.amount), refunded: r2(refunded), refundable: ["COMPLETED", "PARTIALLY_REFUNDED"].includes(x.status) ? r2(Math.max(0, x.amount - refunded)) : 0,
    });
  }
  for (const x of advances as any[]) {
    rows.push({
      kind: "ADVANCE", id: String(x._id), at: x.receivedAt, bookingRef: x.booking ? bookings.get(String(x.booking))?.bookingReference : undefined, bookingId: x.booking ? String(x.booking) : undefined,
      guest: nameOf(x.booking, x.guest), method: x.method, reference: x.advanceNumber, status: x.status, amount: r2(x.amount), refunded: r2(Number(x.totalRefunded) || 0),
      refundable: 0, note: x.purpose,
    });
  }
  for (const x of refunds as any[]) {
    rows.push({
      kind: "REFUND", id: String(x._id), at: x.createdAt, bookingRef: bookings.get(String(x.booking))?.bookingReference, bookingId: String(x.booking), guest: nameOf(x.booking),
      method: x.payment?.method ?? "", reference: x.razorpayRefundId, status: x.status, amount: r2(x.amount), refunded: 0, refundable: 0, note: x.reason,
    });
  }
  for (const x of advanceRefunds as any[]) {
    rows.push({
      kind: "REFUND", id: String(x._id), at: x.performedAt, bookingRef: x.booking ? bookings.get(String(x.booking))?.bookingReference : undefined, bookingId: x.booking ? String(x.booking) : undefined,
      guest: nameOf(x.booking), method: x.advancePayment?.method ?? "", reference: x.advancePayment?.advanceNumber, status: "COMPLETED", amount: r2(x.amount), refunded: 0, refundable: 0, note: "Advance refund",
    });
  }

  const method = String(p.method ?? "").toUpperCase();
  const q = String(p.search ?? "").trim().toLowerCase();
  const filtered = rows
    .filter((r) => !method || String(r.method).toUpperCase() === method)
    .filter((r) => !q || [r.bookingRef, r.guest, r.reference, r.note].some((v) => String(v ?? "").toLowerCase().includes(q)))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // A refund counts when it went through or is on its way; failed / cancelled ones do not.
  const refundCounts = (r: PaymentsReportRow) => r.kind === "REFUND" && ["COMPLETED", "PROCESSING"].includes(r.status);
  const collected = r2(filtered.filter((r) => r.kind !== "REFUND").reduce((t, r) => t + r.amount, 0));
  const refunded = r2(filtered.filter(refundCounts).reduce((t, r) => t + r.amount, 0));
  const methods = new Map<string, { method: string; collected: number; refunded: number }>();
  for (const r of filtered) {
    const key = r.method || "OTHER";
    const m = methods.get(key) ?? { method: key, collected: 0, refunded: 0 };
    if (r.kind !== "REFUND") m.collected += r.amount; else if (refundCounts(r)) m.refunded += r.amount;
    methods.set(key, m);
  }
  return {
    period: { from: p.from, to: p.to },
    totals: {
      collected, refunded, net: r2(collected - refunded),
      payments: filtered.filter((r) => r.kind === "PAYMENT").length,
      advances: filtered.filter((r) => r.kind === "ADVANCE").length,
      refunds: filtered.filter((r) => r.kind === "REFUND").length,
      refundable: r2(filtered.reduce((t, r) => t + r.refundable, 0)),
    },
    byMethod: [...methods.values()].map((m) => ({ ...m, collected: r2(m.collected), refunded: r2(m.refunded), net: r2(m.collected - m.refunded) })).sort((a, b) => b.collected - a.collected),
    rows: filtered,
  };
}
