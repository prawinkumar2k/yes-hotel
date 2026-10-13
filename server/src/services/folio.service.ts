import mongoose from "mongoose";
import { Folio, IFolio, FolioStatus } from "../models/Folio";
import { Booking } from "../models/Booking";
import { FolioLine, FolioLineType, FolioLineDirection, LINE_TYPE_DIRECTION } from "../models/FolioLine";
import { HotelSettings } from "../models/HotelSettings";
import { createAuditLog } from "./audit.service";
import { computeRoomTax, loadGstRules } from "./tax.service";
import { computeFolioTotals, financialYear, formatInvoiceNumber } from "./folio-ledger";
import { nextSequence } from "./counter.service";

/** Thrown when settling/finalizing a folio whose balance is not exactly zero. */
export class FolioNotBalancedError extends Error {
  constructor(public readonly balance: number) {
    super(`Folio balance must be exactly ₹0 to settle or finalize (current balance ₹${balance.toFixed(2)}). Collect the outstanding amount, or post a refund / deposit for the excess.`);
    this.name = "FolioNotBalancedError";
  }
}
import type { Request } from "express";
import { nights as countNights } from "../../../shared/dates";



// ─────────────────────────────────────────────────────────────────────────────
// FOLIO CREATION
// ─────────────────────────────────────────────────────────────────────────────

async function ensurePropertyId(folio: IFolio, bookingId: string, req?: Request, session?: mongoose.ClientSession) {
  if (folio.propertyId) return;
  if (req && (req as any).propertyId) {
    folio.propertyId = (req as any).propertyId;
    return;
  }
  const bookingQuery = Booking.findById(bookingId).select("propertyId property");
  if (session) bookingQuery.session(session);
  const booking = await bookingQuery.lean();
  if (booking && (booking.propertyId || (booking as any).property)) {
    folio.propertyId = (booking.propertyId || (booking as any).property) as any;
    return;
  }
  try {
    const prop = await mongoose.model("Property").findOne().select("_id").lean();
    folio.propertyId = (prop?._id || new mongoose.Types.ObjectId()) as any;
  } catch {
    folio.propertyId = new mongoose.Types.ObjectId() as any;
  }
}

export interface CreateFolioParams {
  bookingId: string;
  guestId: string;
  roomId?: string;
  checkInDate: Date;
  checkOutDate: Date;
}

/**
 * Creates a new OPEN folio for a booking. Called during check-in.
 * A booking should have exactly one folio — callers must check for duplicates.
 */
export async function createFolio(
  params: CreateFolioParams,
  opts: { req?: Request; session?: mongoose.ClientSession }
): Promise<IFolio> {
  const folio = new Folio({
    booking: params.bookingId,
    guest: params.guestId,
    room: params.roomId,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    status: FolioStatus.OPEN,
  });

  await ensurePropertyId(folio, params.bookingId, opts.req, opts.session);

  if (opts.session) {
    await folio.save({ session: opts.session });
  } else {
    await folio.save();
  }

  await createAuditLog({
    req: opts.req,
    action: "folio.created",
    resourceType: "Folio",
    resourceId: folio._id.toString(),
    metadata: { bookingId: params.bookingId, roomId: params.roomId },
  });

  return folio;
}


// ─────────────────────────────────────────────────────────────────────────────
// POSTING CHARGES
// ─────────────────────────────────────────────────────────────────────────────

export interface PostChargeParams {
  folioId: string;
  bookingId: string;
  lineType: FolioLineType;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  date: Date;
  postedBy: string;
  businessDate?: Date;
  /** Room charges: the business dates this line charges for (prevents charging a night twice). */
  coversNights?: string[];
  /** Night audit only: it posts to the date it has just closed. */
  allowClosedDate?: boolean;
  notes?: string;
  /** For PAYMENT lines: the Payment document ID */
  paymentId?: string;
  /** For ADVANCE_ADJUSTMENT lines: the AdvancePayment document ID */
  advancePaymentId?: string;
  /** For REVERSAL lines: the FolioLine being reversed */
  reversedLineId?: string;
  /** For PAYMENT lines: the configured PaymentChannel used */
  paymentChannelId?: string;
}

/**
 * Posts a single charge or credit to a folio and updates the running totals.
 * This is the ONLY way to add a financial entry to a folio.
 *
 * INVARIANT: the folio must be OPEN to accept new charges.
 * Exception: REVERSAL lines can be posted to FINALIZED folios (correction workflow).
 */
export async function postCharge(
  params: PostChargeParams,
  opts: { req?: Request; session?: mongoose.ClientSession }
): Promise<{ line: InstanceType<typeof FolioLine>; folio: IFolio }> {
  const folio = opts.session
    ? await Folio.findById(params.folioId).session(opts.session)
    : await Folio.findById(params.folioId);
  if (!folio) throw new Error(`Folio ${params.folioId} not found`);

  // Settled/closed/voided folios are immutable; a finalized folio accepts only reversals.
  if (folio.status === FolioStatus.CLOSED || folio.status === FolioStatus.VOIDED || folio.status === FolioStatus.SETTLED) {
    throw new Error(`Cannot post to a ${folio.status} folio`);
  }
  if (folio.status === FolioStatus.FINALIZED && params.lineType !== FolioLineType.REVERSAL) {
    throw new Error("Folio is finalized — only reversals may be posted");
  }

  const direction = LINE_TYPE_DIRECTION[params.lineType];
  if (!direction) throw new Error(`Unknown line type: ${params.lineType}`);

  // A business date closed by the night audit is locked: nothing may be posted to it.
  if (params.businessDate && !params.allowClosedDate) {
    const { isBusinessDateClosed } = await import("./business-date.service");
    const { toBusinessDate } = await import("../../../shared/dates");
    if (await isBusinessDateClosed(toBusinessDate(params.businessDate), opts.session)) {
      throw new Error(`Business date ${toBusinessDate(params.businessDate)} is closed by the night audit; post corrections to the current date`);
    }
  }

  const [line] = await FolioLine.create(
    [
      {
        folio: params.folioId,
        booking: params.bookingId,
        lineType: params.lineType,
        direction,
        description: params.description,
        amount: Math.round(params.amount * 100) / 100, // 2 decimal places
        quantity: params.quantity ?? 1,
        unitPrice: params.unitPrice,
        date: params.date,
        postedAt: new Date(),
        postedBy: params.postedBy,
        businessDate: params.businessDate,
        coversNights: params.coversNights,
        notes: params.notes,
        paymentId: params.paymentId,
        paymentChannelId: params.paymentChannelId,
        advancePaymentId: params.advancePaymentId,
        reversedLineId: params.reversedLineId,
      },
    ],
    { session: opts.session }
  );

  // ── FOLIO TOTALS: recomputed from every line by the one ledger rule (folio-ledger.ts) ──
  Object.assign(folio, await recomputeFolioBalance(params.folioId, { session: opts.session }));
  folio.balance = Math.round(folio.balance * 100) / 100;

  await ensurePropertyId(folio, params.bookingId, opts.req, opts.session);

  await folio.save({ session: opts.session });

  await createAuditLog({
    req: opts.req,
    action: `folio.charge_posted.${params.lineType.toLowerCase()}`,
    resourceType: "FolioLine",
    resourceId: line._id.toString(),
    metadata: {
      folioId: params.folioId,
      bookingId: params.bookingId,
      lineType: params.lineType,
      direction,
      amount: line.amount,
      newBalance: folio.balance,
    },
  });

  return { line, folio };
}


// ─────────────────────────────────────────────────────────────────────────────
// FOLIO FINALIZATION & INVOICE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moves folio from OPEN to FINALIZED (checkout initiated).
 * Validates that no negative balance exists unless explicitly allowed.
 */
export async function finalizeFolio(
  folioId: string,
  opts: { req?: Request; allowNegativeBalance?: boolean; session?: mongoose.ClientSession }
): Promise<IFolio> {
  const folio = opts.session
    ? await Folio.findById(folioId).session(opts.session)
    : await Folio.findById(folioId);
  if (!folio) throw new Error(`Folio ${folioId} not found`);
  if (folio.status !== FolioStatus.OPEN) {
    throw new Error(`Folio is ${folio.status} — cannot finalize`);
  }
  const totals = await recomputeFolioBalance(folioId, { session: opts.session });
  Object.assign(folio, totals);
  if (totals.balance !== 0) throw new FolioNotBalancedError(totals.balance);
  folio.status = FolioStatus.FINALIZED;
  await ensurePropertyId(folio, folio.booking.toString(), opts.req, opts.session);
  await folio.save({ session: opts.session });

  await createAuditLog({
    req: opts.req,
    action: "folio.finalized",
    resourceType: "Folio",
    resourceId: folioId,
    metadata: { balance: folio.balance },
  });

  return folio;
}

/**
 * Generates an invoice number and marks folio as SETTLED.
 */
export async function settleFolio(
  folioId: string,
  opts: { req?: Request; closedBy: string; session?: mongoose.ClientSession }
): Promise<IFolio> {
  const folio = opts.session
    ? await Folio.findById(folioId).session(opts.session)
    : await Folio.findById(folioId);
  if (!folio) throw new Error(`Folio ${folioId} not found`);
  if (folio.status === FolioStatus.SETTLED || folio.status === FolioStatus.CLOSED || folio.status === FolioStatus.VOIDED) {
    throw new Error(`Folio is already ${folio.status}`);
  }
  const totals = await recomputeFolioBalance(folioId, { session: opts.session });
  Object.assign(folio, totals);
  if (totals.balance !== 0) throw new FolioNotBalancedError(totals.balance);

  // GST invoice series: PREFIX/FY/NNNNNN, sequential per financial year and gapless
  // (the counter increment rolls back with the transaction if settlement fails).
  const settingsQuery = HotelSettings.findOne().sort({ updatedAt: -1 });
  const settings = await (opts.session ? settingsQuery.session(opts.session) : settingsQuery).lean();
  const prefix = settings?.invoicePrefix ?? "INV";
  const { todayBusinessDate } = await import("../../../shared/dates");
  const fy = financialYear(todayBusinessDate());
  const invoiceNumber = formatInvoiceNumber(prefix, fy, await nextSequence(`invoice:${fy}`, opts.session));

  folio.status = FolioStatus.SETTLED;
  folio.invoiceNumber = invoiceNumber;
  folio.invoiceGeneratedAt = new Date();
  folio.closedAt = new Date();
  folio.closedBy = new mongoose.Types.ObjectId(opts.closedBy);
  await ensurePropertyId(folio, folio.booking.toString(), opts.req, opts.session);
  await folio.save({ session: opts.session });

  await createAuditLog({
    req: opts.req,
    action: "folio.settled",
    resourceType: "Folio",
    resourceId: folioId,
    metadata: { invoiceNumber, balance: folio.balance },
  });

  return folio;
}

/**
 * Recomputes the folio balance from scratch from all FolioLine records.
 * Used for integrity checks and reconciliation — the running totals on the
 * Folio document are convenient but the FolioLine sum is authoritative.
 */
export async function recomputeFolioBalance(
  folioId: string,
  opts: { session?: mongoose.ClientSession } = {}
): Promise<{
  totalCharges: number;
  totalTax: number;
  totalDiscounts: number;
  totalPaid: number;
  totalAdvanceAdjusted: number;
  balance: number;
  cgst: number;
  sgst: number;
  igst: number;
}> {
  const linesQuery = FolioLine.find({ folio: folioId });
  const lines = await (opts.session ? linesQuery.session(opts.session) : linesQuery).lean();
  return computeFolioTotals(lines as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// READ vs OPEN
// Reads never write. A folio is created only by an explicit action
// (check-in, checkout of a legacy stay, bill edit) via openFolioForBooking.
// ─────────────────────────────────────────────────────────────────────────────

/** Read-only lookup of a booking's folio. Never creates or posts anything. */
export function findFolioForBooking(bookingId: string | mongoose.Types.ObjectId) {
  return Folio.findOne({ booking: bookingId })
    .populate("guest", "firstName lastName email phone")
    .populate("room", "roomNumber floor")
    .populate("booking");
}

/**
 * Credit the folio with every recorded Payment for the booking that is not on it yet.
 * Idempotent: a payment is posted at most once per folio (keyed by paymentId).
 * Posts the net amount actually kept (amount − refundedAmount); nothing is
 * posted from booking.paidAmount, which has no backing record.
 */
export async function postRecordedPaymentsToFolio(
  folioId: string,
  bookingId: string,
  actorId: string,
  opts: { req?: Request; session?: mongoose.ClientSession },
): Promise<number> {
  const { Payment } = await import("../models/Payment");
  const payments = await Payment.find({ booking: bookingId, status: { $in: ["COMPLETED", "REFUNDED"] as any[] } })
    .session(opts.session ?? null)
    .lean();
  const posted = new Set(
    (await FolioLine.find({ folio: folioId, paymentId: { $ne: null } }).select("paymentId").session(opts.session ?? null).lean())
      .map((l) => String(l.paymentId)),
  );
  let count = 0;
  for (const p of payments as any[]) {
    if (posted.has(String(p._id))) continue;
    const net = Math.round(((p.amount || 0) - (p.refundedAmount || 0)) * 100) / 100;
    if (net <= 0) continue;
    await postCharge(
      {
        folioId,
        bookingId,
        lineType: FolioLineType.PAYMENT,
        description: `Payment received (${p.method || "ONLINE"})${p.transactionId ? ` — ${p.transactionId}` : ""}`,
        amount: net,
        date: p.createdAt || new Date(),
        postedBy: actorId,
        paymentId: String(p._id),
        notes: p.refundedAmount ? `Gross ₹${p.amount}, refunded ₹${p.refundedAmount}` : undefined,
      },
      opts,
    );
    count++;
  }
  return count;
}

/**
 * Explicit, idempotent "open folio" action: creates the folio if missing, posts the
 * stay charges once, and credits recorded payments once. Runs in a transaction
 * (its own, or the caller's). Concurrent calls for the same booking serialise on a
 * write to the booking document, so only one folio is ever created.
 */
export async function openFolioForBooking(
  booking: any,
  actorId: string,
  opts: { req?: Request; session?: mongoose.ClientSession } = {},
): Promise<IFolio> {
  const run = async (session: mongoose.ClientSession) => {
    // Write-lock the booking for this transaction (conflicting opens abort and retry).
    await Booking.updateOne({ _id: booking._id }, { $currentDate: { updatedAt: true } }, { session });

    let folio: any = await Folio.findOne({ booking: booking._id }).session(session);
    if (!folio) {
      folio = await createFolio(
        {
          bookingId: booking._id.toString(),
          guestId: (booking.customer ?? new mongoose.Types.ObjectId()).toString(),
          roomId: (booking.assignedRoom?._id ?? booking.assignedRoom)?.toString(),
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
        } as any,
        { req: opts.req, session },
      );
    }
    const folioId = folio._id.toString();
    const bookingId = booking._id.toString();

    const hasRoomCharge = await FolioLine.exists({ folio: folio._id, lineType: FolioLineType.ROOM_CHARGE }).session(session);
    if (!hasRoomCharge) {
      const checkIn = new Date(booking.checkInDate || Date.now());
      const checkOut = new Date(booking.checkOutDate || Date.now());
      const nights = Math.max(1, countNights(checkIn, checkOut));
      const rate = booking.ratePerNight || Math.round(((booking.totalAmount || 0) - (booking.taxAmount || 0)) / nights);
      const roomTotal = rate * nights;
      if (roomTotal > 0) {
        await postCharge(
          {
            folioId,
            bookingId,
            lineType: FolioLineType.ROOM_CHARGE,
            description: `Room Tariff (${nights} Night${nights > 1 ? "s" : ""} @ ₹${rate.toLocaleString()}/night)`,
            amount: roomTotal,
            date: checkIn,
            postedBy: actorId,
          },
          { req: opts.req, session },
        );
        // TODO(step 2): extra-bed rate and tax slab come from settings / taxService.
        const extraBed = (booking.extraPersonsWithBed || 0) * 1200 * nights;
        if (extraBed > 0) {
          await postCharge(
            { folioId, bookingId, lineType: FolioLineType.EXTRA_BED, description: "Extra Bed Charges", amount: extraBed, date: checkIn, postedBy: actorId },
            { req: opts.req, session },
          );
        }
        const tax = computeRoomTax(await loadGstRules(), { checkIn, checkOut, nightlyValue: (roomTotal + extraBed) / nights });
        for (const [lineType, amount, label] of [
          [FolioLineType.TAX_CGST, tax.cgst, "CGST"],
          [FolioLineType.TAX_SGST, tax.sgst, "SGST"],
        ] as const) {
          if (amount > 0) {
            await postCharge(
              { folioId, bookingId, lineType, description: `${label} on Room Tariff`, amount, date: checkIn, postedBy: actorId },
              { req: opts.req, session },
            );
          }
        }
      }
    }

    await postRecordedPaymentsToFolio(folioId, bookingId, actorId, { req: opts.req, session });
    return (await Folio.findById(folio._id).session(session))!;
  };

  if (opts.session) return run(opts.session);
  const session = await mongoose.startSession();
  try {
    let result!: IFolio;
    await session.withTransaction(async () => {
      result = await run(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Voids a folio line by posting a REVERSAL that points to it (the original stays for the
 * audit trail). A line can be reversed once; reversals themselves cannot be reversed.
 */
export async function reverseFolioLine(
  folioId: string,
  lineId: string,
  reason: string,
  opts: { req?: Request; session?: mongoose.ClientSession; postedBy: string },
) {
  const original = await FolioLine.findOne({ _id: lineId, folio: folioId }).session(opts.session ?? null);
  if (!original) throw new Error("Folio line not found");
  if (original.lineType === FolioLineType.REVERSAL) throw new Error("A reversal cannot itself be reversed");
  const already = await FolioLine.exists({ folio: folioId, reversedLineId: original._id }).session(opts.session ?? null);
  if (already) throw new Error("This line has already been reversed");
  const result = await postCharge(
    {
      folioId,
      bookingId: original.booking.toString(),
      lineType: FolioLineType.REVERSAL,
      description: `Reversal of: ${original.description}`,
      amount: original.amount,
      date: new Date(),
      postedBy: opts.postedBy,
      notes: reason,
      reversedLineId: original._id.toString(),
    },
    { req: opts.req, session: opts.session },
  );
  await createAuditLog({
    req: opts.req,
    action: "folio.line_reversed",
    resourceType: "FolioLine",
    resourceId: original._id.toString(),
    metadata: { folioId, reversalLineId: result.line._id.toString(), reason, before: { lineType: original.lineType, amount: original.amount } },
  });
  return result;
}

/** Standard transaction id: TXN-YYYYMMDD-NNNNNN (business date, gapless per day). Gateway ids are stored separately. */
export async function nextTransactionId(session?: mongoose.ClientSession): Promise<string> {
  const { todayBusinessDate } = await import("../../../shared/dates");
  const ymd = todayBusinessDate();
  const seq = await nextSequence(`txn:${ymd}`, session);
  return `TXN-${ymd.replace(/-/g, "")}-${String(seq).padStart(6, "0")}`;
}

/**
 * Records money received against a folio: a Payment document and the folio PAYMENT line
 * that points to it, in the same transaction. No payment line exists without a Payment.
 */
export async function recordFolioPayment(
  params: { folioId: string; bookingId: string; amount: number; method: string; description: string; postedBy: string; paymentChannelId?: string; notes?: string; propertyId?: any },
  opts: { req?: Request; session?: mongoose.ClientSession },
) {
  const { Payment, PaymentTxStatus } = await import("../models/Payment");
  const method = ["CASH", "CARD", "UPI", "RAZORPAY"].includes(params.method) ? params.method : "CASH";
  const [payment] = await (Payment as any).create(
    [{
      propertyId: params.propertyId,
      booking: params.bookingId,
      amount: params.amount,
      currency: "INR",
      method,
      status: PaymentTxStatus?.COMPLETED ?? "COMPLETED",
      transactionId: await nextTransactionId(opts.session),
    }],
    { session: opts.session },
  );
  const posted = await postCharge(
    {
      folioId: params.folioId,
      bookingId: params.bookingId,
      lineType: FolioLineType.PAYMENT,
      description: params.description,
      amount: params.amount,
      date: new Date(),
      postedBy: params.postedBy,
      paymentId: payment._id.toString(),
      paymentChannelId: params.paymentChannelId,
      notes: params.notes,
    },
    opts,
  );
  return { payment, ...posted };
}
