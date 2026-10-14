import { queueForVerification } from "../services/reception-verification";
import { VerificationType } from "../models/VerificationRequest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { Booking, PaymentStatus } from "../models/Booking";
import {
  createFolio,
  postCharge,
  finalizeFolio,
  settleFolio,
  recomputeFolioBalance,
  findFolioForBooking,
  reverseFolioLine,
} from "../services/folio.service";
import { computeChargeTax, computeRoomTax, loadGstRules, taxCategoryForLine } from "../services/tax.service";
import { nights as countNights } from "../../../shared/dates";

/**
 * GET /api/folios/booking/:bookingId
 * Returns the full folio and all lines for a given booking, supporting group aggregations.
 */
/**
 * Adds paymentMode / paymentReference to money lines for printing: from the linked Payment
 * (method, transaction id), the linked advance (method, receipt no., reference), or the
 * payment channel. Lines with no linked record keep paymentMode undefined (never guessed).
 */
async function attachPaymentModes(lines: any[]) {
  const ids = (k: string) => [...new Set(lines.map((l) => l[k]).filter(Boolean).map(String))];
  const { Payment } = await import("../models/Payment");
  const { AdvancePayment } = await import("../models/AdvancePayment");
  const { PaymentChannel } = await import("../models/PaymentChannel");
  const [payments, advances, channels] = await Promise.all([
    Payment.find({ _id: { $in: ids("paymentId") } }).select("method transactionId").lean(),
    AdvancePayment.find({ _id: { $in: ids("advancePaymentId") } }).select("method advanceNumber referenceNumber").lean(),
    (PaymentChannel as any).find({ _id: { $in: ids("paymentChannelId") } }).select("name type").lean(),
  ]);
  const byId = (rows: any[]) => new Map(rows.map((r) => [String(r._id), r]));
  const p = byId(payments), a = byId(advances), c = byId(channels);
  for (const l of lines) {
    const pay = l.paymentId ? p.get(String(l.paymentId)) : undefined;
    const adv = l.advancePaymentId ? a.get(String(l.advancePaymentId)) : undefined;
    const ch = l.paymentChannelId ? c.get(String(l.paymentChannelId)) : undefined;
    l.paymentMode = pay?.method ?? adv?.method ?? ch?.type ?? ch?.name;
    l.paymentReference = pay?.transactionId ?? adv?.referenceNumber ?? adv?.advanceNumber;
  }
}

export const getFolioByBooking = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookingId as string)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(bookingId).populate("assignedRoom").populate("roomCategory");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const actorId = (req as any).user?.id || (req as any).user?._id || "SYSTEM";

    // Customer (owner) access is read-only and scoped to this one booking: no
    // folio seeding, and no group aggregation (group detection matches other
    // guests' bookings by phone number).
    if ((req as any).ownerAccess) {
      const ownFolio = await Folio.findOne({ booking: booking._id })
        .populate("room", "roomNumber floor")
        .lean();
      if (!ownFolio) {
        return res.status(404).json({ success: false, message: "Folio not available yet for this booking" });
      }
      const ownLines = await FolioLine.find({ folio: ownFolio._id }).sort({ date: 1, postedAt: 1 }).lean();
      await attachPaymentModes(ownLines);
      return res.json({
        success: true,
        data: {
          folio: ownFolio,
          lines: ownLines,
          groupFolios: [ownFolio],
          groupBookings: [],
          isGroup: false,
          roomsSummary: (booking.assignedRoom as any)?.roomNumber || "",
        },
      });
    }

    // 1. Read-only: a folio is opened by check-in (or another explicit action), never by a read.
    const targetFolio: any = await findFolioForBooking(booking._id);
    if (!targetFolio) {
      return res.status(404).json({ success: false, message: "No folio yet for this booking: a folio is opened at check-in" });
    }

    // 2. Discover if this booking is part of a group / multi-room reservation
    const BookingModel = mongoose.model("Booking");
    let groupBookings: any[] = [];
    if (booking.groupId) {
      groupBookings = await BookingModel.find({ groupId: booking.groupId })
        .populate("assignedRoom", "roomNumber floor")
        .populate("roomCategory", "name slug");
    } else if (booking.guestDetails?.phone) {
      const matching = await BookingModel.find({
        "guestDetails.phone": booking.guestDetails.phone,
        status: { $in: ["CONFIRMED", "CHECKED_IN"] },
        checkInDate: booking.checkInDate,
      })
        .populate("assignedRoom", "roomNumber floor")
        .populate("roomCategory", "name slug");
      if (matching.length > 1) {
        groupBookings = matching;
      }
    }

    // 3. Collect the existing folios of every booking in the group (read-only)
    const allGroupFolios: any[] = [];
    if (groupBookings.length > 1) {
      for (const gb of groupBookings) {
        const gf = await findFolioForBooking(gb._id);
        if (gf) allGroupFolios.push(gf);
      }
    } else {
      allGroupFolios.push(targetFolio);
    }

    // 4. Decide whether to return group view or single room view
    // If req.query.group is explicitly 'false' or req.query.single === 'true', return single
    // Otherwise, if it's a multi-room booking and group=true (or default for print), return aggregated group
    const isGroupRequested = req.query.group === 'true' || (groupBookings.length > 1 && req.query.single !== 'true');

    let lines: any[] = [];
    let activeFolio = targetFolio;

    if (isGroupRequested && groupBookings.length > 1) {
      const folioIds = allGroupFolios.map(f => f._id);
      lines = await FolioLine.find({ folio: { $in: folioIds } })
        .sort({ date: 1, postedAt: 1 })
        .populate({
          path: 'booking',
          select: 'assignedRoom billNumber bookingReference roomCategory ratePerNight',
          populate: [
            { path: 'assignedRoom', select: 'roomNumber floor' },
            { path: 'roomCategory', select: 'name' }
          ]
        })
        .populate({
          path: 'folio',
          select: 'room status totalCharges totalTax balance',
          populate: { path: 'room', select: 'roomNumber' }
        })
        .lean();

      // Aggregate totals across all group folios
      const combinedCharges = allGroupFolios.reduce((s, f) => s + (f.totalCharges || 0), 0);
      const combinedTax = allGroupFolios.reduce((s, f) => s + (f.totalTax || 0), 0);
      const combinedCgst = allGroupFolios.reduce((s, f) => s + (f.cgst || 0), 0);
      const combinedSgst = allGroupFolios.reduce((s, f) => s + (f.sgst || 0), 0);
      const combinedDiscounts = allGroupFolios.reduce((s, f) => s + (f.totalDiscounts || 0), 0);
      const combinedPaid = allGroupFolios.reduce((s, f) => s + (f.totalPaid || 0), 0);
      const combinedAdvance = allGroupFolios.reduce((s, f) => s + (f.totalAdvanceAdjusted || 0), 0);
      const combinedBalance = allGroupFolios.reduce((s, f) => s + (f.balance || 0), 0);

      activeFolio = {
        ...targetFolio.toObject(),
        totalCharges: combinedCharges,
        totalTax: combinedTax,
        cgst: combinedCgst,
        sgst: combinedSgst,
        totalDiscounts: combinedDiscounts,
        totalPaid: combinedPaid,
        totalAdvanceAdjusted: combinedAdvance,
        balance: combinedBalance,
      };
    } else {
      lines = await FolioLine.find({ folio: targetFolio._id })
        .sort({ date: 1, postedAt: 1 })
        .populate({
          path: 'booking',
          select: 'assignedRoom billNumber bookingReference roomCategory ratePerNight',
          populate: [
            { path: 'assignedRoom', select: 'roomNumber floor' },
            { path: 'roomCategory', select: 'name' }
          ]
        })
        .populate({
          path: 'folio',
          select: 'room status totalCharges totalTax balance',
          populate: { path: 'room', select: 'roomNumber' }
        })
        .lean();
    }

    await attachPaymentModes(lines);
    const roomsList = groupBookings.map((b: any) => b.assignedRoom?.roomNumber).filter(Boolean);

    return res.json({
      success: true,
      data: {
        folio: activeFolio,
        lines,
        groupFolios: allGroupFolios,
        groupBookings: groupBookings.map((b: any) => ({
          _id: b._id,
          bookingReference: b.bookingReference,
          billNumber: b.billNumber,
          roomNumber: b.assignedRoom?.roomNumber,
          categoryName: b.roomCategory?.name,
          ratePerNight: b.ratePerNight,
          totalAmount: b.totalAmount,
        })),
        isGroup: groupBookings.length > 1,
        roomsSummary: roomsList.length > 0 ? roomsList.join(", ") : (booking.assignedRoom as any)?.roomNumber || "",
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
    // Money and ledger-control lines have their own endpoints (payments, advances, refunds,
    // void-by-reversal); taxes come from applyTax. They can never be typed in as a charge.
    const MONEY_OR_CONTROL = new Set<string>([FolioLineType.PAYMENT, FolioLineType.ADVANCE_ADJUSTMENT, FolioLineType.REFUND, FolioLineType.REVERSAL, FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST]);
    if (!Object.values(FolioLineType).includes(lineType) || MONEY_OR_CONTROL.has(lineType)) {
      return res.status(400).json({ success: false, message: `${lineType} cannot be posted as a charge; use Record Payment, Apply Advance, Refund or Void` });
    }
    const isConcession = lineType === FolioLineType.DISCOUNT || lineType === FolioLineType.COMPLIMENTARY;
    if (isConcession) {
      const { PermissionService } = await import("../services/PermissionService");
      if (!(await PermissionService.can((req as any).user, "CAP.EDIT_TARIFF"))) {
        return res.status(403).json({ success: false, message: "Discounts and complimentary credits are set by the front desk" });
      }
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

    if (isConcession && numAmount > 0) {
      await queueForVerification({
        type: VerificationType.TARIFF_BELOW_DEFAULT,
        subjectKey: `folioLine:${line._id}:concession`,
        returnQueue: "FRONT_DESK",
        summary: `${lineType === FolioLineType.DISCOUNT ? "Discount" : "Complimentary"} ₹${numAmount.toLocaleString("en-IN")}: ${description}`,
        amount: numAmount,
        bookingId: folio.booking,
        folioId: folio._id,
        details: { lineType, description, notes },
        note: notes || description,
        req,
      });
    }

    // 2. Optional automatic CGST / SGST split calculation for taxable charges
    // GST by supply category of the line (taxService): room, food or service.
    if (applyTax && taxCategoryForLine(lineType)) {
      const tax = computeChargeTax(await loadGstRules(), lineType, numAmount, new Date())!;
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

/**
 * PUT /api/folios/booking/:bookingId/bill-edit
 * Allows staff/admin to edit billing particulars anytime:
 * - room rate/tariff
 * - extra bed / extra charges
 * - discount
 * - advance / payments
 * - taxes
 */
export const updateBookingBill = async (req: Request, res: Response) => {
  // Changes the agreed tariff of a stay. The ledger is never rewritten: the existing room,
  // extra-bed, other-charge, room-tax and discount lines are reversed and the new ones posted.
  // Payments, advances, refunds and other charges are untouched (money is recorded through the
  // payment/advance endpoints, never typed into a bill). A rate below the room's default rate,
  // or a discount, is queued for Reception verification.
  try {
    const { bookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookingId as string)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }
    const { PermissionService } = await import("../services/PermissionService");
    if (!(await PermissionService.can((req as any).user, "CAP.EDIT_TARIFF"))) {
      return res.status(403).json({ success: false, message: "Tariffs are set by the front desk" });
    }
    const { ratePerNight, extraBedAmount, otherCharges, otherChargesDesc, discountAmount, applyTax = true, reason } = req.body ?? {};
    const booking: any = await Booking.findById(bookingId).populate("roomCategory", "basePrice name");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    const folio: any = await Folio.findOne({ booking: bookingId, status: FolioStatus.OPEN });
    if (!folio) return res.status(409).json({ success: false, message: "There is no open folio for this booking (it opens at check-in)" });

    const actorId = String((req as any).user?.id || (req as any).user?._id || "STAFF");
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(1, countNights(checkIn, checkOut));
    const newRate = Number(ratePerNight !== undefined && ratePerNight !== "" ? ratePerNight : booking.ratePerNight || 0);
    const newExtraBed = Math.max(0, Number(extraBedAmount || 0));
    const newOther = Math.max(0, Number(otherCharges || 0));
    const newDiscount = Math.max(0, Number(discountAmount || 0));
    if (!(newRate >= 0) || [newExtraBed, newOther, newDiscount].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ success: false, message: "Enter valid amounts" });
    }
    const editNote = typeof reason === "string" && reason.trim() ? reason.trim() : "Tariff updated at the front desk";

    const REPLACED = new Set<string>([FolioLineType.ROOM_CHARGE, FolioLineType.EXTRA_BED, FolioLineType.ADDON, FolioLineType.DISCOUNT, FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST]);
    const isRoomTax = (l: any) => !/KOT|Restaurant|POS/i.test(String(l.description ?? ""));
    const session = await mongoose.startSession();
    let totals: any;
    try {
      await session.withTransaction(async () => {
        const lines = await FolioLine.find({ folio: folio._id }).session(session).lean();
        const reversed = new Set(lines.filter((l: any) => l.reversedLineId).map((l: any) => String(l.reversedLineId)));
        for (const l of lines as any[]) {
          if (l.lineType === FolioLineType.REVERSAL || reversed.has(String(l._id)) || !REPLACED.has(l.lineType)) continue;
          if (String(l.lineType).startsWith("TAX_") && !isRoomTax(l)) continue;
          await reverseFolioLine(String(folio._id), String(l._id), editNote, { req, session, postedBy: actorId });
        }
        const post = (lineType: FolioLineType, description: string, amount: number) =>
          amount > 0 ? postCharge({ folioId: String(folio._id), bookingId: String(booking._id), lineType, description, amount, date: checkIn, postedBy: actorId, notes: editNote }, { req, session }) : null;
        await post(FolioLineType.ROOM_CHARGE, `Room Tariff (${nights} Night${nights > 1 ? "s" : ""} @ ₹${newRate.toLocaleString("en-IN")}/night)`, newRate * nights);
        await post(FolioLineType.EXTRA_BED, "Extra Bed / Person Charges", newExtraBed);
        await post(FolioLineType.ADDON, otherChargesDesc || "Other Charges", newOther);
        await post(FolioLineType.DISCOUNT, "Discount / Price Concession", newDiscount);
        let tax = { tax: 0, cgst: 0, sgst: 0 };
        if (applyTax) {
          const taxable = Math.max(0, newRate * nights + newExtraBed + newOther - newDiscount);
          tax = computeRoomTax(await loadGstRules(), { checkIn, checkOut, nightlyValue: taxable / nights });
          await post(FolioLineType.TAX_CGST, "CGST on Room Tariff", tax.cgst);
          await post(FolioLineType.TAX_SGST, "SGST on Room Tariff", tax.sgst);
        }
        totals = await recomputeFolioBalance(String(folio._id), { session });
        booking.ratePerNight = newRate;
        booking.taxAmount = tax.tax;
        booking.cgstAmount = tax.cgst;
        booking.sgstAmount = tax.sgst;
        booking.discountAmount = newDiscount;
        booking.totalAmount = Math.round((newRate * nights + newExtraBed + newOther - newDiscount + tax.tax) * 100) / 100;
        await booking.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const defaultRate = Number(booking.roomCategory?.basePrice ?? 0);
    if ((defaultRate > 0 && newRate < defaultRate) || newDiscount > 0) {
      await queueForVerification({
        type: VerificationType.TARIFF_BELOW_DEFAULT,
        subjectKey: `billEdit:${booking._id}:${Date.now()}`,
        returnQueue: "FRONT_DESK",
        summary: `Bill edited: ₹${newRate}/night (default ₹${defaultRate})${newDiscount > 0 ? `, discount ₹${newDiscount}` : ""}`,
        amount: Math.max(0, (defaultRate - newRate) * nights) + newDiscount,
        bookingId: booking._id,
        folioId: folio._id,
        details: { rate: newRate, defaultRate, nights, discount: newDiscount, reason: editNote },
        note: editNote,
        req,
      });
    }

    const updatedFolio = await Folio.findById(folio._id).lean();
    const lines = await FolioLine.find({ folio: folio._id }).sort({ date: 1, postedAt: 1 }).lean();
    return res.json({ success: true, message: "Tariff updated; earlier lines reversed, new lines posted", data: { booking, folio: updatedFolio, lines, balance: totals?.balance } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/folios/:folioId/lines/:lineId
 * Lines are never deleted: this posts a REVERSAL that voids the line (reason required),
 * keeping the original for the audit trail.
 */
export const deleteFolioLine = async (req: Request, res: Response) => {
  try {
    const { folioId, lineId } = req.params as { folioId: string; lineId: string };
    const reason = String((req.body as any)?.reason ?? (req.query as any)?.reason ?? "").trim();
    if (reason.length < 3) {
      return res.status(400).json({ success: false, message: "A reason is required to void a folio line" });
    }
    const actor = (req as any).user?.id ?? (req as any).user?._id;
    const voided = await FolioLine.findById(lineId).lean();
    await reverseFolioLine(folioId, lineId, reason, { req, postedBy: actor ? String(actor) : "STAFF" });
    const folio = await Folio.findById(folioId).lean();
    await queueForVerification({
      type: VerificationType.FOLIO_VOID,
      subjectKey: `folioLine:${lineId}:void`,
      returnQueue: "CASHIER",
      summary: `Voided "${voided?.description ?? "folio line"}" ₹${Number(voided?.amount ?? 0).toLocaleString("en-IN")}`,
      amount: Number(voided?.amount ?? 0),
      bookingId: folio?.booking,
      folioId,
      details: { lineType: voided?.lineType, description: voided?.description, reason },
      note: reason,
      req,
    });
    const lines = await FolioLine.find({ folio: folioId }).sort({ date: 1, postedAt: 1 }).lean();
    return res.json({ success: true, message: "Line voided by reversal", data: { folio, lines } });
  } catch (error: any) {
    const known = /not found|already been reversed|cannot itself be reversed|Cannot post to/.test(error.message);
    return res.status(known ? 400 : 500).json({ success: false, message: error.message });
  }
};
