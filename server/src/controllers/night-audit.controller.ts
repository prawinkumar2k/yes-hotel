import { Request, Response } from "express";
import mongoose from "mongoose";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";
import { Booking, BookingStatus } from "../models/Booking";
import { Room } from "../models/Room";
import { Folio, FolioStatus } from "../models/Folio";
import { postCharge } from "../services/folio.service";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment } from "../models/AdvancePayment";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { createAuditLog } from "../services/audit.service";
import { transitionBookingStatus } from "../services/booking-state.service";
import { releaseInventoryDays } from "../services/booking-safety.service";
import { computeRoomNightTax, loadGstRules } from "../services/tax.service";
import { addDays, businessDayRange, nights as countNights, toBusinessDate } from "../../../shared/dates";
import { ensureCurrentBusinessDate, getCurrentBusinessDate } from "../services/business-date.service";
import { claimRoomNights, RoomUnavailableError } from "../services/room-nights.service";
import { getSnapshot } from "../services/room-status.service";

/**
 * GET /api/night-audit/status
 * Returns current business date status, property operational context, and pre-audit validation checklist.
 */
export const getNightAuditStatus = async (_req: Request, res: Response) => {
  try {
    // Read-only: before the first night audit there is no business date document yet;
    // report today's date at the property instead of creating one on a GET.
    const current = await getCurrentBusinessDate();
    const bizDate: any = current.doc
      ? await BusinessDate.findById(current.doc._id).populate("openedBy", "name email")
      : { date: businessDayRange(current.date).start, openedAt: null, state: BusinessDateState.OPEN };

    // The business date's day at the property (Asia/Kolkata).
    const bizRange = businessDayRange(current.date);
    const startOfDay = bizRange.start;
    const endOfDay = new Date(bizRange.end.getTime() - 1);

    // Checklist stats
    const [
      pendingArrivals,
      pendingDepartures,
      inHouseGuests,
      dirtyRooms,
      openCashierShifts,
      openCashierShiftsList,
    ] = await Promise.all([
      Booking.countDocuments({
        status: BookingStatus.CONFIRMED,
        checkInDate: { $lte: endOfDay },
      }),
      Booking.countDocuments({
        status: BookingStatus.CHECKED_IN,
        checkOutDate: { $lte: endOfDay },
      }),
      Booking.countDocuments({
        status: BookingStatus.CHECKED_IN,
      }),
      getSnapshot(current.date).then((s) => s.summary.dirty),
      CashierShift.countDocuments({
        status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] },
      }),
      CashierShift.find({
        status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] },
      })
        .populate("cashier", "name email")
        .select("shiftNumber drawerId cashier openingFloat status openedAt")
        .lean(),
    ]);

    const isReadyForAudit = pendingArrivals === 0 && pendingDepartures === 0 && openCashierShifts === 0;

    return res.json({
      success: true,
      data: {
        businessDate: bizDate.date,
        businessDateYmd: current.date,
        initialised: current.initialised,
        openedAt: bizDate.openedAt,
        openedBy: (bizDate as any).openedBy?.name || "System",
        isOpen: bizDate.state === BusinessDateState.OPEN,
        checklist: {
          pendingArrivals,
          pendingDepartures,
          inHouseGuests,
          dirtyRooms,
          openCashierShifts,
          openCashierShiftsList,
          isReadyForAudit,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/night-audit/preview
 * Financial preview: Calculates proposed nightly room charges, tax breakdowns, collections,
 * advances, and folio balances before executing the rollover.
 */
export const getNightAuditPreview = async (_req: Request, res: Response) => {
  try {
    // Read-only: before the first audit, preview today at the property.
    const current = await getCurrentBusinessDate();
    const auditDate = businessDayRange(current.date).start;
    // The audited business date's day at the property (Asia/Kolkata).
    const auditRange = businessDayRange(toBusinessDate(auditDate));
    const startOfDay = auditRange.start;
    const endOfDay = new Date(auditRange.end.getTime() - 1);

    // 1. Proposed Room Charges for in-house guests
    const inHouseBookings = await Booking.find({ status: BookingStatus.CHECKED_IN })
      .populate("roomCategory", "name basePrice")
      .populate("assignedRoom", "roomNumber")
      .populate("customer", "firstName lastName email")
      .lean();

    let estimatedRoomCharges = 0;
    let estimatedCGST = 0;
    let estimatedSGST = 0;
    const proposedPostings: any[] = [];

    // Same rule as the run (nightChargeFor): only nights not already charged, at the booking's rate.
    const gstRules = await loadGstRules();
    const auditYmd = toBusinessDate(startOfDay);
    for (const b of inHouseBookings) {
      const folio = await Folio.findOne({ booking: b._id, status: FolioStatus.OPEN }).select("_id").lean();
      const roomLines = folio ? await FolioLine.find({ folio: folio._id, lineType: FolioLineType.ROOM_CHARGE }).lean() : [];
      const plan = nightChargeFor(b, roomLines, auditYmd);
      if (!plan) continue;
      const nightlyRate = plan.rate;
      const { cgst, sgst } = computeRoomNightTax(gstRules, auditYmd, nightlyRate);

      estimatedRoomCharges += nightlyRate;
      estimatedCGST += cgst;
      estimatedSGST += sgst;

      proposedPostings.push({
        bookingReference: b.bookingReference,
        guestName: b.guestDetails ? `${b.guestDetails.firstName} ${b.guestDetails.lastName}`.trim() : "Guest",
        roomNumber: (b.assignedRoom as any)?.roomNumber || "Unassigned",
        categoryName: (b.roomCategory as any)?.name || "Standard",
        tariff: nightlyRate,
        cgst,
        sgst,
        total: nightlyRate + cgst + sgst,
      });
    }

    // 2. Today's collections by mode from FolioLines and Advances
    const [folioPayments, advancesToday, openFolios] = await Promise.all([
      FolioLine.find({
        lineType: FolioLineType.PAYMENT,
        postedAt: { $gte: startOfDay, $lte: endOfDay },
      }).lean(),
      AdvancePayment.find({
        receivedAt: { $gte: startOfDay, $lte: endOfDay },
      }).lean(),
      Folio.find({ status: FolioStatus.OPEN }).lean(),
    ]);

    let cashCollections = 0;
    let upiCollections = 0;
    let cardCollections = 0;
    let totalAdvances = 0;

    for (const p of folioPayments) {
      const desc = (p.description || "").toUpperCase();
      if (desc.includes("CASH")) cashCollections += p.amount;
      else if (desc.includes("UPI")) upiCollections += p.amount;
      else cardCollections += p.amount;
    }

    for (const adv of advancesToday) {
      totalAdvances += adv.amount;
      if (adv.method === "CASH") cashCollections += adv.amount;
      else if (adv.method === "UPI") upiCollections += adv.amount;
      else cardCollections += adv.amount;
    }

    const openFolioBalances = openFolios.reduce((acc, f) => acc + (f.balance || 0), 0);

    return res.json({
      success: true,
      data: {
        businessDate: auditDate,
        businessDateYmd: current.date,
        initialised: current.initialised,
        proposedPostings,
        totals: {
          inHouseCount: inHouseBookings.length,
          estimatedRoomCharges,
          estimatedCGST,
          estimatedSGST,
          estimatedTotalRevenue: estimatedRoomCharges + estimatedCGST + estimatedSGST,
          cashCollections,
          upiCollections,
          cardCollections,
          totalCollectionsToday: cashCollections + upiCollections + cardCollections,
          totalAdvances,
          openFoliosCount: openFolios.length,
          openFolioBalances,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/night-audit/history
 * Returns immutable audit run history and business dates closed previously.
 */
export const getNightAuditHistory = async (req: Request, res: Response) => {
  try {
    const history = await BusinessDate.find({ state: BusinessDateState.CLOSED })
      .populate("closedBy", "name email role")
      .populate("openedBy", "name email role")
      .sort({ date: -1 })
      .limit(30)
      .lean();

    return res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/night-audit/run
 * Executes night audit: posts room charges + GST for in-house guests,
 * cancels no-shows with inventory release, and rolls business date forward.
 */
class AuditAlreadyCompletedError extends Error {}

/**
 * Whether the night `ymd` of an in-house stay still needs a room charge, and at what rate.
 * A night is covered by a room-charge line that lists it (coversNights) or, for a legacy
 * stay-total line posted at check-in, by being one of the originally booked nights.
 * Rate = the booking's own nightly rate (not the category list price).
 */
function nightChargeFor(b: any, roomLines: any[], ymd: string): { rate: number } | null {
  const bookedCheckOut = toBusinessDate(b.checkOutDate);
  const covered = roomLines.some((l: any) =>
    Array.isArray(l.coversNights) && l.coversNights.length ? l.coversNights.includes(ymd) : ymd < bookedCheckOut,
  );
  if (covered) return null;
  const bookedNights = Math.max(1, countNights(b.checkInDate, b.checkOutDate));
  const rate = Number(b.ratePerNight) || Math.round(((b.totalAmount || 0) - (b.taxAmount || 0)) / bookedNights) || Number(b.roomCategory?.basePrice) || 0;
  return { rate };
}

export const runNightAudit = async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id;
  const { force } = req.body || {};

  // Guard: ensure cashier shifts are closed before night audit
  const openShiftsCount = await CashierShift.countDocuments({
    status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] },
  });
  if (openShiftsCount > 0 && !force) {
    return res.status(400).json({
      success: false,
      message: `Cannot execute Night Audit: ${openShiftsCount} cashier shift(s) are still active or pending handover. All cashier drawers must be closed and reconciled before day rollover.`,
    });
  }

  let result: {
    previousDate: Date;
    newBusinessDate: Date;
    postedChargesCount: number;
    noShowCount: number;
    totalPostedRevenue: number;
  } | null = null;

  // The date this request audits is fixed up front. A concurrent run that commits first
  // advances the business date; when this transaction retries it sees a different date
  // and stops (409) instead of auditing the next day too.
  const expectedDate = (await getCurrentBusinessDate()).date;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Explicit action: opens the first business date if night audit has never run.
      const bizDate: any = await ensureCurrentBusinessDate(session, actorId?.toString());
      if (toBusinessDate(bizDate.date) !== expectedDate) throw new AuditAlreadyCompletedError();

      const auditDate = new Date(bizDate.date);

      // Claim this business date for audit FIRST — close it and open
      // tomorrow's before doing any financial posting, preventing concurrent double-posting.
      bizDate.state = BusinessDateState.CLOSED;
      bizDate.closedAt = new Date();
      bizDate.closedBy = actorId;
      bizDate.isCurrentDate = false;
      await bizDate.save({ session });

      // Next business date = the following calendar day at the property (stored as its IST midnight instant).
      const nextDate = businessDayRange(addDays(toBusinessDate(auditDate), 1)).start;

      const [newBizDate] = await BusinessDate.create(
        [
          {
            propertyId: bizDate.propertyId,
            date: nextDate,
            state: BusinessDateState.OPEN,
            isCurrentDate: true,
            openedAt: new Date(),
            openedBy: actorId,
          },
        ],
        { session }
      );

      // 1. Room charge for the audited night, for every in-house stay whose folio does not
      //    already charge that night. Check-in charges the whole booked stay up front, so in
      //    practice this posts overstay nights (and any stay that was never charged). The
      //    night is claimed in the room-night inventory first, so it cannot collide with
      //    another booking. Rate = the booking's own nightly rate, not the category list price.
      const auditYmd = toBusinessDate(auditDate);
      const gstRules = await loadGstRules();
      const exceptions: string[] = [];
      const inHouseBookings = await Booking.find({ status: BookingStatus.CHECKED_IN })
        .populate("roomCategory")
        .session(session);
      let postedChargesCount = 0;
      let totalPostedRevenue = 0;
      let totalPostedTax = 0;
      for (const b of inHouseBookings) {
        const folio = await Folio.findOne({ booking: b._id, status: FolioStatus.OPEN }).session(session);
        if (!folio) {
          exceptions.push(`${b.bookingReference}: in-house without an open folio`);
          continue;
        }
        const roomLines = await FolioLine.find({ folio: folio._id, lineType: FolioLineType.ROOM_CHARGE }).session(session).lean();
        const bookedCheckOut = toBusinessDate(b.checkOutDate);
        const plan = nightChargeFor(b, roomLines, auditYmd);
        if (!plan) continue;
        if (b.assignedRoom) {
          try {
            await claimRoomNights({ bookingId: b._id as any, roomId: b.assignedRoom as any, checkIn: b.checkInDate, checkOut: addDays(auditYmd, 1) > bookedCheckOut ? addDays(auditYmd, 1) : b.checkOutDate, propertyId: b.propertyId as any, session });
          } catch (e: any) {
            if (e instanceof RoomUnavailableError) {
              exceptions.push(`${b.bookingReference}: overstay night ${auditYmd} conflicts with another booking on the room (not charged)`);
              continue;
            }
            throw e;
          }
        }
        {
          const nightlyRate = plan.rate;
          if (nightlyRate > 0) {
            await postCharge(
              {
                folioId: folio._id.toString(),
                bookingId: b._id.toString(),
                lineType: FolioLineType.ROOM_CHARGE,
                description: `Room Tariff — night of ${auditYmd}`,
                amount: nightlyRate,
                date: auditDate,
                postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                businessDate: auditDate,
                coversNights: [auditYmd],
                allowClosedDate: true,
              },
              { req, session }
            );

            // Post GST breakdown (taxService: slab by nightly value, rule in force on the audit date)
            const nightTax = computeRoomNightTax(gstRules, auditYmd, nightlyRate);
            const { cgst, sgst } = nightTax;
            const halfRate = nightTax.lines[0].rate / 2;

            if (cgst > 0) {
              await postCharge(
                {
                  folioId: folio._id.toString(),
                  bookingId: b._id.toString(),
                  lineType: FolioLineType.TAX_CGST,
                  description: `CGST (${halfRate}%) on Room Tariff — night of ${auditYmd}`,
                  amount: cgst,
                  date: auditDate,
                  postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                  businessDate: auditDate,
                  allowClosedDate: true,
                },
                { req, session }
              );
            }

            if (sgst > 0) {
              await postCharge(
                {
                  folioId: folio._id.toString(),
                  bookingId: b._id.toString(),
                  lineType: FolioLineType.TAX_SGST,
                  description: `SGST (${halfRate}%) on Room Tariff — night of ${auditYmd}`,
                  amount: sgst,
                  date: auditDate,
                  postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                  businessDate: auditDate,
                  allowClosedDate: true,
                },
                { req, session }
              );
            }

            postedChargesCount++;
            totalPostedRevenue += nightlyRate;
            totalPostedTax += cgst + sgst;
          }
        }
      }

      // 2. Mark pending confirmed arrivals for today as NO_SHOW with inventory release
      const endOfDay = new Date(businessDayRange(toBusinessDate(auditDate)).end.getTime() - 1);
      const noShowBookings = await Booking.find({
        status: BookingStatus.CONFIRMED,
        checkInDate: { $lte: endOfDay },
      }).session(session);

      for (const b of noShowBookings) {
        await transitionBookingStatus(b, BookingStatus.NO_SHOW, {
          req,
          action: "night_audit.no_show",
          metadata: { date: auditDate },
          session,
        });
        await b.save({ session });

        if (b.roomCategory && b.checkInDate && b.checkOutDate) {
          await releaseInventoryDays({
            roomCategoryId: b.roomCategory.toString(),
            checkInDate: b.checkInDate,
            checkOutDate: b.checkOutDate,
            session,
          });
        }
      }

      // 3. Daily summary for the closed business date, from the day's real activity.
      const { start: dayStart, end: dayEnd } = businessDayRange(auditYmd);
      const inDay = { $gte: dayStart, $lt: dayEnd };
      const sumOf = async (coll: any, match: any, field = "$amount") =>
        ((await coll.aggregate([{ $match: match }, { $group: { _id: null, t: { $sum: field } } }]).session(session))[0]?.t as number) || 0;
      const { Payment } = await import("../models/Payment");
      const { Refund } = await import("../models/Refund");
      const { AdvanceAdjustment } = await import("../models/AdvanceAdjustment");
      const [arrivalsCount, departuresCount, openFoliosCount, dayRevenue, dayTax, dayCollection, dayRefunds, dayAdvances, dayAdjustments] = await Promise.all([
        Booking.countDocuments({ checkedInAt: inDay }).session(session),
        Booking.countDocuments({ checkedOutAt: inDay }).session(session),
        Folio.countDocuments({ status: FolioStatus.OPEN }).session(session),
        sumOf(FolioLine, { direction: "DEBIT", lineType: { $nin: [FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST] }, createdAt: inDay }),
        sumOf(FolioLine, { lineType: { $in: [FolioLineType.TAX_CGST, FolioLineType.TAX_SGST, FolioLineType.TAX_IGST] }, createdAt: inDay }),
        sumOf(Payment, { status: { $in: ["COMPLETED", "REFUNDED"] }, createdAt: inDay }),
        sumOf(Refund, { createdAt: inDay }),
        sumOf(AdvancePayment, { $or: [{ receivedAt: inDay }, { receivedAt: { $exists: false }, createdAt: inDay }] }),
        sumOf(AdvanceAdjustment, { createdAt: inDay }),
      ]);
      bizDate.auditSummary = {
        roomChargesPosted: postedChargesCount,
        roomChargesAmount: totalPostedRevenue,
        noShowsProcessed: noShowBookings.length,
        arrivalsCount,
        departuresCount,
        inHouseCount: inHouseBookings.length,
        totalRevenue: dayRevenue,
        totalTax: dayTax,
        totalCollection: dayCollection,
        totalRefunds: dayRefunds,
        totalAdvances: dayAdvances,
        totalAdvanceAdjustments: dayAdjustments,
        openFoliosCount,
        exceptions: [...exceptions, ...(force && openShiftsCount ? [`Audit forced with ${openShiftsCount} cashier shift(s) still open`] : [])],
      };
      await bizDate.save({ session });

      result = {
        previousDate: auditDate,
        newBusinessDate: nextDate,
        postedChargesCount,
        noShowCount: noShowBookings.length,
        totalPostedRevenue,
        exceptions: bizDate.auditSummary.exceptions,
      } as any;
    });
  } catch (error: any) {
    if (
      error instanceof AuditAlreadyCompletedError ||
      error?.code === 11000 ||
      error?.code === 112 ||
      error?.name === "WriteConflict" ||
      error?.hasErrorLabel?.("TransientTransactionError") ||
      error?.errorLabels?.includes?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Night Audit is already running or was just completed by another request. Refresh and check the current business date before retrying.",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }

  if (!result) {
    return res.status(500).json({ success: false, message: "Night Audit did not complete" });
  }

  await createAuditLog({
    req,
    action: "night_audit.completed",
    resourceType: "BusinessDate",
    metadata: {
      previousDate: result.previousDate,
      newDate: result.newBusinessDate,
      postedChargesCount: result.postedChargesCount,
      noShowCount: result.noShowCount,
      totalPostedRevenue: result.totalPostedRevenue,
    },
  });

  return res.json({
    success: true,
    message: `Night Audit complete. Business date rolled forward to ${result.newBusinessDate.toLocaleDateString()}`,
    data: result,
  });
};
