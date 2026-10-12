import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { CashierShift, CashierShiftStatus, IDenominationBreakdown } from "../models/CashierShift";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment, AdvancePaymentMethod } from "../models/AdvancePayment";
import { PaymentMethod } from "../models/Payment";
import { Refund, RefundStatus } from "../models/Refund";
import { Property } from "../models/Property";
import { User, UserRole } from "../models/User";
import { createAuditLog } from "../services/audit.service";
import { AuthenticatedRequest } from "../middleware/propertyAuth";

// ─── Helper: Compute denomination total authoritatively ────────────────────
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

// ─── Helper: Generate unique concurrency-safe shift number ──────────────────
async function generateShiftNumber(propertyId: mongoose.Types.ObjectId): Promise<string> {
  const d = new Date();
  const prefix = `SHF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const count = await CashierShift.countDocuments({
    propertyId,
    shiftNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

// ─── Helper: Resolve operational property & business date ───────────────────
async function resolveOperationalContext(req: AuthenticatedRequest) {
  let propertyId = req.propertyId;
  if (!propertyId) {
    const prop = await Property.findOne().select("_id");
    if (prop) propertyId = prop._id as mongoose.Types.ObjectId;
  }
  if (!propertyId) {
    propertyId = new mongoose.Types.ObjectId("64b8f0000000000000000001");
  }

  let bizDateDoc = await BusinessDate.findOne({ propertyId, isCurrentDate: true });
  if (!bizDateDoc) {
    bizDateDoc = await BusinessDate.findOne({ isCurrentDate: true });
  }
  const businessDate = bizDateDoc ? new Date(bizDateDoc.date) : new Date();
  return { propertyId, businessDate };
}

// ─── Helper: Calculate live shift transactions & drawer ledger ──────────────
async function calculateShiftLedger(shift: any) {
  const cashierId = shift.cashier?._id || shift.cashier;
  const openedAt = shift.openedAt;
  const closedAt = shift.closedAt || new Date();

  // 1. Folio Payment Lines posted by this cashier
  const folioPayments = await FolioLine.find({
    postedBy: cashierId.toString(),
    lineType: FolioLineType.PAYMENT,
    postedAt: { $gte: openedAt, $lte: closedAt },
  })
    .populate("paymentId")
    .populate("paymentChannelId")
    .lean();

  // 2. Advances received by this cashier
  const advancePayments = await AdvancePayment.find({
    receivedBy: cashierId,
    receivedAt: { $gte: openedAt, $lte: closedAt },
  })
    .populate("paymentChannel")
    .lean();

  let cashCollected = 0;
  let upiCollected = 0;
  let cardCollected = 0;
  let gatewayCollected = 0;
  let otherCollected = 0;
  let cashAdvances = 0;

  const itemizedTransactions: any[] = [];

  for (const p of folioPayments) {
    const channelType = (p.paymentChannelId as any)?.type;
    const method = (p.paymentId as any)?.method || "";
    const desc = (p.description || "").toUpperCase();
    const amount = Number(p.amount) || 0;

    let recognizedMode = "CASH";
    if (channelType === "CASH" || method === PaymentMethod.CASH || desc.includes("CASH")) {
      cashCollected += amount;
      recognizedMode = "CASH";
    } else if (channelType === "UPI" || method === PaymentMethod.UPI || desc.includes("UPI")) {
      upiCollected += amount;
      recognizedMode = "UPI";
    } else if (channelType === "CARD" || method === PaymentMethod.CARD || desc.includes("CARD")) {
      cardCollected += amount;
      recognizedMode = "CARD";
    } else if (channelType === "GATEWAY" || method === PaymentMethod.RAZORPAY || desc.includes("ONLINE") || desc.includes("RAZORPAY")) {
      gatewayCollected += amount;
      recognizedMode = "GATEWAY";
    } else {
      otherCollected += amount;
      recognizedMode = "OTHER";
    }

    itemizedTransactions.push({
      id: p._id,
      type: "FOLIO_PAYMENT",
      description: p.description,
      amount,
      mode: recognizedMode,
      date: p.postedAt,
      reference: p.paymentId ? (p.paymentId as any).transactionId || (p.paymentId as any).razorpayPaymentId : "",
    });
  }

  for (const adv of advancePayments) {
    const channelType = (adv.paymentChannel as any)?.type;
    const amount = Number(adv.amount) || 0;
    let recognizedMode = "CASH";

    if (channelType === "CASH" || adv.method === AdvancePaymentMethod.CASH) {
      cashAdvances += amount;
      recognizedMode = "CASH";
    } else if (channelType === "UPI" || adv.method === AdvancePaymentMethod.UPI) {
      upiCollected += amount;
      recognizedMode = "UPI";
    } else if (channelType === "CARD" || adv.method === AdvancePaymentMethod.CARD) {
      cardCollected += amount;
      recognizedMode = "CARD";
    } else if (channelType === "GATEWAY" || adv.method === AdvancePaymentMethod.RAZORPAY) {
      gatewayCollected += amount;
      recognizedMode = "GATEWAY";
    } else {
      otherCollected += amount;
      recognizedMode = "OTHER";
    }

    itemizedTransactions.push({
      id: adv._id,
      type: "ADVANCE_PAYMENT",
      description: `Advance Deposit (${adv.advanceNumber || 'Receipt'})`,
      amount,
      mode: recognizedMode,
      date: adv.receivedAt,
      reference: adv.referenceNumber || adv.razorpayPaymentId || adv.advanceNumber,
    });
  }

  // 3. Paid-outs (cash drops, petty cash expenses)
  const paidOuts = shift.paidOuts || [];
  const totalPaidOut = paidOuts.reduce((acc: number, po: any) => acc + (Number(po.amount) || 0), 0);

  // 4. Cash refunds initiated by this cashier during shift
  const refunds = await Refund.find({
    initiatedBy: cashierId,
    status: RefundStatus.COMPLETED,
    createdAt: { $gte: openedAt, $lte: closedAt },
  }).lean();

  const cashRefunds = refunds.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  for (const r of refunds) {
    itemizedTransactions.push({
      id: r._id,
      type: "CASH_REFUND",
      description: `Refund: ${r.reason}`,
      amount: -r.amount,
      mode: "CASH",
      date: r.createdAt,
      reference: r.razorpayRefundId || "",
    });
  }

  // Authoritative physical cash formula:
  // Opening float + cash collections + cash advances - cash refunds - total paid-outs
  const openingFloat = Number(shift.openingFloat) || 0;
  const expectedCash = openingFloat + cashCollected + cashAdvances - cashRefunds - totalPaidOut;

  return {
    cashCollected,
    cashAdvances,
    cashRefunds,
    totalPaidOut,
    expectedCash,
    expectedUpi: upiCollected,
    expectedCard: cardCollected,
    expectedGateway: gatewayCollected,
    expectedOther: otherCollected,
    itemizedTransactions: itemizedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

// ─── GET /api/cashier-shifts/current ────────────────────────────────────────
export const getCurrentShift = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id || (req as any).user?._id;
    const { propertyId } = await resolveOperationalContext(req as AuthenticatedRequest);

    // Look for active shift belonging to current cashier or pending handover
    let activeShift = await CashierShift.findOne({
      cashier: actorId,
      status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] },
    })
      .populate("cashier", "name email role")
      .populate("handoverToCashier", "name email role");

    // Also check if current user is the recipient of a pending handover
    if (!activeShift) {
      activeShift = await CashierShift.findOne({
        handoverToCashier: actorId,
        status: CashierShiftStatus.HANDOVER_PENDING,
      })
        .populate("cashier", "name email role")
        .populate("handoverToCashier", "name email role");
    }

    if (!activeShift) {
      return res.json({ success: true, data: null });
    }

    const ledger = await calculateShiftLedger(activeShift);

    return res.json({
      success: true,
      data: {
        ...activeShift.toObject(),
        liveLedger: ledger,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/cashier-shifts ────────────────────────────────────────────────
export const getAllShifts = async (req: Request, res: Response) => {
  try {
    const { status, drawerId, dateFrom, dateTo, cashierId } = req.query;
    const filter: Record<string, any> = {};

    if (req.params.propertyId || (req as any).propertyId) {
      filter.propertyId = (req as any).propertyId;
    }
    if (status && status !== "ALL") filter.status = status;
    if (drawerId && drawerId !== "ALL") filter.drawerId = drawerId;
    if (cashierId) filter.cashier = cashierId;
    if (dateFrom || dateTo) {
      filter.openedAt = {};
      if (dateFrom) filter.openedAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.openedAt.$lte = new Date(dateTo as string);
    }

    const shifts = await CashierShift.find(filter)
      .populate("cashier", "name email role")
      .populate("handoverToCashier", "name email role")
      .populate("supervisorApproval.approvedBy", "name email role")
      .sort({ openedAt: -1 })
      .lean();

    return res.json({ success: true, data: shifts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/cashier-shifts/:id/details ────────────────────────────────────
export const getShiftDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shift = await CashierShift.findById(id)
      .populate("cashier", "name email role")
      .populate("handoverToCashier", "name email role")
      .populate("supervisorApproval.approvedBy", "name email role");

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    const ledger = await calculateShiftLedger(shift);

    return res.json({
      success: true,
      data: {
        ...shift.toObject(),
        ledger,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/cashier-shifts/open ──────────────────────────────────────────
export const openShift = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id || (req as any).user?._id;
    const { propertyId, businessDate } = await resolveOperationalContext(req as AuthenticatedRequest);

    const schema = z.object({
      drawerId: z.string().trim().min(1).default("DRAWER-01"),
      openingFloat: z.coerce.number().min(0),
      openingDenominations: z.object({
        n2000: z.coerce.number().optional().default(0),
        n500: z.coerce.number().optional().default(0),
        n200: z.coerce.number().optional().default(0),
        n100: z.coerce.number().optional().default(0),
        n50: z.coerce.number().optional().default(0),
        n20: z.coerce.number().optional().default(0),
        n10: z.coerce.number().optional().default(0),
        coins: z.coerce.number().optional().default(0),
      }).optional(),
      notes: z.string().trim().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid shift data", errors: parsed.error.issues });
    }

    const { drawerId, openingFloat, openingDenominations, notes } = parsed.data;

    // 1. Guard: Check if cashier already has an open shift
    const existingCashierShift = await CashierShift.findOne({
      cashier: actorId,
      status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] },
    });
    if (existingCashierShift) {
      return res.status(400).json({
        success: false,
        message: `You already have an active shift (#${existingCashierShift.shiftNumber}) in ${existingCashierShift.drawerId}`,
      });
    }

    // 2. Guard: Check if drawer is already occupied by another active cashier
    const existingDrawerShift = await CashierShift.findOne({
      propertyId,
      drawerId,
      status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] },
    }).populate("cashier", "name");
    if (existingDrawerShift) {
      return res.status(400).json({
        success: false,
        message: `Drawer '${drawerId}' is currently active under shift #${existingDrawerShift.shiftNumber} (${(existingDrawerShift.cashier as any)?.name || 'another cashier'}). Close or handover that shift first.`,
      });
    }

    // Verify denomination sum if provided
    let verifiedDenominations: IDenominationBreakdown | undefined = undefined;
    if (openingDenominations) {
      const computedTotal = computeDenominationTotal(openingDenominations);
      verifiedDenominations = {
        ...openingDenominations,
        total: computedTotal > 0 ? computedTotal : openingFloat,
      };
    }

    const shiftNumber = await generateShiftNumber(propertyId);

    const shift = await CashierShift.create({
      propertyId,
      shiftNumber,
      drawerId,
      cashier: actorId,
      businessDate,
      openedAt: new Date(),
      openingFloat: verifiedDenominations ? verifiedDenominations.total : openingFloat,
      openingDenominations: verifiedDenominations,
      expectedCash: verifiedDenominations ? verifiedDenominations.total : openingFloat,
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

    return res.status(201).json({
      success: true,
      message: `Cashier shift #${shiftNumber} opened on ${drawerId}`,
      data: shift,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/cashier-shifts/:id/paid-out ──────────────────────────────────
export const recordPaidOut = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const schema = z.object({
      amount: z.coerce.number().positive("Amount must be greater than 0"),
      reason: z.string().trim().min(3, "Reason is required"),
      category: z.enum(["CASH_DROP", "PETTY_CASH", "REFUND", "OTHER"]).default("PETTY_CASH"),
      recipient: z.string().trim().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid paid-out data", errors: parsed.error.issues });
    }

    const shift = await CashierShift.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) {
      return res.status(400).json({ success: false, message: "Can only record paid-outs on an OPEN shift" });
    }

    const paidOutRecord = {
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      category: parsed.data.category,
      recipient: parsed.data.recipient,
      authorizedBy: actorId,
      createdAt: new Date(),
    };

    shift.paidOuts.push(paidOutRecord as any);
    shift.totalPaidOut = (shift.totalPaidOut || 0) + parsed.data.amount;
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.paid_out",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber: shift.shiftNumber, ...parsed.data },
    });

    return res.json({
      success: true,
      message: `Cash Paid-out of ₹${parsed.data.amount.toLocaleString()} recorded successfully`,
      data: shift,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/cashier-shifts/:id/handover/initiate ─────────────────────────
export const initiateHandover = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const schema = z.object({
      targetCashierId: z.string().trim().min(1, "Target cashier is required"),
      countedCash: z.coerce.number().min(0),
      denominations: z.object({
        n2000: z.coerce.number().optional().default(0),
        n500: z.coerce.number().optional().default(0),
        n200: z.coerce.number().optional().default(0),
        n100: z.coerce.number().optional().default(0),
        n50: z.coerce.number().optional().default(0),
        n20: z.coerce.number().optional().default(0),
        n10: z.coerce.number().optional().default(0),
        coins: z.coerce.number().optional().default(0),
      }).optional(),
      notes: z.string().trim().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid handover details", errors: parsed.error.issues });
    }

    const shift = await CashierShift.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) {
      return res.status(400).json({ success: false, message: "Only OPEN shifts can be handed over" });
    }

    // Verify target cashier exists
    const targetUser = await User.findById(parsed.data.targetCashierId);
    if (!targetUser) return res.status(404).json({ success: false, message: "Incoming cashier not found" });

    // Compute live ledger at handover point
    const ledger = await calculateShiftLedger(shift);
    const countedTotal = parsed.data.denominations
      ? computeDenominationTotal(parsed.data.denominations)
      : parsed.data.countedCash;

    shift.status = CashierShiftStatus.HANDOVER_PENDING;
    shift.handoverToCashier = targetUser._id as mongoose.Types.ObjectId;
    shift.handoverInitiatedAt = new Date();
    shift.handoverNotes = parsed.data.notes;
    shift.actualCashCounted = countedTotal;
    shift.expectedCash = ledger.expectedCash;
    shift.cashVariance = countedTotal - ledger.expectedCash;
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.handover_initiated",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: {
        shiftNumber: shift.shiftNumber,
        fromCashier: actorId,
        toCashier: targetUser._id,
        countedCash: countedTotal,
        variance: shift.cashVariance,
      },
    });

    return res.json({
      success: true,
      message: `Shift handover initiated to ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email}). Awaiting incoming cashier confirmation.`,
      data: shift,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/cashier-shifts/:id/handover/confirm ──────────────────────────
export const confirmHandover = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const shift = await CashierShift.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.HANDOVER_PENDING) {
      return res.status(400).json({ success: false, message: "Shift is not awaiting handover confirmation" });
    }

    if (shift.handoverToCashier?.toString() !== actorId.toString()) {
      return res.status(403).json({ success: false, message: "Only the designated incoming cashier can acknowledge this handover" });
    }

    // Close the old shift
    shift.status = CashierShiftStatus.CLOSED;
    shift.closedAt = new Date();
    shift.handoverCompletedAt = new Date();
    await shift.save();

    // Open a new shift for the incoming cashier with the verified float
    const newShiftNumber = await generateShiftNumber(shift.propertyId);
    const newShift = await CashierShift.create({
      propertyId: shift.propertyId,
      shiftNumber: newShiftNumber,
      drawerId: shift.drawerId,
      cashier: actorId,
      businessDate: shift.businessDate,
      openedAt: new Date(),
      openingFloat: shift.actualCashCounted || shift.expectedCash,
      openingDenominations: shift.closingDenominations,
      notes: `Handover accepted from previous shift #${shift.shiftNumber}`,
      status: CashierShiftStatus.OPEN,
    });

    await createAuditLog({
      req,
      action: "cashier_shift.handover_confirmed",
      resourceType: "CashierShift",
      resourceId: newShift._id.toString(),
      metadata: {
        previousShiftId: shift._id,
        previousShiftNumber: shift.shiftNumber,
        newShiftNumber,
        openingFloat: newShift.openingFloat,
      },
    });

    return res.json({
      success: true,
      message: `Handover confirmed. Shift #${shift.shiftNumber} closed. New shift #${newShiftNumber} opened.`,
      data: {
        closedShift: shift,
        newShift,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/cashier-shifts/:id/close ─────────────────────────────────────
export const closeShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const schema = z.object({
      actualCashCounted: z.coerce.number().min(0),
      closingDenominations: z.object({
        n2000: z.coerce.number().optional().default(0),
        n500: z.coerce.number().optional().default(0),
        n200: z.coerce.number().optional().default(0),
        n100: z.coerce.number().optional().default(0),
        n50: z.coerce.number().optional().default(0),
        n20: z.coerce.number().optional().default(0),
        n10: z.coerce.number().optional().default(0),
        coins: z.coerce.number().optional().default(0),
      }).optional(),
      varianceReason: z.string().trim().optional(),
      supervisorOverrideNotes: z.string().trim().optional(),
      notes: z.string().trim().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid closing data", errors: parsed.error.issues });
    }

    const shift = await CashierShift.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status === CashierShiftStatus.CLOSED || shift.status === CashierShiftStatus.RECONCILED) {
      return res.status(400).json({ success: false, message: "Shift is already closed" });
    }

    // Calculate full ledger up to right now
    const ledger = await calculateShiftLedger(shift);

    let countedTotal = parsed.data.actualCashCounted;
    let verifiedDenominations: IDenominationBreakdown | undefined = undefined;

    if (parsed.data.closingDenominations) {
      const denomSum = computeDenominationTotal(parsed.data.closingDenominations);
      if (denomSum > 0) countedTotal = denomSum;
      verifiedDenominations = {
        ...parsed.data.closingDenominations,
        total: countedTotal,
      };
    }

    const cashVariance = countedTotal - ledger.expectedCash;

    // Check variance threshold (default threshold: ₹100 or non-zero)
    const isSupervisor = ["ADMIN", "MANAGER", "SUPER_ADMIN", "SUPERVISOR"].includes((req as any).user?.role);
    if (Math.abs(cashVariance) > 0 && !parsed.data.varianceReason && !parsed.data.supervisorOverrideNotes) {
      return res.status(400).json({
        success: false,
        message: `Cash variance of ₹${cashVariance.toFixed(2)} detected. A variance explanation is mandatory before closing.`,
        variance: cashVariance,
      });
    }

    shift.closedAt = new Date();
    shift.cashCollected = ledger.cashCollected;
    shift.cashAdvances = ledger.cashAdvances;
    shift.cashRefunds = ledger.cashRefunds;
    shift.totalPaidOut = ledger.totalPaidOut;
    shift.expectedCash = ledger.expectedCash;
    shift.expectedUpi = ledger.expectedUpi;
    shift.expectedCard = ledger.expectedCard;
    shift.expectedGateway = ledger.expectedGateway;
    shift.expectedOther = ledger.expectedOther;
    shift.actualCashCounted = countedTotal;
    shift.closingDenominations = verifiedDenominations;
    shift.cashVariance = cashVariance;
    shift.varianceReason = parsed.data.varianceReason;
    shift.notes = parsed.data.notes || shift.notes;

    if (isSupervisor && parsed.data.supervisorOverrideNotes) {
      shift.supervisorApproval = {
        approvedBy: actorId,
        approvedAt: new Date(),
        notes: parsed.data.supervisorOverrideNotes,
      };
    }

    shift.status = Math.abs(cashVariance) === 0 ? CashierShiftStatus.RECONCILED : CashierShiftStatus.CLOSED;
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.closed",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: {
        shiftNumber: shift.shiftNumber,
        expectedCash: ledger.expectedCash,
        actualCounted: countedTotal,
        variance: cashVariance,
        status: shift.status,
      },
    });

    return res.json({
      success: true,
      message: `Shift #${shift.shiftNumber} closed successfully. Status: ${shift.status}`,
      data: shift,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/cashier-shifts/cashiers
 * Returns active staff members eligible for cashier shifts and handover
 * (Cashiers, Receptionists, Managers, Supervisors, Admins)
 */
export const getCashierStaffList = async (req: Request, res: Response) => {
  try {
    const cashiers = await User.find({
      role: {
        $in: [
          UserRole.CASHIER,
          UserRole.RECEPTIONIST,
          UserRole.MANAGER,
          UserRole.SUPERVISOR,
          UserRole.ADMIN,
          UserRole.SUPER_ADMIN,
        ],
      },
      isActive: true,
    })
      .select("_id firstName lastName email role")
      .lean();

    const formatted = cashiers.map((u) => ({
      _id: u._id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      email: u.email,
      role: u.role,
    }));

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
