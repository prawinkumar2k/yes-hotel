import { Request, Response } from "express";
import mongoose from "mongoose";
import { BusinessDate, BusinessDateState } from "../models/BusinessDate";
import { Booking, BookingStatus } from "../models/Booking";
import { Room } from "../models/Room";
import { Folio, FolioStatus } from "../models/Folio";
import { postCharge } from "../services/folio.service";
import { FolioLineType } from "../models/FolioLine";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { createAuditLog } from "../services/audit.service";
import { transitionBookingStatus } from "../services/booking-state.service";
import { releaseInventoryDays } from "../services/booking-safety.service";

/**
 * GET /api/night-audit/status
 * Returns current business date status and pre-audit validation checklist.
 */
export const getNightAuditStatus = async (_req: Request, res: Response) => {
  try {
    let bizDate = await BusinessDate.findOne({ isCurrentDate: true });
    if (!bizDate) {
      bizDate = await BusinessDate.create({
        date: new Date(),
        state: BusinessDateState.OPEN,
        isCurrentDate: true,
        openedAt: new Date(),
      });
    }

    const today = new Date(bizDate.date);
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Checklist stats
    const [pendingArrivals, pendingDepartures, inHouseGuests, dirtyRooms, openCashierShifts] = await Promise.all([
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
        status: CashierShiftStatus.OPEN,
      }),
    ]);

    const isReadyForAudit = pendingArrivals === 0 && pendingDepartures === 0 && openCashierShifts === 0;

    return res.json({
      success: true,
      data: {
        businessDate: bizDate.date,
        isOpen: bizDate.state === BusinessDateState.OPEN,
        checklist: {
          pendingArrivals,
          pendingDepartures,
          inHouseGuests,
          dirtyRooms,
          openCashierShifts,
          isReadyForAudit,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/night-audit/run
 * Executes night audit: posts room charges + GST for in-house guests,
 * cancels no-shows with inventory release, and rolls business date.
 */
export const runNightAudit = async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id;
  const { force } = req.body || {};

  // Guard: ensure cashier shifts are closed before night audit. A cheap
  // pre-check outside the transaction — worst case under a genuine race two
  // requests both pass it, but the transaction below is what actually makes
  // the audit itself safe, not this check.
  const openShiftsCount = await CashierShift.countDocuments({ status: CashierShiftStatus.OPEN });
  if (openShiftsCount > 0 && !force) {
    return res.status(400).json({
      success: false,
      message: `Cannot execute Night Audit: ${openShiftsCount} cashier shift(s) are still OPEN. Cash drawers must be reconciled and closed before day rollover.`,
    });
  }

  // Previously this entire flow ran with no transaction and no locking at
  // all: two concurrent (or retried) calls to this endpoint would both read
  // the same isCurrentDate:true BusinessDate, both loop the same in-house
  // bookings and both post a full night's room charge + GST to each one —
  // confirmed live during this audit (₹4420 of duplicate revenue posted to
  // a single test folio from exactly this race). Only the very last step
  // (creating the new BusinessDate) was protected, by a unique index on
  // isCurrentDate — so the second request's duplicate charges had already
  // committed by the time it hit that error.
  //
  // Fix: wrap the whole audit in one transaction, and make closing the old
  // BusinessDate + opening the new one the FIRST writes in it (the "claim"),
  // before any charge posting. Under real concurrency, MongoDB's write
  // conflict on that same document now aborts the entire transaction —
  // charges included — for whichever request loses the race, instead of
  // letting it complete unrelated work first.
  let result: {
    previousDate: Date;
    newBusinessDate: Date;
    postedChargesCount: number;
    noShowCount: number;
  } | null = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let bizDate = await BusinessDate.findOne({ isCurrentDate: true }).session(session);
      if (!bizDate) {
        const [created] = await BusinessDate.create([{
          date: new Date(),
          state: BusinessDateState.OPEN,
          isCurrentDate: true,
          openedAt: new Date(),
        }], { session });
        bizDate = created;
      }

      const auditDate = new Date(bizDate.date);

      // Claim this business date for audit FIRST — close it and open
      // tomorrow's before doing any financial posting, so a losing
      // concurrent transaction conflicts here and rolls back everything.
      bizDate.state = BusinessDateState.CLOSED;
      bizDate.closedAt = new Date();
      bizDate.closedBy = actorId;
      bizDate.isCurrentDate = false;
      await bizDate.save({ session });

      const nextDate = new Date(auditDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const [newBizDate] = await BusinessDate.create([{
        date: nextDate,
        state: BusinessDateState.OPEN,
        isCurrentDate: true,
        openedAt: new Date(),
      }], { session });

      // 1. Post nightly room charge + GST for all checked-in in-house guests
      const inHouseBookings = await Booking.find({ status: BookingStatus.CHECKED_IN }).populate("roomCategory").session(session);
      let postedChargesCount = 0;

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

            // Post GST breakdown
            const taxRate = nightlyRate > 7500 ? 0.09 : 0.06;
            const cgst = Math.round(nightlyRate * taxRate * 100) / 100;
            const sgst = Math.round(nightlyRate * taxRate * 100) / 100;

            if (cgst > 0) {
              await postCharge(
                {
                  folioId: folio._id.toString(),
                  bookingId: b._id.toString(),
                  lineType: FolioLineType.TAX_CGST,
                  description: `CGST (${taxRate * 100}%) on Room Tariff — ${auditDate.toLocaleDateString()}`,
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
                  description: `SGST (${taxRate * 100}%) on Room Tariff — ${auditDate.toLocaleDateString()}`,
                  amount: sgst,
                  date: auditDate,
                  postedBy: actorId?.toString() || "SYSTEM_NIGHT_AUDIT",
                  businessDate: auditDate,
                },
                { req, session }
              );
            }

            postedChargesCount++;
          }
        }
      }

      // 2. Mark pending confirmed arrivals for today as NO_SHOW with inventory release
      const endOfDay = new Date(auditDate);
      endOfDay.setHours(23, 59, 59, 999);
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

      result = {
        previousDate: auditDate,
        newBusinessDate: nextDate,
        postedChargesCount,
        noShowCount: noShowBookings.length,
      };
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Night Audit is already running or was just completed by another request. Refresh and check the current business date before retrying.",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }

  if (!result) {
    return res.status(500).json({ success: false, message: "Night Audit did not complete" });
  }

  // Audit logging outside the transaction — same convention as
  // checkIn/checkOut: a logging failure must never roll back a completed
  // audit.
  await createAuditLog({
    req,
    action: "night_audit.completed",
    resourceType: "BusinessDate",
    metadata: {
      previousDate: result.previousDate,
      newDate: result.newBusinessDate,
      postedChargesCount: result.postedChargesCount,
      noShowCount: result.noShowCount,
    },
  });

  return res.json({
    success: true,
    message: `Night Audit complete. Business date rolled forward to ${result.newBusinessDate.toLocaleDateString()}`,
    data: result,
  });
};
