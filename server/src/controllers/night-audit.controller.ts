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
import { addDays, businessDayRange, toBusinessDate } from "../../../shared/dates";

/**
 * GET /api/night-audit/status
 * Returns current business date status, property operational context, and pre-audit validation checklist.
 */
export const getNightAuditStatus = async (_req: Request, res: Response) => {
  try {
    let bizDate = await BusinessDate.findOne({ isCurrentDate: true }).populate("openedBy", "name email");
    if (!bizDate) {
      bizDate = await BusinessDate.create({
        date: new Date(),
        state: BusinessDateState.OPEN,
        isCurrentDate: true,
        openedAt: new Date(),
      });
    }

    // The business date's day at the property (Asia/Kolkata).
    const bizRange = businessDayRange(toBusinessDate(bizDate.date));
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
      Room.countDocuments({
        housekeepingStatus: { $in: ["DIRTY", "CLEANING", "INSPECTION_FAILED"] },
      } as any),
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
    const bizDate = await BusinessDate.findOne({ isCurrentDate: true });
    if (!bizDate) {
      return res.status(400).json({ success: false, message: "No active business date found" });
    }

    const auditDate = new Date(bizDate.date);
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

    const gstRules = await loadGstRules();
    for (const b of inHouseBookings) {
      const nightlyRate = Number((b.roomCategory as any)?.basePrice) || 0;
      const { cgst, sgst } = computeRoomNightTax(gstRules, toBusinessDate(startOfDay), nightlyRate);

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
        businessDate: bizDate.date,
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

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let bizDate = await BusinessDate.findOne({ isCurrentDate: true }).session(session);
      if (!bizDate) {
        const [created] = await BusinessDate.create(
          [
            {
              date: new Date(),
              state: BusinessDateState.OPEN,
              isCurrentDate: true,
              openedAt: new Date(),
            },
          ],
          { session }
        );
        bizDate = created;
      }

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

      // 1. Post nightly room charge + GST for all checked-in in-house guests
      const inHouseBookings = await Booking.find({ status: BookingStatus.CHECKED_IN })
        .populate("roomCategory")
        .session(session);

      let postedChargesCount = 0;
      let totalPostedRevenue = 0;

      for (const b of inHouseBookings) {
        const folio = await Folio.findOne({ booking: b._id, status: FolioStatus.OPEN }).session(session);
        if (folio) {
          const nightlyRate = (b.roomCategory as any)?.basePrice || 0;
          if (nightlyRate > 0) {
            await postCharge(
              {
                folioId: folio._id.toString(),
                bookingId: b._id.toString(),
                lineType: FolioLineType.ROOM_CHARGE,
                description: `Nightly Room Tariff — ${auditDate.toLocaleDateString()}`,
                amount: nightlyRate,
                date: auditDate,
                postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                businessDate: auditDate,
              },
              { req, session }
            );

            // Post GST breakdown (taxService: slab by nightly value, rule in force on the audit date)
            const nightTax = computeRoomNightTax(await loadGstRules(), toBusinessDate(auditDate), nightlyRate);
            const { cgst, sgst } = nightTax;
            const halfRate = nightTax.lines[0].rate / 2;

            if (cgst > 0) {
              await postCharge(
                {
                  folioId: folio._id.toString(),
                  bookingId: b._id.toString(),
                  lineType: FolioLineType.TAX_CGST,
                  description: `CGST (${halfRate}%) on Room Tariff — ${auditDate.toLocaleDateString()}`,
                  amount: cgst,
                  date: auditDate,
                  postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                  businessDate: auditDate,
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
                  description: `SGST (${halfRate}%) on Room Tariff — ${auditDate.toLocaleDateString()}`,
                  amount: sgst,
                  date: auditDate,
                  postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                  businessDate: auditDate,
                },
                { req, session }
              );
            }

            postedChargesCount++;
            totalPostedRevenue += nightlyRate + cgst + sgst;
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

      // 3. Save audit summary on the closed business date
      bizDate.auditSummary = {
        roomChargesPosted: postedChargesCount,
        roomChargesAmount: totalPostedRevenue,
        noShowsProcessed: noShowBookings.length,
        arrivalsCount: 0,
        departuresCount: 0,
        inHouseCount: inHouseBookings.length,
        totalRevenue: totalPostedRevenue,
        totalTax: 0,
        totalCollection: 0,
        totalRefunds: 0,
        totalAdvances: 0,
        totalAdvanceAdjustments: 0,
        openFoliosCount: 0,
        exceptions: [],
      };
      await bizDate.save({ session });

      result = {
        previousDate: auditDate,
        newBusinessDate: nextDate,
        postedChargesCount,
        noShowCount: noShowBookings.length,
        totalPostedRevenue,
      };
    });
  } catch (error: any) {
    if (
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
