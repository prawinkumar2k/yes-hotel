import { Request, Response } from "express";
import mongoose from "mongoose";
import { Folio } from "../models/Folio";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { Booking, PaymentStatus } from "../models/Booking";
import {
  createFolio,
  postCharge,
  finalizeFolio,
  settleFolio,
  recomputeFolioBalance,
  calculateTaxBreakdown,
  findFolioForBooking,
} from "../services/folio.service";

/**
 * GET /api/folios/booking/:bookingId
 * Returns the full folio and all lines for a given booking, supporting group aggregations.
 */
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
  try {
    const { bookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookingId as string)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const {
      ratePerNight,
      extraBedAmount,
      otherCharges,
      otherChargesDesc,
      discountAmount,
      paidAmount,
      applyTax = true,
      customLines = [],
    } = req.body;

    const booking = await Booking.findById(bookingId).populate("assignedRoom");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    let folio: any = await Folio.findOne({ booking: bookingId });
    if (!folio) {
      const actorId = (req as any).user?.id || (req as any).user?._id || "SYSTEM";
      const guestId = booking.customer?.toString() || new mongoose.Types.ObjectId().toString();
      folio = await createFolio(
        {
          bookingId: booking._id.toString(),
          guestId,
          roomId: (booking.assignedRoom as any)?._id?.toString() || (booking.assignedRoom as any)?.toString(),
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
        },
        { req }
      );
    }

    const actorId = (req as any).user?.id || (req as any).user?._id || "SYSTEM";
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    const newRatePerNight = Number(ratePerNight !== undefined ? ratePerNight : (booking.ratePerNight || 0));
    const newRoomTotal = newRatePerNight * nights;
    const newExtraBed = Number(extraBedAmount || 0);
    const newOtherCharges = Number(otherCharges || 0);
    const newDiscount = Number(discountAmount || 0);
    const newPaidAmount = Number(paidAmount !== undefined ? paidAmount : (booking.paidAmount || 0));

    // Calculate Tax
    const taxableSubtotal = Math.max(0, newRoomTotal + newExtraBed + newOtherCharges - newDiscount);
    let totalTax = 0;
    let cgst = 0;
    let sgst = 0;

    if (applyTax) {
      const taxCalc = await calculateTaxBreakdown(taxableSubtotal);
      cgst = taxCalc.cgst;
      sgst = taxCalc.sgst;
      totalTax = taxCalc.totalTax;
    }

    const totalBillAmount = taxableSubtotal + totalTax;

    // Update Booking fields
    booking.ratePerNight = newRatePerNight;
    booking.totalAmount = totalBillAmount;
    booking.taxAmount = totalTax;
    booking.cgstAmount = cgst;
    booking.sgstAmount = sgst;
    booking.discountAmount = newDiscount;
    booking.paidAmount = newPaidAmount;
    booking.paymentStatus = (totalBillAmount - newPaidAmount) <= 0 ? PaymentStatus.PAID : (newPaidAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID);
    await booking.save();

    // Re-build Folio Lines ledger atomically
    await FolioLine.deleteMany({ folio: folio._id });

    // 1. Room Charge
    if (newRoomTotal > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.ROOM_CHARGE,
        direction: FolioLineDirection.DEBIT,
        description: `Room Tariff (${nights} Night${nights > 1 ? 's' : ''} @ ₹${newRatePerNight.toLocaleString()}/night)`,
        amount: newRoomTotal,
        date: checkIn,
        postedBy: actorId,
      });
    }

    // 2. Extra Bed / Person
    if (newExtraBed > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.EXTRA_BED,
        direction: FolioLineDirection.DEBIT,
        description: `Extra Bed / Person Charges`,
        amount: newExtraBed,
        date: checkIn,
        postedBy: actorId,
      });
    }

    // 3. Other Charges
    if (newOtherCharges > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.ADDON,
        direction: FolioLineDirection.DEBIT,
        description: otherChargesDesc || "Ancillary & Service Charges",
        amount: newOtherCharges,
        date: checkIn,
        postedBy: actorId,
      });
    }

    // 4. Taxes
    if (cgst > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.TAX_CGST,
        direction: FolioLineDirection.DEBIT,
        description: `CGST (6%) Tax`,
        amount: cgst,
        date: checkIn,
        postedBy: actorId,
      });
    }
    if (sgst > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.TAX_SGST,
        direction: FolioLineDirection.DEBIT,
        description: `SGST (6%) Tax`,
        amount: sgst,
        date: checkIn,
        postedBy: actorId,
      });
    }

    // 5. Discount
    if (newDiscount > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.DISCOUNT,
        direction: FolioLineDirection.CREDIT,
        description: `Discount / Price Concession`,
        amount: newDiscount,
        date: checkIn,
        postedBy: actorId,
      });
    }

    // 6. Advance / Payment Received
    if (newPaidAmount > 0) {
      await FolioLine.create({
        folio: folio._id,
        booking: booking._id,
        lineType: FolioLineType.ADVANCE_ADJUSTMENT,
        direction: FolioLineDirection.CREDIT,
        description: `Advance Payment Received (${(booking as any).billingInstruction || "CASH"})`,
        amount: newPaidAmount,
        date: new Date(),
        postedBy: actorId,
      });
    }

    // 7. Custom Lines
    if (Array.isArray(customLines) && customLines.length > 0) {
      for (const cl of customLines) {
        if (cl && cl.description && Number(cl.amount) > 0) {
          const isCredit = cl.direction === "CREDIT" || cl.lineType === "PAYMENT" || cl.lineType === "DISCOUNT";
          await FolioLine.create({
            folio: folio._id,
            booking: booking._id,
            lineType: cl.lineType || FolioLineType.ADDON,
            direction: isCredit ? FolioLineDirection.CREDIT : FolioLineDirection.DEBIT,
            description: cl.description,
            amount: Number(cl.amount),
            date: cl.date ? new Date(cl.date) : new Date(),
            postedBy: actorId,
          });
        }
      }
    }

    // Recompute Folio
    const totals = await recomputeFolioBalance(folio._id.toString());
    folio.totalCharges = totals.totalCharges;
    folio.totalTax = totals.totalTax;
    folio.cgst = totals.cgst;
    folio.sgst = totals.sgst;
    folio.igst = totals.igst;
    folio.totalDiscounts = totals.totalDiscounts;
    folio.totalPaid = totals.totalPaid;
    folio.totalAdvanceAdjusted = totals.totalAdvanceAdjusted;
    folio.balance = totals.balance;
    await folio.save();

    const lines = await FolioLine.find({ folio: folio._id }).sort({ date: 1, postedAt: 1 }).lean();

    return res.json({
      success: true,
      message: "Bill updated and ledger reconciled successfully",
      data: {
        booking,
        folio,
        lines,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/folios/:folioId/lines/:lineId
 */
export const deleteFolioLine = async (req: Request, res: Response) => {
  try {
    const { folioId, lineId } = req.params;
    await FolioLine.findOneAndDelete({ _id: lineId, folio: folioId });
    const totals = await recomputeFolioBalance(folioId as string);
    const folio = await Folio.findByIdAndUpdate(
      folioId,
      {
        totalCharges: totals.totalCharges,
        totalTax: totals.totalTax,
        cgst: totals.cgst,
        sgst: totals.sgst,
        totalDiscounts: totals.totalDiscounts,
        totalPaid: totals.totalPaid,
        totalAdvanceAdjusted: totals.totalAdvanceAdjusted,
        balance: totals.balance,
      },
      { new: true }
    );
    const lines = await FolioLine.find({ folio: folioId }).sort({ date: 1, postedAt: 1 }).lean();
    return res.json({ success: true, message: "Line deleted successfully", data: { folio, lines } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
