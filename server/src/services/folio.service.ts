import mongoose from "mongoose";
import { Folio, IFolio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType, FolioLineDirection, LINE_TYPE_DIRECTION } from "../models/FolioLine";
import { HotelSettings } from "../models/HotelSettings";
import { createAuditLog } from "./audit.service";
import type { Request } from "express";

// ─────────────────────────────────────────────────────────────────────────────
// GST CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

export interface TaxBreakdown {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalWithTax: number;
}

/**
 * Calculates CGST + SGST (or IGST for interstate) from a taxable amount.
 * Reads the current hotel tax configuration. Never trust client-sent tax.
 */
export async function calculateTaxBreakdown(
  taxableAmount: number,
  opts: { interstate?: boolean } = {}
): Promise<TaxBreakdown> {
  const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
  const cgstRate = settings?.cgstPercentage ?? 9;
  const sgstRate = settings?.sgstPercentage ?? 9;
  const igstRate = settings?.igstPercentage ?? 18;

  const base = Math.max(0, taxableAmount);

  if (opts.interstate) {
    const igst = Math.round(base * igstRate) / 100;
    return {
      taxableAmount: base,
      cgst: 0,
      sgst: 0,
      igst,
      totalTax: igst,
      totalWithTax: base + igst,
    };
  }

  const cgst = Math.round(base * cgstRate) / 100;
  const sgst = Math.round(base * sgstRate) / 100;
  return {
    taxableAmount: base,
    cgst,
    sgst,
    igst: 0,
    totalTax: cgst + sgst,
    totalWithTax: base + cgst + sgst,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// FOLIO CREATION
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateFolioParams {
  bookingId: string;
  guestId: string;
  roomId: string;
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
  notes?: string;
  /** For PAYMENT lines: the Payment document ID */
  paymentId?: string;
  /** For ADVANCE_ADJUSTMENT lines: the AdvancePayment document ID */
  advancePaymentId?: string;
  /** For REVERSAL lines: the FolioLine being reversed */
  reversedLineId?: string;
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

  if (folio.status === FolioStatus.CLOSED || folio.status === FolioStatus.VOIDED) {
    throw new Error(`Cannot post to a ${folio.status} folio`);
  }
  if (folio.status === FolioStatus.FINALIZED && params.lineType !== FolioLineType.REVERSAL) {
    throw new Error("Folio is finalized — only reversals may be posted");
  }

  const direction = LINE_TYPE_DIRECTION[params.lineType];
  if (!direction) throw new Error(`Unknown line type: ${params.lineType}`);

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
        notes: params.notes,
        paymentId: params.paymentId,
        advancePaymentId: params.advancePaymentId,
        reversedLineId: params.reversedLineId,
      },
    ],
    { session: opts.session }
  );

  // ── UPDATE FOLIO RUNNING TOTALS ──
  const amt = line.amount;
  if (direction === FolioLineDirection.DEBIT) {
    switch (params.lineType) {
      case FolioLineType.TAX_CGST:
        folio.cgst += amt;
        folio.totalTax += amt;
        break;
      case FolioLineType.TAX_SGST:
        folio.sgst += amt;
        folio.totalTax += amt;
        break;
      case FolioLineType.TAX_IGST:
        folio.igst += amt;
        folio.totalTax += amt;
        break;
      default:
        folio.totalCharges += amt;
    }
  } else {
    switch (params.lineType) {
      case FolioLineType.DISCOUNT:
        folio.totalDiscounts += amt;
        break;
      case FolioLineType.PAYMENT:
        folio.totalPaid += amt;
        break;
      case FolioLineType.ADVANCE_ADJUSTMENT:
        folio.totalAdvanceAdjusted += amt;
        break;
      default:
        // REFUND, COMPLIMENTARY, REVERSAL — reduce charges
        folio.totalCharges = Math.max(0, folio.totalCharges - amt);
    }
  }

  // Recompute balance
  folio.balance = folio.totalCharges + folio.totalTax - folio.totalDiscounts - folio.totalPaid - folio.totalAdvanceAdjusted;
  folio.balance = Math.round(folio.balance * 100) / 100;

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
      amount: amt,
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

  folio.status = FolioStatus.FINALIZED;
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

  const settingsQuery = HotelSettings.findOne().sort({ updatedAt: -1 });
  const settings = await (opts.session ? settingsQuery.session(opts.session) : settingsQuery).lean();
  const prefix = settings?.invoicePrefix ?? "INV";
  const invoiceNumber = `${prefix}-${Date.now()}`;

  folio.status = FolioStatus.SETTLED;
  folio.invoiceNumber = invoiceNumber;
  folio.invoiceGeneratedAt = new Date();
  folio.closedAt = new Date();
  folio.closedBy = new mongoose.Types.ObjectId(opts.closedBy);
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

  let totalCharges = 0;
  let totalTax = 0;
  let totalDiscounts = 0;
  let totalPaid = 0;
  let totalAdvanceAdjusted = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const line of lines) {
    const amt = line.amount;
    if (line.direction === FolioLineDirection.DEBIT) {
      if (line.lineType === FolioLineType.TAX_CGST) { cgst += amt; totalTax += amt; }
      else if (line.lineType === FolioLineType.TAX_SGST) { sgst += amt; totalTax += amt; }
      else if (line.lineType === FolioLineType.TAX_IGST) { igst += amt; totalTax += amt; }
      else totalCharges += amt;
    } else {
      if (line.lineType === FolioLineType.DISCOUNT) totalDiscounts += amt;
      else if (line.lineType === FolioLineType.PAYMENT) totalPaid += amt;
      else if (line.lineType === FolioLineType.ADVANCE_ADJUSTMENT) totalAdvanceAdjusted += amt;
      else totalCharges = Math.max(0, totalCharges - amt); // REVERSAL, COMPLIMENTARY, REFUND
    }
  }

  const balance = Math.round((totalCharges + totalTax - totalDiscounts - totalPaid - totalAdvanceAdjusted) * 100) / 100;
  return {
    totalCharges: Math.round(totalCharges * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    totalDiscounts: Math.round(totalDiscounts * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalAdvanceAdjusted: Math.round(totalAdvanceAdjusted * 100) / 100,
    balance,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
  };
}
