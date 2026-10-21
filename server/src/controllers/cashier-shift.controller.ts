import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { Property } from "../models/Property";
import { User, UserRole } from "../models/User";
import { createAuditLog } from "../services/audit.service";
import { AuthenticatedRequest } from "../middleware/propertyAuth";
import { getCurrentBusinessDate } from "../services/business-date.service";
import { businessDayRange } from "../../../shared/dates";
import {
  computeDenominationTotal,
  computeShiftLedger,
  resolveCount,
  varianceOutcome,
  varianceThreshold,
  generateShiftNumber,
  activeShiftConflict,
  ShiftRuleError,
} from "../services/cashier-shift.service";

// Kept as a named export for existing callers/tests.
export { computeDenominationTotal };

const ACTIVE = [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING];
const SHIFT_ROLES = [UserRole.CASHIER, UserRole.RECEPTIONIST, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

const Denominations = z
  .object({
    n2000: z.coerce.number().int().min(0).optional().default(0),
    n500: z.coerce.number().int().min(0).optional().default(0),
    n200: z.coerce.number().int().min(0).optional().default(0),
    n100: z.coerce.number().int().min(0).optional().default(0),
    n50: z.coerce.number().int().min(0).optional().default(0),
    n20: z.coerce.number().int().min(0).optional().default(0),
    n10: z.coerce.number().int().min(0).optional().default(0),
    coins: z.coerce.number().min(0).optional().default(0),
  })
  .optional();

const PAID_OUT_LABELS: Record<string, string> = {
  CASH_DROP: "Cash drop to hotel safe / finance",
  PETTY_CASH: "Front desk petty cash expense",
  REFUND: "Counter cash refund",
  EARLY_CHECK_IN: "Early check-in",
  WATER_BOTTLE: "Water bottle",
  DENTAL_KIT: "Dental kit",
  TEA_COFFEE_SHOP: "Tea / coffee shop",
  KOVAI_KONGU_MESS: "Kovai Kongu Mess",
  OTHER: "Other",
};

/** A variance above the threshold goes to the Reception Verification Queue. */
async function queueShiftVariance(shift: any, req: Request) {
  if (!shift.varianceAcceptanceRequired) return;
  const { submitForVerification } = await import("../services/verification.service");
  const { VerificationType } = await import("../models/VerificationRequest");
  await submitForVerification({
    type: VerificationType.SHIFT_VARIANCE,
    subjectKey: `shift:${shift._id}:variance`,
    returnQueue: "CASHIER",
    summary: `Shift #${shift.shiftNumber} (${shift.drawerId}) closed ₹${Number(shift.cashVariance ?? 0).toFixed(2)} ${Number(shift.cashVariance) < 0 ? "short" : "over"}`,
    amount: Number(shift.cashVariance ?? 0),
    propertyId: shift.propertyId,
    details: { shiftId: String(shift._id), shiftNumber: shift.shiftNumber, drawerId: shift.drawerId, expectedCash: shift.expectedCash, counted: shift.actualCashCounted, variance: shift.cashVariance, reason: shift.varianceReason },
    note: shift.varianceReason,
    req,
  });
}

const actorOf = (req: Request) => String((req as any).user?.id || (req as any).user?._id);

async function isShiftSupervisor(req: Request): Promise<boolean> {
  const { PermissionService } = await import("../services/PermissionService");
  return PermissionService.can((req as any).user, "CAP.SHIFT_SUPERVISOR_OVERRIDE");
}

function fail(res: Response, error: any) {
  const conflict = activeShiftConflict(error);
  const e = conflict ?? error;
  if (e instanceof ShiftRuleError) return res.status(e.status).json({ success: false, message: e.message });
  return res.status(500).json({ success: false, message: error.message });
}

async function resolveOperationalContext(req: AuthenticatedRequest) {
  let propertyId = req.propertyId as mongoose.Types.ObjectId | undefined;
  if (!propertyId) {
    const props = await Property.find().select("_id").limit(2).lean();
    if (props.length === 1) propertyId = props[0]._id as mongoose.Types.ObjectId;
  }
  if (!propertyId) throw new ShiftRuleError("No property selected for this shift");
  const { date } = await getCurrentBusinessDate();
  return { propertyId, businessDate: businessDayRange(date).start };
}

// ─── GET /api/cashier-shifts/current ────────────────────────────────────────
export const getCurrentShift = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    let activeShift = await CashierShift.findOne({ cashier: actorId, status: { $in: ACTIVE } })
      .populate("cashier", "name email role firstName lastName")
      .populate("handoverToCashier", "name email role firstName lastName");
    if (!activeShift) {
      activeShift = await CashierShift.findOne({ handoverToCashier: actorId, status: CashierShiftStatus.HANDOVER_PENDING })
        .populate("cashier", "name email role firstName lastName")
        .populate("handoverToCashier", "name email role firstName lastName");
    }
    if (!activeShift) return res.json({ success: true, data: null });
    const ledger = await computeShiftLedger(activeShift);
    return res.json({ success: true, data: { ...activeShift.toObject(), liveLedger: ledger } });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── GET /api/cashier-shifts ────────────────────────────────────────────────
export const getAllShifts = async (req: Request, res: Response) => {
  try {
    const { status, drawerId, dateFrom, dateTo, cashierId } = req.query;
    const filter: Record<string, any> = {};
    if ((req as any).propertyId) filter.propertyId = (req as any).propertyId;
    if (status && status !== "ALL") filter.status = status;
    if (drawerId && drawerId !== "ALL") filter.drawerId = drawerId;
    if (cashierId) filter.cashier = cashierId;
    if (dateFrom || dateTo) {
      filter.openedAt = {};
      if (dateFrom) filter.openedAt.$gte = businessDayRange(String(dateFrom).slice(0, 10)).start;
      if (dateTo) filter.openedAt.$lt = businessDayRange(String(dateTo).slice(0, 10)).end;
    }
    const shifts = await CashierShift.find(filter)
      .populate("cashier", "name email role firstName lastName")
      .populate("handoverToCashier", "name email role firstName lastName")
      .populate("supervisorApproval.approvedBy", "name email role firstName lastName")
      .sort({ openedAt: -1 })
      .lean();
    return res.json({ success: true, data: shifts });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── GET /api/cashier-shifts/:id/details ────────────────────────────────────
export const getShiftDetails = async (req: Request, res: Response) => {
  try {
    const shift = await CashierShift.findById(req.params.id)
      .populate("cashier", "name email role firstName lastName")
      .populate("handoverToCashier", "name email role firstName lastName")
      .populate("supervisorApproval.approvedBy", "name email role firstName lastName");
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    const ledger = await computeShiftLedger(shift);
    return res.json({ success: true, data: { ...shift.toObject(), ledger } });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── POST /api/cashier-shifts/open ──────────────────────────────────────────
export const openShift = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    const parsed = z
      .object({
        drawerId: z.string().trim().min(1).default("DRAWER-01"),
        openingFloat: z.coerce.number().min(0).optional(),
        openingDenominations: Denominations,
        notes: z.string().trim().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid shift data", errors: parsed.error.issues });
    const { drawerId, openingFloat, openingDenominations, notes } = parsed.data;
    const { propertyId, businessDate } = await resolveOperationalContext(req as AuthenticatedRequest);
    const count = resolveCount(openingFloat, openingDenominations);

    // Friendly pre-checks; the unique indexes are the real guard under concurrency.
    const mine = await CashierShift.findOne({ cashier: actorId, status: { $in: ACTIVE } });
    if (mine) throw new ShiftRuleError(`You already have an active shift (#${mine.shiftNumber}) on ${mine.drawerId}`, 409);
    const drawer = await CashierShift.findOne({ propertyId, drawerId, status: { $in: ACTIVE } });
    if (drawer) throw new ShiftRuleError(`Drawer '${drawerId}' is active under shift #${drawer.shiftNumber}. Close or hand it over first.`, 409);

    const shiftNumber = await generateShiftNumber();
    const shift = await CashierShift.create({
      propertyId,
      shiftNumber,
      drawerId,
      cashier: actorId,
      businessDate,
      openedAt: new Date(),
      openingFloat: count.total,
      openingDenominations: count.denominations,
      expectedCash: count.total,
      notes,
      status: CashierShiftStatus.OPEN,
    });

    await createAuditLog({
      req,
      action: "cashier_shift.opened",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber, drawerId, openingFloat: shift.openingFloat, businessDate },
    });
    return res.status(201).json({ success: true, message: `Cashier shift #${shiftNumber} opened on ${drawerId}`, data: shift });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── POST /api/cashier-shifts/:id/paid-out ──────────────────────────────────
export const recordPaidOut = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    const parsed = z
      .object({
        amount: z.coerce.number().positive("Amount must be greater than 0"),
        reason: z.string().trim().optional(),
        // Money leaving the drawer only. Items sold to guests are counter sales (POST /:id/sales).
        category: z.enum(["CASH_DROP", "PETTY_CASH", "REFUND", "OTHER"]).default("PETTY_CASH"),
        recipient: z.string().trim().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid paid-out data", errors: parsed.error.issues });
    // "Others" must say what the cash was for; the named categories describe themselves.
    if (parsed.data.category === "OTHER" && (parsed.data.reason ?? "").length < 3) {
      return res.status(400).json({ success: false, message: "Enter the reason for this paid-out" });
    }
    parsed.data.reason = parsed.data.reason || PAID_OUT_LABELS[parsed.data.category];

    const shift = await CashierShift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) throw new ShiftRuleError("Paid-outs can only be recorded on an OPEN shift");
    if (String(shift.cashier) !== actorId && !(await isShiftSupervisor(req))) {
      throw new ShiftRuleError("Only the shift's cashier or a supervisor can take cash from this drawer", 403);
    }
    const ledger = await computeShiftLedger(shift);
    if (parsed.data.amount > ledger.expectedCash) {
      throw new ShiftRuleError(`The drawer should hold ₹${ledger.expectedCash.toFixed(2)}; a paid-out of ₹${parsed.data.amount.toFixed(2)} is more than that.`);
    }

    shift.paidOuts.push({ ...parsed.data, authorizedBy: actorId, createdAt: new Date() } as any);
    shift.totalPaidOut = shift.paidOuts.reduce((t: number, p: any) => t + (Number(p.amount) || 0), 0);
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.paid_out",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber: shift.shiftNumber, ...parsed.data },
    });
    return res.json({ success: true, message: `Cash paid-out of ₹${parsed.data.amount.toLocaleString("en-IN")} recorded`, data: shift });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── POST /api/cashier-shifts/:id/sales ─────────────────────────────────────
// Room service / counter sale: the guest pays the desk for an item (water bottle, dental kit,
// early check-in …). Income — cash goes into the drawer, UPI/card into their own totals.
export const recordCounterSale = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    const { COUNTER_SALE_CATEGORIES } = await import("../models/CashierShift");
    const parsed = z
      .object({
        category: z.enum(COUNTER_SALE_CATEGORIES),
        amount: z.coerce.number().positive("Amount must be greater than 0"),
        quantity: z.coerce.number().int().min(1).max(999).default(1),
        mode: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
        reference: z.string().trim().max(60).optional(),
        roomNumber: z.string("Enter the room number: the sale is added to that room's bill").trim().min(1, "Enter the room number: the sale is added to that room's bill").max(20),
        reason: z.string().trim().max(200).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid sale", errors: parsed.error.issues });
    const d = parsed.data;
    if (d.category === "OTHER" && (d.reason ?? "").length < 3) {
      return res.status(400).json({ success: false, message: "Enter what was sold (Others)" });
    }
    if (d.mode !== "CASH" && !d.reference) {
      return res.status(400).json({ success: false, message: d.mode === "UPI" ? "Enter the UPI reference (UTR)" : "Enter the card approval code" });
    }

    const shift = await CashierShift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) throw new ShiftRuleError("Sales can only be recorded on an OPEN shift");
    if (String(shift.cashier) !== actorId && !(await isShiftSupervisor(req))) {
      throw new ShiftRuleError("Only the shift's cashier or a supervisor can record sales on this drawer", 403);
    }

    const description = d.category === "OTHER" ? d.reason! : (d.reason ? `${PAID_OUT_LABELS[d.category]} — ${d.reason}` : PAID_OUT_LABELS[d.category]);

    // The room's bill: the guest in that room right now. The item is posted as a charge and the money taken at the
    // desk as a payment against it, so the room balance is unchanged and the invoice names the item and how it was paid.
    const { Room } = await import("../models/Room");
    const { Booking, BookingStatus } = await import("../models/Booking");
    const { postCharge, findFolioForBooking } = await import("../services/folio.service");
    const { FolioLineType } = await import("../models/FolioLine");
    const { resolvePaymentChannel } = await import("../utils/payment-channel.resolver");
    const room: any = await Room.findOne({ roomNumber: d.roomNumber, ...(shift.propertyId ? { propertyId: shift.propertyId } : {}) }).select("_id roomNumber").lean();
    const stay: any = room ? await Booking.findOne({ assignedRoom: room._id, status: BookingStatus.CHECKED_IN }).sort({ checkedInAt: -1 }).select("_id").lean() : null;
    if (!stay) return res.status(400).json({ success: false, message: `Room ${d.roomNumber} has no checked-in guest: the sale is added to the room's bill` });
    const folio: any = await findFolioForBooking(stay._id);
    if (!folio || folio.status !== "OPEN") return res.status(400).json({ success: false, message: `Room ${d.roomNumber} has no open bill to add this sale to` });
    const label = `${description}${d.quantity > 1 ? ` × ${d.quantity}` : ""}`;
    const channel = await resolvePaymentChannel(d.mode, undefined).catch(() => undefined);
    const now = new Date();
    await postCharge({ folioId: String(folio._id), bookingId: String(stay._id), lineType: FolioLineType.ADDON, description: label, amount: d.amount, quantity: d.quantity, date: now, postedBy: "COUNTER_SALE", notes: `item:${d.category}` }, { req });
    await postCharge({ folioId: String(folio._id), bookingId: String(stay._id), lineType: FolioLineType.PAYMENT, description: `${label} paid at the desk (${d.mode})`, amount: d.amount, date: now, postedBy: "COUNTER_SALE", paymentChannelId: channel ? String(channel) : undefined, notes: d.reference || undefined }, { req });

    (shift as any).counterSales.push({ category: d.category, description, quantity: d.quantity, amount: d.amount, mode: d.mode, reference: d.reference, roomNumber: d.roomNumber, recordedBy: actorId, createdAt: new Date() });
    (shift as any).totalCounterSales = (shift as any).counterSales.reduce((t: number, c: any) => t + (Number(c.amount) || 0), 0);
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.counter_sale",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber: shift.shiftNumber, ...d, description },
    });
    return res.status(201).json({ success: true, message: `${description}: ₹${d.amount.toLocaleString("en-IN")} (${d.mode}) recorded`, data: shift });
  } catch (error: any) {
    return fail(res, error);
  }
};

/** Stores the ledger snapshot and the count on a shift that is being frozen. */
function applySnapshot(shift: any, ledger: Awaited<ReturnType<typeof computeShiftLedger>>, counted: number, denominations: any) {
  shift.cashCollected = ledger.cashCollected;
  shift.cashAdvances = ledger.cashAdvances;
  shift.cashRefunds = ledger.cashRefunds;
  shift.totalPaidOut = ledger.totalPaidOut;
  shift.expectedCash = ledger.expectedCash;
  shift.expectedUpi = ledger.expectedUpi;
  shift.expectedCard = ledger.expectedCard;
  shift.expectedGateway = ledger.expectedGateway;
  shift.expectedOther = ledger.expectedOther;
  shift.actualCashCounted = counted;
  shift.closingDenominations = denominations;
  shift.cashVariance = Math.round((counted - ledger.expectedCash) * 100) / 100;
}

// ─── POST /api/cashier-shifts/:id/handover/initiate ─────────────────────────
// Freezes the drawer at the count: the ledger stops at handoverInitiatedAt.
export const initiateHandover = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    const parsed = z
      .object({
        targetCashierId: z.string().trim().min(1, "Incoming cashier is required"),
        countedCash: z.coerce.number().min(0).optional(),
        denominations: Denominations,
        varianceReason: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid handover details", errors: parsed.error.issues });

    const shift = await CashierShift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) throw new ShiftRuleError("Only OPEN shifts can be handed over");
    if (String(shift.cashier) !== actorId) throw new ShiftRuleError("Only the shift's cashier can hand it over", 403);
    if (parsed.data.targetCashierId === actorId) throw new ShiftRuleError("Hand over to a different cashier");

    const target = await User.findById(parsed.data.targetCashierId);
    if (!target) return res.status(404).json({ success: false, message: "Incoming cashier not found" });
    if (!(target as any).isActive || !SHIFT_ROLES.includes((target as any).role)) {
      throw new ShiftRuleError("The incoming user is not an active cashier-eligible staff member");
    }
    const targetActive = await CashierShift.findOne({ cashier: target._id, status: { $in: ACTIVE } });
    if (targetActive) throw new ShiftRuleError(`The incoming cashier already has an active shift (#${targetActive.shiftNumber})`, 409);

    const count = resolveCount(parsed.data.countedCash, parsed.data.denominations);
    shift.handoverInitiatedAt = new Date();
    const ledger = await computeShiftLedger(shift);
    const variance = count.total - ledger.expectedCash;
    varianceOutcome(variance, parsed.data.varianceReason, await varianceThreshold()); // reason required for any variance

    applySnapshot(shift, ledger, count.total, count.denominations);
    shift.status = CashierShiftStatus.HANDOVER_PENDING;
    shift.handoverToCashier = target._id as mongoose.Types.ObjectId;
    shift.handoverNotes = parsed.data.notes;
    shift.varianceReason = parsed.data.varianceReason;
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.handover_initiated",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber: shift.shiftNumber, fromCashier: actorId, toCashier: target._id, countedCash: count.total, expectedCash: ledger.expectedCash, variance: shift.cashVariance },
    });
    return res.json({
      success: true,
      message: `Handover to ${(target as any).firstName ?? ""} ${(target as any).lastName ?? ""} started. The drawer is frozen until they confirm.`.replace(/\s+/g, " "),
      data: shift,
    });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── POST /api/cashier-shifts/:id/handover/confirm ──────────────────────────
// Closes the outgoing shift and opens the incoming one with the counted float, atomically.
export const confirmHandover = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const actorId = actorOf(req);
    let closed: any;
    let opened: any;
    await session.withTransaction(async () => {
      const shift = await CashierShift.findById(req.params.id).session(session);
      if (!shift) throw new ShiftRuleError("Shift not found", 404);
      if (shift.status !== CashierShiftStatus.HANDOVER_PENDING) throw new ShiftRuleError("Shift is not awaiting handover confirmation");
      if (String(shift.handoverToCashier) !== actorId) throw new ShiftRuleError("Only the designated incoming cashier can confirm this handover", 403);

      const outcome = varianceOutcome(Number(shift.cashVariance ?? 0), shift.varianceReason ?? undefined, await varianceThreshold());
      shift.status = outcome.status;
      shift.varianceAcceptanceRequired = outcome.acceptanceRequired;
      shift.closedAt = shift.handoverInitiatedAt ?? new Date();
      shift.handoverCompletedAt = new Date();
      await shift.save({ session });

      const newShiftNumber = await generateShiftNumber(session);
      const float = shift.actualCashCounted ?? shift.expectedCash;
      [opened] = await CashierShift.create(
        [{
          propertyId: shift.propertyId,
          shiftNumber: newShiftNumber,
          drawerId: shift.drawerId,
          cashier: actorId,
          businessDate: shift.businessDate,
          openedAt: new Date(),
          openingFloat: float,
          openingDenominations: shift.closingDenominations,
          expectedCash: float,
          notes: `Handover accepted from shift #${shift.shiftNumber}`,
          status: CashierShiftStatus.OPEN,
        }],
        { session },
      );
      closed = shift;
    });

    await queueShiftVariance(closed, req);
    await createAuditLog({
      req,
      action: "cashier_shift.handover_confirmed",
      resourceType: "CashierShift",
      resourceId: opened._id.toString(),
      metadata: { previousShiftId: closed._id, previousShiftNumber: closed.shiftNumber, newShiftNumber: opened.shiftNumber, openingFloat: opened.openingFloat, previousStatus: closed.status },
    });
    return res.json({
      success: true,
      message: `Handover confirmed. Shift #${closed.shiftNumber} is ${closed.status}; shift #${opened.shiftNumber} opened.`,
      data: { closedShift: closed, newShift: opened },
    });
  } catch (error: any) {
    return fail(res, error);
  } finally {
    await session.endSession();
  }
};

// ─── POST /api/cashier-shifts/:id/close ─────────────────────────────────────
export const closeShift = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    const parsed = z
      .object({
        actualCashCounted: z.coerce.number().min(0).optional(),
        closingDenominations: Denominations,
        varianceReason: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid closing data", errors: parsed.error.issues });

    const shift = await CashierShift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) {
      throw new ShiftRuleError(shift.status === CashierShiftStatus.HANDOVER_PENDING ? "This shift is being handed over; the incoming cashier confirms it" : "Shift is already closed");
    }
    if (String(shift.cashier) !== actorId && !(await isShiftSupervisor(req))) {
      throw new ShiftRuleError("Only the shift's cashier or a supervisor can close this shift", 403);
    }

    const count = resolveCount(parsed.data.actualCashCounted, parsed.data.closingDenominations);
    shift.closedAt = new Date();
    const ledger = await computeShiftLedger(shift);
    const outcome = varianceOutcome(count.total - ledger.expectedCash, parsed.data.varianceReason, await varianceThreshold());

    applySnapshot(shift, ledger, count.total, count.denominations);
    shift.varianceReason = parsed.data.varianceReason;
    shift.notes = parsed.data.notes || shift.notes;
    shift.status = outcome.status;
    shift.varianceAcceptanceRequired = outcome.acceptanceRequired;
    await shift.save();

    await queueShiftVariance(shift, req);
    await createAuditLog({
      req,
      action: "cashier_shift.closed",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber: shift.shiftNumber, expectedCash: ledger.expectedCash, actualCounted: count.total, variance: shift.cashVariance, status: shift.status, acceptanceRequired: outcome.acceptanceRequired },
    });
    return res.json({
      success: true,
      message: outcome.acceptanceRequired
        ? `Shift #${shift.shiftNumber} closed with a variance of ₹${shift.cashVariance!.toFixed(2)}; sent to the Verification Queue.`
        : `Shift #${shift.shiftNumber} closed and reconciled.`,
      data: shift,
    });
  } catch (error: any) {
    return fail(res, error);
  }
};

// ─── POST /api/cashier-shifts/:id/accept ────────────────────────────────────
// A manager/supervisor (CAP.SHIFT_SUPERVISOR_OVERRIDE) accepts a variance above the threshold.
// The cashier cannot accept their own shift.
export const acceptShiftVariance = async (req: Request, res: Response) => {
  try {
    const actorId = actorOf(req);
    const notes = String(req.body?.notes ?? "").trim();
    if (notes.length < 3) throw new ShiftRuleError("Acceptance notes are required");
    if (!(await isShiftSupervisor(req))) throw new ShiftRuleError("Only an authorized user can accept a cash variance", 403);

    const shift = await CashierShift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.CLOSED || !shift.varianceAcceptanceRequired) {
      throw new ShiftRuleError("This shift has no variance awaiting acceptance");
    }
    void actorId;
    // Accepting is verifying the queued variance task (one record of who accepted and when).
    await queueShiftVariance(shift, req);
    const { VerificationRequest, VerificationStatus } = await import("../models/VerificationRequest");
    const { reviewVerification } = await import("../services/verification.service");
    const pending = await VerificationRequest.findOne({ subjectKey: `shift:${shift._id}:variance`, status: VerificationStatus.PENDING });
    if (!pending) throw new ShiftRuleError("This shift has no variance awaiting acceptance");
    await reviewVerification(String(pending._id), "APPROVE", notes, req);
    const accepted = await CashierShift.findById(shift._id);
    if (accepted) Object.assign(shift, accepted.toObject());

    await createAuditLog({
      req,
      action: "cashier_shift.variance_accepted",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber: shift.shiftNumber, variance: shift.cashVariance, reason: shift.varianceReason, notes },
    });
    return res.json({ success: true, message: `Variance on shift #${shift.shiftNumber} accepted`, data: shift });
  } catch (error: any) {
    return fail(res, error);
  }
};

/**
 * GET /api/cashier-shifts/cashiers
 * Active staff eligible to hold a drawer or receive a handover.
 */
export const getCashierStaffList = async (_req: Request, res: Response) => {
  try {
    const cashiers = await User.find({ role: { $in: SHIFT_ROLES }, isActive: true }).select("_id firstName lastName email role").lean();
    return res.json({
      success: true,
      data: cashiers.map((u) => ({ _id: u._id, name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email, email: u.email, role: u.role })),
    });
  } catch (error: any) {
    return fail(res, error);
  }
};
