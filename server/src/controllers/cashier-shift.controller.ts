import { Request, Response } from "express";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment, AdvancePaymentMethod } from "../models/AdvancePayment";
import { PaymentMethod } from "../models/Payment";
import { createAuditLog } from "../services/audit.service";

/**
 * GET /api/cashier-shifts/current
 */
export const getCurrentShift = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id || (req as any).user?._id;
    const activeShift = await CashierShift.findOne({
      cashier: actorId,
      status: CashierShiftStatus.OPEN,
    }).populate("cashier", "name email role");

    return res.json({
      success: true,
      data: activeShift || null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/cashier-shifts
 */
export const getAllShifts = async (_req: Request, res: Response) => {
  try {
    const shifts = await CashierShift.find()
      .populate("cashier", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: shifts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/cashier-shifts/open
 */
export const openShift = async (req: Request, res: Response) => {
  try {
    const { openingFloat, notes } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const existingOpen = await CashierShift.findOne({
      cashier: actorId,
      status: CashierShiftStatus.OPEN,
    });

    if (existingOpen) {
      return res.status(400).json({
        success: false,
        message: `You already have an open shift (#${existingOpen.shiftNumber})`,
      });
    }

    const shiftNumber = `SHIFT-${Date.now()}`;
    const shift = await CashierShift.create({
      shiftNumber,
      cashier: actorId,
      openingFloat: Number(openingFloat) || 0,
      openedAt: new Date(),
      status: CashierShiftStatus.OPEN,
      notes,
    });

    await createAuditLog({
      req,
      action: "cashier_shift.opened",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { shiftNumber, openingFloat },
    });

    return res.json({
      success: true,
      message: `Cashier shift #${shiftNumber} opened`,
      data: shift,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/cashier-shifts/:id/close
 */
export const closeShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actualCashCounted, notes } = req.body;

    const shift = await CashierShift.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (shift.status !== CashierShiftStatus.OPEN) {
      return res.status(400).json({ success: false, message: "Shift is already closed" });
    }

    // Calculate payments and advances received during shift period by this cashier
    const paymentLines = await FolioLine.find({
      postedBy: shift.cashier.toString(),
      lineType: FolioLineType.PAYMENT,
      postedAt: { $gte: shift.openedAt },
    }).populate("paymentId").lean();

    const advancePayments = await AdvancePayment.find({
      receivedBy: shift.cashier,
      receivedAt: { $gte: shift.openedAt },
    }).lean();

    let cashCollected = 0;
    let upiCollected = 0;
    let cardCollected = 0;

    for (const p of paymentLines) {
      const method = (p.paymentId as any)?.method || "";
      const desc = (p.description || "").toUpperCase();
      if (method === PaymentMethod.CASH || desc.includes("CASH")) {
        cashCollected += p.amount;
      } else if (method === PaymentMethod.UPI || desc.includes("UPI")) {
        upiCollected += p.amount;
      } else if (method === PaymentMethod.CARD || method === PaymentMethod.RAZORPAY || desc.includes("CARD") || desc.includes("ONLINE")) {
        cardCollected += p.amount;
      } else {
        // Default physical cash if unspecified at counter
        cashCollected += p.amount;
      }
    }

    for (const adv of advancePayments) {
      if (adv.method === AdvancePaymentMethod.CASH) {
        cashCollected += adv.amount;
      } else if (adv.method === AdvancePaymentMethod.UPI) {
        upiCollected += adv.amount;
      } else if (adv.method === AdvancePaymentMethod.CARD || adv.method === AdvancePaymentMethod.RAZORPAY) {
        cardCollected += adv.amount;
      }
    }

    const expectedCash = shift.openingFloat + cashCollected;
    const counted = Number(actualCashCounted) || 0;
    const cashVariance = counted - expectedCash;

    shift.closedAt = new Date();
    shift.expectedCash = expectedCash;
    shift.expectedUpi = upiCollected;
    shift.expectedCard = cardCollected;
    shift.actualCashCounted = counted;
    shift.cashVariance = cashVariance;
    shift.status = CashierShiftStatus.CLOSED;
    if (notes) shift.notes = notes;
    await shift.save();

    await createAuditLog({
      req,
      action: "cashier_shift.closed",
      resourceType: "CashierShift",
      resourceId: shift._id.toString(),
      metadata: { expectedCash, expectedUpi: upiCollected, expectedCard: cardCollected, counted, cashVariance },
    });

    return res.json({
      success: true,
      message: `Shift #${shift.shiftNumber} closed. Cash variance: ₹${cashVariance}`,
      data: shift,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
