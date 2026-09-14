import { Request, Response } from "express";
import mongoose from "mongoose";
import { Folio } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import {
  postCharge,
  finalizeFolio,
  settleFolio,
  recomputeFolioBalance,
  calculateTaxBreakdown,
} from "../services/folio.service";

/**
 * GET /api/folios/booking/:bookingId
 * Returns the full folio and all lines for a given booking.
 */
export const getFolioByBooking = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookingId as string)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const folio = await Folio.findOne({ booking: bookingId })
      .populate("guest", "firstName lastName email phone")
      .populate("room", "roomNumber floor");

    if (!folio) {
      return res.status(404).json({ success: false, message: "No folio found for this booking" });
    }

    const lines = await FolioLine.find({ folio: folio._id })
      .populate("postedBy", "name email role")
      .sort({ date: 1, postedAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: {
        folio,
        lines,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/folios/:folioId/charges
 * Posts a charge or credit line to an open folio.
 */
export const postFolioCharge = async (req: Request, res: Response) => {
  try {
    const { folioId } = req.params;
    const { lineType, description, amount, quantity, unitPrice, notes, applyTax } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    if (!mongoose.Types.ObjectId.isValid(folioId as string)) {
      return res.status(400).json({ success: false, message: "Invalid folio ID" });
    }

    const folio = await Folio.findById(folioId);
    if (!folio) return res.status(404).json({ success: false, message: "Folio not found" });

    if (!lineType || !description || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: "lineType, description, and amount are required",
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ success: false, message: "Amount must be a non-negative number" });
    }

    // 1. Post the main charge line
    const { line, folio: updatedFolio } = await postCharge(
      {
        folioId: folio._id.toString(),
        bookingId: folio.booking.toString(),
        lineType: lineType as FolioLineType,
        description,
        amount: numAmount,
        quantity: quantity ? Number(quantity) : 1,
        unitPrice: unitPrice ? Number(unitPrice) : numAmount,
        date: new Date(),
        postedBy: actorId?.toString() || "SYSTEM",
        notes,
      },
      { req }
    );

    // 2. Optional automatic CGST / SGST split calculation for taxable charges
    if (applyTax && (lineType === FolioLineType.ROOM_CHARGE || lineType === FolioLineType.RESTAURANT || lineType === FolioLineType.ADDON || lineType === FolioLineType.LAUNDRY || lineType === FolioLineType.MINIBAR)) {
      const tax = await calculateTaxBreakdown(numAmount);
      if (tax.cgst > 0) {
        await postCharge(
          {
            folioId: folio._id.toString(),
            bookingId: folio.booking.toString(),
            lineType: FolioLineType.TAX_CGST,
            description: `CGST (9%) on ${description}`,
            amount: tax.cgst,
            date: new Date(),
            postedBy: actorId?.toString() || "SYSTEM",
          },
          { req }
        );
      }
      if (tax.sgst > 0) {
        await postCharge(
          {
            folioId: folio._id.toString(),
            bookingId: folio.booking.toString(),
            lineType: FolioLineType.TAX_SGST,
            description: `SGST (9%) on ${description}`,
            amount: tax.sgst,
            date: new Date(),
            postedBy: actorId?.toString() || "SYSTEM",
          },
          { req }
        );
      }
    }

    const recomputed = await Folio.findById(folioId);

    return res.json({
      success: true,
      message: "Charge posted successfully to folio",
      data: {
        line,
        folio: recomputed,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/folios/:folioId/reconcile
 * Audit endpoint to recompute and correct running totals on a folio.
 */
export const reconcileFolio = async (req: Request, res: Response) => {
  try {
    const { folioId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(folioId as string)) {
      return res.status(400).json({ success: false, message: "Invalid folio ID" });
    }

    const folio = await Folio.findById(folioId);
    if (!folio) return res.status(404).json({ success: false, message: "Folio not found" });

    const auditTotals = await recomputeFolioBalance(folioId as string);

    folio.totalCharges = auditTotals.totalCharges;
    folio.totalTax = auditTotals.totalTax;
    folio.cgst = auditTotals.cgst;
    folio.sgst = auditTotals.sgst;
    folio.igst = auditTotals.igst;
    folio.totalDiscounts = auditTotals.totalDiscounts;
    folio.totalPaid = auditTotals.totalPaid;
    folio.totalAdvanceAdjusted = auditTotals.totalAdvanceAdjusted;
    folio.balance = auditTotals.balance;
    await folio.save();

    return res.json({
      success: true,
      message: "Folio balance reconciled with line item ledger",
      data: folio,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/folios/:folioId/finalize
 */
export const finalizeFolioHandler = async (req: Request, res: Response) => {
  try {
    const { folioId } = req.params;
    const folio = await finalizeFolio(folioId as string, { req });
    return res.json({ success: true, message: "Folio finalized for checkout", data: folio });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/folios/:folioId/settle
 */
export const settleFolioHandler = async (req: Request, res: Response) => {
  try {
    const { folioId } = req.params;
    const actorId = (req as any).user?.id || (req as any).user?._id;
    const folio = await settleFolio(folioId as string, { req, closedBy: actorId?.toString() || "SYSTEM" });
    return res.json({ success: true, message: `Folio settled — Invoice ${folio.invoiceNumber} generated`, data: folio });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
