import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { Payment } from "../models/Payment";
import { Property } from "../models/Property";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType } from "../models/HousekeepingTask";
import { validateAndCalculateCoupon } from "../services/coupon.service";
import { computeRoomTax, loadGstRules, splitTax } from "../services/tax.service";
import { logger } from "../services/logger.service";
import { IllegalBookingTransitionError, transitionBookingStatus } from "../services/booking-state.service";
import { transitionRoomStatus } from "../services/room-state.service";
import { createAuditLog } from "../services/audit.service";
import { generateBookingReference } from "../utils/booking-reference";
import crypto from "crypto";
import { z } from "zod";
import { BookingIdempotency, BookingIdempotencyStatus } from "../models/BookingIdempotency";
import { claimRoomNights, RoomUnavailableError } from "../services/room-nights.service";
import { BookingConflictError, buildBookingRequestHash, reserveInventoryDays, buildStayDates, ensureInventoryDayDocuments } from "../services/booking-safety.service";
import { assertGuestNotBlocked, GuestBlockedError, syncGuestOnBookingCreated } from "../services/guest.service";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { createFolio, postCharge, finalizeFolio, settleFolio, recomputeFolioBalance, findFolioForBooking, openFolioForBooking, postRecordedPaymentsToFolio, recordFolioPayment, FolioNotBalancedError } from "../services/folio.service";
import { AdvancePayment, AdvancePaymentStatus } from "../models/AdvancePayment";
import { adjustAdvance } from "../services/advance.service";
import { BookingEvent, BookingEventType } from "../models/BookingEvent";
import { BookingInventoryDay } from "../models/BookingInventoryDay";
import { BookingEnquiry, BookingEnquiryStatus } from "../models/BookingEnquiry";
import { nights as countNights, toBusinessDate, todayBusinessDate } from "../../../shared/dates";

const guestDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "Guest first name is required"),
  lastName: z.string().trim().min(1, "Guest last name is required"),
  email: z.string().email("Valid guest email is required"),
  phone: z.string().trim().min(5, "Guest phone is required"),
});

const createBookingSchema = z.object({
  roomCategoryId: z.string().min(1, "Room category is required"),
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  adults: z.coerce.number().int().min(1, "At least one adult is required"),
  children: z.coerce.number().int().min(0).optional(),
  guestDetails: guestDetailsSchema,
  specialRequests: z.string().optional(),
  couponCode: z.string().optional(),
});

function getIdempotencyKey(req: Request) {
  const key = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  return typeof key === "string" && key.trim() ? key.trim() : "";
}

// Real availability engine
export const checkAvailability = async (req: Request, res: Response) => {
  try {
    const source = req.method === "POST" ? req.body : req.query;
    const { checkIn, checkOut, adults = 1, children = 0, rooms = 1 } = source;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "checkIn and checkOut dates are required" });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ success: false, message: "Valid check-in and check-out dates are required" });
    }
    // Compare calendar dates at the property, not server-local midnight.
    if (toBusinessDate(checkInDate) < todayBusinessDate()) {
      return res.status(400).json({ success: false, message: "Check-in date cannot be in the past" });
    }
    if (Number(adults) < 1 || Number(children) < 0 || Number(rooms) < 1) {
      return res.status(400).json({ success: false, message: "Guest and room counts are invalid" });
    }
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ success: false, message: "Check-out must be after check-in" });
    }

    // Get all active bookings that overlap with the requested dates
    const overlappingBookings = await Booking.find({
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.PENDING] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    });

    // Count booked rooms per category
    const bookedCountByCategory: Record<string, number> = {};
    for (const b of overlappingBookings) {
      const catId = b.roomCategory.toString();
      bookedCountByCategory[catId] = (bookedCountByCategory[catId] || 0) + 1;
    }

    // Get all categories that match capacity
    const categories = await RoomCategory.find({
      isActive: true,
      "capacity.adults": { $gte: Number(adults) },
    });

    const available = [];

    for (const cat of categories) {
      const catId = cat._id.toString();
      // Total physical rooms in this category minus those under maintenance
      const totalRooms = await Room.countDocuments({
        category: cat._id,
        status: { $nin: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] },
      });
      const bookedCount = bookedCountByCategory[catId] || 0;
      const availableCount = totalRooms - bookedCount;

      if (availableCount >= Number(rooms)) {
        const nights = countNights(checkInDate, checkOutDate);
        available.push({
          ...cat.toObject(),
          availableCount,
          nights,
          totalPrice: cat.basePrice * nights * Number(rooms),
          pricePerNight: cat.basePrice,
        });
      }
    }

    return res.status(200).json({ success: true, data: available });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * The price of a stay exactly as createBooking will charge it: room charges for the
 * stay's nights, coupon discount, and GST per night via taxService on the
 * post-discount nightly value. Used by createBooking and POST /api/bookings/quote.
 */
export async function priceStay(params: {
  category: { _id: any; basePrice: number };
  checkIn: Date;
  checkOut: Date;
  couponCode?: string;
  guestEmail?: string;
}) {
  const nights = countNights(params.checkIn, params.checkOut);
  const roomCharges = params.category.basePrice * nights;

  let discountAmount = 0;
  let appliedCoupon: string | undefined;
  if (params.couponCode) {
    const { coupon, discount } = await validateAndCalculateCoupon({
      code: params.couponCode,
      bookingAmount: roomCharges,
      roomCategoryId: String(params.category._id),
      guestEmail: params.guestEmail,
    });
    discountAmount = discount;
    appliedCoupon = coupon.code;
  }

  const tax = computeRoomTax(await loadGstRules(), {
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nightlyValue: Math.max(0, roomCharges - discountAmount) / Math.max(1, nights),
  });
  return {
    nights,
    roomCharges,
    discountAmount,
    appliedCoupon,
    taxableAmount: tax.taxable,
    cgst: tax.cgst,
    sgst: tax.sgst,
    taxAmount: tax.tax,
    totalAmount: tax.total,
    taxLines: tax.lines,
  };
}

/** POST /api/bookings/quote — public, read-only: the price createBooking would charge. */
export const quoteBooking = async (req: Request, res: Response) => {
  try {
    const { roomCategoryId, checkIn, checkOut, couponCode, guestEmail } = req.body ?? {};
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (!roomCategoryId || !mongoose.Types.ObjectId.isValid(String(roomCategoryId))) {
      return res.status(400).json({ success: false, message: "A valid roomCategoryId is required" });
    }
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime()) || countNights(ci, co) < 1) {
      return res.status(400).json({ success: false, message: "checkIn and checkOut must be valid dates at least one night apart" });
    }
    const category = await RoomCategory.findById(roomCategoryId).select("basePrice").lean();
    if (!category) return res.status(404).json({ success: false, message: "Room category not found" });
    const quote = await priceStay({ category: category as any, checkIn: ci, checkOut: co, couponCode, guestEmail });
    return res.json({ success: true, data: quote });
  } catch (error: any) {
    // Coupon validation failures are user errors.
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Create a booking
export const createBooking = async (req: Request, res: Response) => {
  let idempotencyKey: string | undefined;
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.issues,
      });
    }

    const { roomCategoryId, checkInDate, checkOutDate, adults, children, guestDetails, specialRequests, couponCode } = parsed.data;

    // Validate dates before claiming an idempotency slot — an invalid request
    // must never leave a stale IN_PROGRESS BookingIdempotency record behind.
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkIn >= checkOut) {
      return res.status(400).json({
        success: false,
        message: "Check-out must be after check-in",
      });
    }

    try {
      await assertGuestNotBlocked(guestDetails.email);
    } catch (error: any) {
      if (error instanceof GuestBlockedError) {
        return res.status(403).json({ success: false, message: error.message });
      }
      throw error;
    }

    idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: "Idempotency-Key header is required" });
    }

    const requestHash = buildBookingRequestHash({
      roomCategoryId,
      checkInDate,
      checkOutDate,
      adults,
      children: children ?? 0,
      guestDetails,
      specialRequests,
      couponCode,
    });

    const claimResult = await BookingIdempotency.updateOne(
      { key: idempotencyKey },
      {
        $setOnInsert: {
          key: idempotencyKey,
          requestHash,
          status: BookingIdempotencyStatus.IN_PROGRESS,
        },
      },
      { upsert: true }
    );

    const existingAttempt = await BookingIdempotency.findOne({ key: idempotencyKey });
    if (!existingAttempt) {
      return res.status(500).json({ success: false, message: "Failed to register booking attempt" });
    }
    if (existingAttempt.requestHash !== requestHash) {
      return res.status(409).json({
        success: false,
        message: "Idempotency key already used for a different booking request",
      });
    }
    if (existingAttempt.status === BookingIdempotencyStatus.SUCCEEDED && existingAttempt.bookingId) {
      const booking = await Booking.findById(existingAttempt.bookingId)
        .populate("roomCategory", "name slug images basePrice")
        .populate("assignedRoom", "roomNumber floor");
      if (booking) {
        return res.status(200).json({
          success: true,
          message: "Booking already created",
          data: booking,
        });
      }
    }
    if (existingAttempt.status === BookingIdempotencyStatus.IN_PROGRESS && claimResult.upsertedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Booking request is already being processed",
      });
    }
    if (existingAttempt.status === BookingIdempotencyStatus.CONFLICT || existingAttempt.status === BookingIdempotencyStatus.FAILED) {
      return res.status(409).json({
        success: false,
        message: existingAttempt.errorMessage || "Previous booking attempt failed",
      });
    }

    // Calculate price — server is the sole source of truth for pricing (same function as /quote)
    const category = await RoomCategory.findById(roomCategoryId);
    if (!category) return res.status(404).json({ success: false, message: "Room category not found" });
    const { nights, discountAmount, appliedCoupon, taxAmount, totalAmount } = await priceStay({
      category,
      checkIn,
      checkOut,
      couponCode,
      guestEmail: guestDetails?.email,
    });

    // The reservation claim, booking creation, and idempotency finalization all
    // happen inside a single MongoDB transaction. This is what actually closes
    // the durability gap a saga can't: if the process crashes at any point
    // before commit — including mid-way through a multi-night reservation loop —
    // MongoDB discards every write in the transaction as a unit. There is no
    // window where a partial reservation can be left behind by a crash, because
    // nothing is durably visible until the whole transaction commits.
    let booking: any = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await reserveInventoryDays({
          roomCategoryId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          session,
        });

        const bookingReference = await generateBookingReference("OTA");
        const defaultProp = await Property.findOne().lean();
        const propertyId = (req as any).propertyId || (req.user as any)?.propertyId || defaultProp?._id || new mongoose.Types.ObjectId();
        
        const created = await Booking.create(
          [
            {
              propertyId,
              bookingReference,
              customer: req.user?.id ?? undefined,
              guestDetails,
              roomCategory: roomCategoryId,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              adults,
              children: children ?? 0,
              status: BookingStatus.PENDING,
              totalAmount,
              taxAmount,
              discountAmount,
              appliedCoupon,
              specialRequests,
            },
          ],
          { session }
        );
        booking = created[0];

        // Finalizing the idempotency record inside the same transaction closes
        // a second gap: without this, a crash between "booking committed" and
        // "idempotency marked SUCCEEDED" would leave the key stuck at
        // IN_PROGRESS forever, permanently blocking legitimate retries even
        // though the booking actually succeeded.
        await BookingIdempotency.updateOne(
          { key: idempotencyKey },
          {
            $set: {
              status: BookingIdempotencyStatus.SUCCEEDED,
              bookingId: booking._id,
              bookingReference: booking.bookingReference,
              responseData: booking.toObject(),
            },
          },
          { session }
        );
      });
    } catch (error: any) {
      // The transaction already rolled back every write above — no manual
      // inventory release or booking delete is needed here. Only the
      // idempotency terminal-state write happens outside the transaction,
      // since it must survive even though the transaction itself aborted.
      if (error instanceof BookingConflictError) {
        await BookingIdempotency.updateOne(
          { key: idempotencyKey },
          {
            $set: {
              status: BookingIdempotencyStatus.CONFLICT,
              errorMessage: error.message,
            },
          }
        ).catch(() => undefined);
        return res.status(409).json({ success: false, message: error.message });
      }

      await BookingIdempotency.updateOne(
        { key: idempotencyKey },
        {
          $set: {
            status: BookingIdempotencyStatus.FAILED,
            errorMessage: error.message || "Booking creation failed",
          },
        }
      ).catch(() => undefined);
      throw error;
    } finally {
      await session.endSession();
    }

    if (!booking) {
      return res.status(500).json({ success: false, message: "Failed to create booking" });
    }

    await syncGuestOnBookingCreated(guestDetails);

    // Auto-convert matching open enquiries to CONVERTED
    try {
      const matchConditions: any[] = [];
      if (guestDetails.phone) matchConditions.push({ phone: guestDetails.phone });
      if (guestDetails.email) matchConditions.push({ email: guestDetails.email.toLowerCase() });
      if (matchConditions.length > 0) {
        await BookingEnquiry.updateMany(
          {
            status: { $in: [BookingEnquiryStatus.NEW, BookingEnquiryStatus.CONTACTED, BookingEnquiryStatus.FOLLOW_UP, BookingEnquiryStatus.AWAITING_RESPONSE] },
            $or: matchConditions,
          },
          {
            $set: {
              status: BookingEnquiryStatus.CONVERTED,
              bookingStage: "BOOKING_COMPLETED",
              convertedToBookingId: booking._id,
              convertedAt: new Date(),
            },
          }
        );
      }
    } catch (enqErr: any) {
      logger.warn("booking.enquiry_autoconvert_failed", { error: enqErr?.message });
    }

    await createAuditLog({
      req,
      action: "booking.created",
      resourceType: "Booking",
      resourceId: booking._id.toString(),
      metadata: {
        bookingReference: booking.bookingReference,
        roomCategoryId: roomCategoryId?.toString?.() ?? roomCategoryId,
        totalAmount: booking.totalAmount,
        appliedCoupon: booking.appliedCoupon,
        idempotencyKey,
      },
    });

    return res.status(201).json({ success: true, message: "Booking created", data: booking });
  } catch (error: any) {
    // Coupon validation (and anything else that can throw between the
    // idempotency claim and the transaction) happens outside the
    // transaction's own catch block — without this, a coupon rejection
    // would leave the BookingIdempotency record stuck at IN_PROGRESS
    // forever, permanently blocking a legitimate retry with the same key.
    if (typeof idempotencyKey === "string" && idempotencyKey) {
      await BookingIdempotency.updateOne(
        { key: idempotencyKey, status: BookingIdempotencyStatus.IN_PROGRESS },
        { $set: { status: BookingIdempotencyStatus.FAILED, errorMessage: error.message } }
      ).catch(() => undefined);
    }

    if (couponCodeError(error)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error("booking.create_failed", { requestId: req.id, message: error.message, idempotencyKey });
    return res.status(500).json({ success: false, message: error.message });
  }
};

function couponCodeError(error: any) {
  const couponMessages = [
    "Invalid or inactive coupon",
    "Coupon expired or not active yet",
    "Coupon usage limit reached",
    "Minimum booking amount",
    "Coupon not applicable",
    "exceeded the usage limit",
  ];
  return couponMessages.some((m) => (error.message || "").includes(m));
}

// Get logged-in customer's bookings
export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const bookings = await Booking.find({ customer: req.user?.id })
      .populate("roomCategory", "name slug images basePrice")
      .populate("assignedRoom", "roomNumber floor")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: bookings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyBookingById = async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user?.id })
      .populate("roomCategory", "name slug images basePrice")
      .populate("assignedRoom", "roomNumber floor");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    return res.status(200).json({ success: true, data: booking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bookings/my/:id/invoice — printable HTML invoice, owner-only.
// Real data end to end; the browser's own Print > Save as PDF covers the
// "download" case without pulling in a PDF-generation dependency.
export const getMyBookingInvoice = async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user?.id })
      .populate("roomCategory", "name basePrice");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const payment = await Payment.findOne({ booking: booking._id.toString(), status: "COMPLETED" } as any).sort({
      createdAt: -1,
    });
    const category: any = booking.roomCategory;
    const nights = countNights(new Date(booking.checkInDate), new Date(booking.checkOutDate));
    const roomCharges = booking.totalAmount - booking.taxAmount + (booking.discountAmount || 0);

    const esc = (s: any) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(booking.bookingReference)}</title>
<style>
  body { font-family: Georgia, serif; color: #1a1a1a; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 22px; letter-spacing: 2px; text-transform: uppercase; }
  .muted { color: #777; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  td, th { padding: 8px 0; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
  th { text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #999; }
  .right { text-align: right; }
  .total-row td { border-bottom: none; font-weight: bold; font-size: 16px; padding-top: 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <div class="header">
    <div><h1>YES Hotels</h1><div class="muted">Tax Invoice</div></div>
    <div class="right">
      <div><strong>${esc(booking.bookingReference)}</strong></div>
      <div class="muted">${esc(booking._id.getTimestamp().toLocaleDateString())}</div>
    </div>
  </div>
  <table>
    <tr><th>Guest</th><td class="right">${esc(booking.guestDetails.firstName)} ${esc(booking.guestDetails.lastName)}</td></tr>
    <tr><th>Email</th><td class="right">${esc(booking.guestDetails.email)}</td></tr>
    <tr><th>Check-in</th><td class="right">${esc(new Date(booking.checkInDate).toLocaleDateString())}</td></tr>
    <tr><th>Check-out</th><td class="right">${esc(new Date(booking.checkOutDate).toLocaleDateString())}</td></tr>
    ${payment ? `<tr><th>Payment Ref</th><td class="right">${esc(payment.razorpayPaymentId || payment.transactionId || payment._id)}</td></tr>` : ""}
  </table>
  <table>
    <tr><th>Description</th><th class="right">Amount (INR)</th></tr>
    <tr><td>${esc(category?.name || "Room")} — ${nights} night${nights !== 1 ? "s" : ""}</td><td class="right">${roomCharges.toLocaleString("en-IN")}</td></tr>
    ${booking.discountAmount ? `<tr><td>Coupon Discount (${esc(booking.appliedCoupon)})</td><td class="right">-${booking.discountAmount.toLocaleString("en-IN")}</td></tr>` : ""}
    <tr><td>GST</td><td class="right">${booking.taxAmount.toLocaleString("en-IN")}</td></tr>
    <tr class="total-row"><td>Total Paid</td><td class="right">₹${booking.totalAmount.toLocaleString("en-IN")}</td></tr>
  </table>
  <p class="muted" style="margin-top:40px">Thank you for staying with YES Hotels.</p>
</body></html>`;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(html);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Sentinel thrown inside the checkIn transaction for an illegal status
// transition, distinguishing a 400 business-rule rejection from a 500.
class IllegalCheckInTransitionError extends Error {}

// Admin Check-In
export const checkIn = async (req: Request, res: Response) => {
  try {
    const { roomId, idType, idNumber, nationality, emergencyPhone, overrideHousekeeping, overrideReason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const targetRoom = await Room.findById(roomId);
    if (!targetRoom) return res.status(404).json({ success: false, message: "Room not found" });

    // Gate on the derived room state (room-status snapshot), not the stored fields,
    // which can be stale (e.g. stored CLEAN while the HK task is still ASSIGNED).
    const { getSnapshot } = await import("../services/room-status.service");
    const state = (await getSnapshot()).byRoomId.get(String(targetRoom._id));
    if (state) {
      const heldByOther = state.occupancy === "OCCUPIED" || (state.occupancy === "RESERVED" && state.bookingId !== String(booking._id));
      if (heldByOther) {
        return res.status(409).json({ success: false, message: `Room ${targetRoom.roomNumber} is ${state.occupancy}${state.bookingReference ? ` (${state.bookingReference})` : ""}` });
      }
      // Conservative: a room still flagged occupied with no in-house booking is stale data;
      // never put a guest into it until someone resolves the flag.
      if (targetRoom.status === RoomStatus.OCCUPIED || targetRoom.occupancyStatus === "OCCUPIED") {
        return res.status(409).json({ success: false, code: "ROOM_FLAGGED_OCCUPIED", message: `Room ${targetRoom.roomNumber} is marked OCCUPIED but no in-house booking holds it; resolve the room status before check-in` });
      }
      if (state.sell !== "SELLABLE" || state.blocked) {
        return res.status(400).json({
          success: false,
          message: `Room ${targetRoom.roomNumber} is ${state.blocked ? "BLOCKED" : state.sell}${state.sellReason ? `: ${state.sellReason}` : ""} and cannot be checked into`,
        });
      }
      if (state.hk !== "CLEAN") {
        const { PermissionService } = await import("../services/PermissionService");
        const canOverride = await PermissionService.can((req as any).user, "CAP.CHECKIN_UNCLEAN_OVERRIDE");
        if (!overrideHousekeeping || !canOverride || typeof overrideReason !== "string" || overrideReason.trim().length < 5) {
          return res.status(409).json({
            success: false,
            code: "ROOM_NOT_CLEAN",
            message: `Room ${targetRoom.roomNumber} is ${state.hk}${state.hkTaskStatus ? ` (task ${state.hkTaskStatus})` : ""}. It must be CLEAN before check-in${canOverride ? "; a manager override needs a reason (min 5 characters)." : "; ask a manager to override."}`,
          });
        }
        await createAuditLog({
          req,
          action: "booking.checkin_unclean_override",
          resourceType: "Booking",
          resourceId: booking._id.toString(),
          metadata: { roomNumber: targetRoom.roomNumber, housekeeping: state.hk, task: state.hkTaskStatus, reason: overrideReason.trim() },
        });
      }
    }

    // Everything below (room -> OCCUPIED, booking -> CHECKED_IN, folio
    // creation, room-tariff + tax posting) must land together. Previously
    // the room was saved as OCCUPIED first and the booking's own
    // CHECKED_IN save happened last, after folio/tax posting — so a
    // mid-sequence failure (e.g. postCharge throwing) left the room stuck
    // OCCUPIED with a currentBooking pointer while the booking itself was
    // never actually saved as CHECKED_IN: an orphaned room no one could
    // check out of. Reproduced live and confirmed during this audit.
    let folio: any = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        try {
          await transitionBookingStatus(booking, BookingStatus.CHECKED_IN, {
            req,
            action: "booking.checked_in",
            metadata: { roomId },
          });
        } catch (error) {
          if (error instanceof IllegalBookingTransitionError) {
            throw new IllegalCheckInTransitionError();
          }
          throw error;
        }

        booking.assignedRoom = roomId;
        // Hold the room-nights (unique per room + night): fails if another booking holds any of them.
        await claimRoomNights({ bookingId: booking._id as any, roomId, checkIn: booking.checkInDate, checkOut: booking.checkOutDate, propertyId: booking.propertyId as any, session });
        booking.checkedInAt = new Date();
        booking.checkedInBy = (req as any).user?.id ? new mongoose.Types.ObjectId((req as any).user.id) : undefined;

        // KYC capture at check-in. Previously collected by the frontend
        // form but never wired to any state or sent to this endpoint at
        // all — filled in, then silently discarded on submit.
        if (idType) booking.guestDetails.idType = idType;
        if (idNumber) booking.guestDetails.idNumber = idNumber;
        if (nationality) booking.guestDetails.nationality = nationality;
        if (emergencyPhone) booking.guestDetails.emergencyPhone = emergencyPhone;

        // Room state update
        targetRoom.status = RoomStatus.OCCUPIED;
        targetRoom.occupancyStatus = OccupancyStatus.OCCUPIED;
        targetRoom.currentBooking = booking._id as mongoose.Types.ObjectId;
        await targetRoom.save({ session });

        // ── FOLIO INITIALIZATION ──
        folio = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN }).session(session);
        if (!folio) {
          folio = await createFolio(
            {
              bookingId: booking._id.toString(),
              guestId: (booking.customer || (req as any).user?.id || targetRoom._id).toString(),
              roomId: targetRoom._id.toString(),
              checkInDate: booking.checkInDate,
              checkOutDate: booking.checkOutDate,
            },
            { req, session }
          );

          // Post initial room tariff
          const nights = Math.max(1, countNights(new Date(booking.checkInDate), new Date(booking.checkOutDate)));
          const baseTariff = Math.max(0, (booking.totalAmount || 0) - (booking.taxAmount || 0));

          if (baseTariff > 0) {
            await postCharge(
              {
                folioId: folio._id.toString(),
                bookingId: booking._id.toString(),
                lineType: FolioLineType.ROOM_CHARGE,
                description: `Room Tariff (${nights} night${nights > 1 ? "s" : ""}) — Room ${targetRoom.roomNumber}`,
                amount: baseTariff,
                date: new Date(),
                postedBy: (req as any).user?.id || "FRONT_DESK",
              },
              { req, session }
            );

            // Post GST lines — split the tax the guest was already quoted
            // and charged at booking time (booking.taxAmount, computed by
            // taxService at booking), NOT a freshly recomputed amount: a
            // recomputation that differs from the quote would make the folio
            // disagree with what the guest paid and block checkout.
            const bookingTax = Math.max(0, booking.taxAmount || 0);
            const { cgst, sgst } = splitTax(bookingTax);
            if (cgst > 0) {
              await postCharge(
                {
                  folioId: folio._id.toString(),
                  bookingId: booking._id.toString(),
                  lineType: FolioLineType.TAX_CGST,
                  description: "CGST",
                  amount: cgst,
                  date: new Date(),
                  postedBy: "SYSTEM_TAX",
                },
                { req, session }
              );
            }
            if (sgst > 0) {
              await postCharge(
                {
                  folioId: folio._id.toString(),
                  bookingId: booking._id.toString(),
                  lineType: FolioLineType.TAX_SGST,
                  description: "SGST",
                  amount: sgst,
                  date: new Date(),
                  postedBy: "SYSTEM_TAX",
                },
                { req, session }
              );
            }
          }

          // Credit prepayments from their Payment records (never from booking.paidAmount,
          // which has no backing record and double-counts once payments are also posted).
          await postRecordedPaymentsToFolio(
            folio._id.toString(),
            booking._id.toString(),
            (req as any).user?.id || "SYSTEM_PAYMENT",
            { req, session }
          );
        }

        booking.folio = folio._id as mongoose.Types.ObjectId;
        await booking.save({ session });
      });
    } catch (error: any) {
      if (error instanceof RoomUnavailableError) {
        return res.status(409).json({ success: false, code: "ROOM_UNAVAILABLE", message: error.message });
      }
      if (error instanceof IllegalCheckInTransitionError) {
        return res.status(400).json({ success: false, message: "Booking must be CONFIRMED before check-in" });
      }
      return res.status(500).json({ success: false, message: error.message });
    } finally {
      await session.endSession();
    }

    // Audit logging + booking event are deliberately outside the
    // transaction (same convention as createBooking/checkOut): a logging
    // failure must never roll back a check-in that otherwise succeeded.
    await createAuditLog({
      req,
      action: "room.occupied",
      resourceType: "Room",
      resourceId: targetRoom._id.toString(),
      metadata: { bookingId: booking._id.toString(), bookingReference: booking.bookingReference, roomNumber: targetRoom.roomNumber },
    });

    await BookingEvent.create({
      booking: booking._id,
      eventType: BookingEventType.CHECKED_IN,
      description: `Guest checked in to Room ${targetRoom.roomNumber}. Folio opened.`,
      performedBy: (req as any).user?.id,
      performedByRole: (req as any).user?.role,
      roomId: targetRoom._id.toString(),
    }).catch(() => undefined);

    return res.status(200).json({
      success: true,
      message: `Checked in successfully to Room ${targetRoom.roomNumber}`,
      data: booking,
      folio,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/bookings/:id/checkout-preview
 * Returns comprehensive breakdown of charges, tax, advances, and balance due for checkout.
 */
export const getCheckoutPreview = async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("assignedRoom", "roomNumber floor category")
      .populate("roomCategory", "name basePrice");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Read-only preview: never creates a folio or posts lines.
    const folio: any = await findFolioForBooking(booking._id);

    let lines: any[] = [];
    if (folio) {
      lines = await FolioLine.find({ folio: folio._id }).sort({ date: 1, postedAt: 1 }).lean();
    }

    // Find any unadjusted or active advances linked to guest or booking
    const advances = await AdvancePayment.find({
      $or: [
        { booking: booking._id },
        ...(booking.customer ? [{ guest: booking.customer }] : []),
      ],
      remainingBalance: { $gt: 0 },
      status: { $in: [AdvancePaymentStatus.RECEIVED, AdvancePaymentStatus.PARTIALLY_ADJUSTED] },
    }).lean();

    const totalAdvanceAvailable = advances.reduce((s, a) => s + a.remainingBalance, 0);
    const balance = folio ? folio.balance : 0;

    return res.json({
      success: true,
      data: {
        booking,
        folio: folio || null,
        lines,
        availableAdvances: advances,
        totalAdvanceAvailable,
        summary: {
          totalCharges: folio?.totalCharges || 0,
          totalTax: folio?.totalTax || 0,
          cgst: folio?.cgst || 0,
          sgst: folio?.sgst || 0,
          igst: folio?.igst || 0,
          totalDiscounts: folio?.totalDiscounts || 0,
          totalPaid: folio?.totalPaid || 0,
          totalAdvanceAdjusted: folio?.totalAdvanceAdjusted || 0,
          currentBalance: balance,
          balanceDue: Math.max(0, balance),
          refundDue: balance < 0 ? Math.abs(balance) : 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Check-Out 2.0 (Full Folio, Advance Reconciliation & GST Invoicing)
// Sentinel thrown inside the checkOut transaction to abort it for a business
// rule (outstanding balance), as opposed to an infrastructure failure — lets
// the outer catch tell the two apart and return 400 instead of 500.
class CheckoutBalanceError extends Error {
  constructor(public readonly balance: number) {
    super(
      balance > 0
        ? `Cannot checkout: ₹${balance.toFixed(2)} is still due. Collect a payment or adjust an advance.`
        : `Cannot checkout: the guest has a credit of ₹${Math.abs(balance).toFixed(2)}. Confirm a refund (refundAmount) before checkout.`,
    );
  }
}
class CheckoutOverpaymentError extends Error {
  constructor(public readonly outstanding: number, public readonly offered: number) {
    super(`Payment of ₹${offered.toFixed(2)} exceeds the ₹${outstanding.toFixed(2)} due. Enter the amount due, or return the excess as a refund with a reason.`);
  }
}

export const checkOut = async (req: Request, res: Response) => {
 try {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

  const actorId = (req as any).user?.id || (req as any).user?._id;

  if (booking.status !== BookingStatus.CHECKED_IN) {
    return res.status(400).json({
      success: false,
      message: `Booking is in ${booking.status} state. Guest must be CHECKED_IN to checkout.`,
    });
  }

  // Explicit, idempotent: a stay checked in before folios existed gets its folio
  // (stay charges + recorded payments) opened here, in its own transaction.
  await openFolioForBooking(booking, actorId?.toString() || "CHECKOUT", { req });

  const {
    advanceAdjustmentAmount,
    advancePaymentId,
    paymentAmount,
    paymentMethod = "CASH",
    paymentChannelId,
    refundAmount,
    excessAs,
    excessReason,
    notes,
  } = req.body || {};

  // Everything below mutates the folio, the booking, and the room together.
  // Without a transaction, a crash or thrown error partway through (e.g.
  // after the folio is SETTLED but before the room is marked DIRTY) leaves
  // an invoiced folio attached to a booking that never left CHECKED_IN and
  // a room that never re-enters housekeeping — exactly the kind of
  // cross-module inconsistency createBooking's transaction already guards
  // against on the booking-creation side.
  let folio: any = null;
  let roomNumber: string | undefined;
  
  const { resolvePaymentChannel } = await import("../utils/payment-channel.resolver");
  const resolvedChannelId = await resolvePaymentChannel(paymentMethod, paymentChannelId);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      folio = await Folio.findOne({
        booking: booking._id,
        status: { $in: [FolioStatus.OPEN, FolioStatus.FINALIZED] },
      }).session(session);

      // 1. Process Advance Adjustment if specified
      if (advanceAdjustmentAmount && advanceAdjustmentAmount > 0 && folio) {
        if (advancePaymentId) {
          await adjustAdvance(
            {
              advancePaymentId,
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              amount: Number(advanceAdjustmentAmount),
              performedBy: actorId?.toString() || "CHECKOUT",
              reason: notes || "Checkout settlement from advance",
            },
            { req, session }
          );
        } else {
          const adv = await AdvancePayment.findOne({
            $or: [{ booking: booking._id }, ...(booking.customer ? [{ guest: booking.customer }] : [])],
            remainingBalance: { $gte: Number(advanceAdjustmentAmount) },
            status: { $in: [AdvancePaymentStatus.RECEIVED, AdvancePaymentStatus.PARTIALLY_ADJUSTED] },
          }).session(session);
          if (adv) {
            await adjustAdvance(
              {
                advancePaymentId: adv._id.toString(),
                folioId: folio._id.toString(),
                bookingId: booking._id.toString(),
                amount: Number(advanceAdjustmentAmount),
                performedBy: actorId?.toString() || "CHECKOUT",
                reason: notes || "Checkout settlement from advance",
              },
              { req, session }
            );
          }
        }
        folio = await Folio.findById(folio._id).session(session);
      }

      // 2. Process final Payment if specified. Overpayment is refused unless the excess is
      //    explicitly returned to the guest (excessAs: "REFUND" with a reason).
      if (paymentAmount && Number(paymentAmount) > 0 && folio) {
        const outstanding = (await recomputeFolioBalance(folio._id.toString(), { session })).balance;
        const excess = Math.round((Number(paymentAmount) - Math.max(0, outstanding)) * 100) / 100;
        if (excess > 0 && !(excessAs === "REFUND" && typeof excessReason === "string" && excessReason.trim().length >= 3)) {
          throw new CheckoutOverpaymentError(Math.max(0, outstanding), Number(paymentAmount));
        }
        // Payment document + folio PAYMENT line, together (the line points to the Payment).
        await recordFolioPayment(
          {
            folioId: folio._id.toString(),
            bookingId: booking._id.toString(),
            amount: Number(paymentAmount),
            method: String(paymentMethod).toUpperCase(),
            description: `Checkout Payment (${paymentMethod})`,
            postedBy: actorId?.toString() || "CHECKOUT",
            paymentChannelId: resolvedChannelId?.toString(),
            notes: notes || `Settled via ${paymentMethod} at checkout`,
            propertyId: booking.propertyId,
          },
          { req, session }
        );
        if (excess > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.REFUND,
              description: `Excess payment returned (${paymentMethod})`,
              amount: excess,
              date: new Date(),
              postedBy: actorId?.toString() || "CHECKOUT",
              notes: excessReason.trim(),
            },
            { req, session }
          );
        }
        booking.paidAmount = (booking.paidAmount || 0) + Number(paymentAmount);
        folio = await Folio.findById(folio._id).session(session);
      }

      // 3. Process Refund if specified
      if (refundAmount && Number(refundAmount) > 0 && folio) {
        await postCharge(
          {
            folioId: folio._id.toString(),
            bookingId: booking._id.toString(),
            lineType: FolioLineType.REFUND,
            description: "Checkout Refund",
            amount: Number(refundAmount),
            date: new Date(),
            postedBy: actorId?.toString() || "CHECKOUT",
            notes: notes || "Excess balance refunded at checkout",
          },
          { req, session }
        );
        folio = await Folio.findById(folio._id).session(session);
      }

      // 4. Financial Invariant Check: Verify Folio Balance is settled
      if (folio) {
        let balanceCheck = await recomputeFolioBalance(folio._id.toString(), { session });
        
        // The folio must balance exactly. A guest credit (negative balance) is never refunded
        // silently: staff confirm it with refundAmount (or excessAs/excessReason on the payment).
        if (balanceCheck.balance !== 0) {
          throw new CheckoutBalanceError(balanceCheck.balance);
        }

        // Finalize and Settle Folio
        if (folio.status === FolioStatus.OPEN) {
          await finalizeFolio(folio._id.toString(), { req, session });
        }
        folio = await settleFolio(folio._id.toString(), { req, session, closedBy: actorId?.toString() || "FRONT_DESK" });
      }

      // 5. Transition booking status
      await transitionBookingStatus(booking, BookingStatus.CHECKED_OUT, {
        req,
        action: "booking.checked_out",
        metadata: { invoiceNumber: folio?.invoiceNumber },
        session,
      });

      booking.checkedOutAt = new Date();
      booking.checkedOutBy = actorId ? new mongoose.Types.ObjectId(actorId) : undefined;
      if (folio && folio.balance <= 1) {
        booking.paymentStatus = PaymentStatus.PAID;
      }
      await booking.save({ session });

      // 6. Hard Room State Machine: Room becomes DIRTY, occupancy VACANT
      if (booking.assignedRoom) {
        const room = await Room.findById(booking.assignedRoom).session(session);
        if (room) {
          room.status = RoomStatus.CLEANING;
          room.occupancyStatus = OccupancyStatus.VACANT;
          room.housekeepingStatus = HousekeepingRoomStatus.DIRTY;
          room.currentBooking = undefined;
          await room.save({ session });
          roomNumber = room.roomNumber;

          const resolvedPropId = booking.propertyId || booking.property || room.propertyId || (folio as any)?.propertyId || (await Property.findOne().session(session).lean())?._id;

          // Housekeeping task generation
          await HousekeepingTask.create(
            [
              {
                propertyId: resolvedPropId,
                room: room._id,
                status: HousekeepingStatus.DIRTY,
                priority: HousekeepingPriority.HIGH,
                taskType: HousekeepingTaskType.CHECKOUT_CLEAN,
                notes: `Checkout turnover for ${booking.guestDetails?.firstName} ${booking.guestDetails?.lastName} (${booking.bookingReference})`,
              },
            ],
            { session }
          );
        }
      }
    });
  } catch (error: any) {
    if (error instanceof CheckoutBalanceError) {
      return res.status(error.balance < 0 ? 409 : 400).json({ success: false, code: error.balance < 0 ? "GUEST_CREDIT_UNREFUNDED" : "BALANCE_DUE", message: error.message, balance: error.balance });
    }
    if (error instanceof CheckoutOverpaymentError) {
      return res.status(400).json({ success: false, code: "OVERPAYMENT", message: error.message, outstanding: error.outstanding });
    }
    if (error instanceof FolioNotBalancedError) {
      return res.status(400).json({ success: false, code: "FOLIO_NOT_BALANCED", message: error.message, balance: error.balance });
    }
    console.error("Check-out Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }

  // Audit logging is deliberately outside the transaction (same convention
  // as createBooking): a logging failure must never roll back a checkout
  // that otherwise succeeded.
  if (roomNumber && booking.assignedRoom) {
    await createAuditLog({
      req,
      action: "room.vacated_dirty",
      resourceType: "Room",
      resourceId: booking.assignedRoom.toString(),
      metadata: { roomNumber, bookingId: booking._id.toString() },
    });
  }

  // Record booking event
  await BookingEvent.create({
    booking: booking._id,
    eventType: BookingEventType.CHECKED_OUT,
    description: `Checked out successfully. Invoice generated: ${folio?.invoiceNumber || "N/A"}`,
    performedBy: actorId,
    performedByRole: (req as any).user?.role,
    roomId: booking.assignedRoom?.toString(),
  }).catch(() => undefined);

  return res.status(200).json({
    success: true,
    message: `Checked out successfully. Invoice generated: ${folio?.invoiceNumber || "N/A"}`,
    data: booking,
    invoiceNumber: folio?.invoiceNumber,
    folio,
  });
 } catch (error: any) {
   return res.status(500).json({ success: false, message: error.message });
 }
};

/**
 * POST /api/bookings/:id/extension-check
 * Checks if extending stay to newCheckOutDate creates an availability conflict.
 */
export const checkExtensionConflict = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newCheckOutDate } = req.body;

    const booking = await Booking.findById(id).populate("roomCategory");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const currentCheckOut = new Date(booking.checkOutDate);
    const targetCheckOut = new Date(newCheckOutDate);

    if (targetCheckOut <= currentCheckOut) {
      return res.status(400).json({
        success: false,
        message: "New check-out date must be after current check-out date",
      });
    }

    // Check for conflicting bookings in the extension window
    const conflicts = await Booking.find({
      _id: { $ne: booking._id },
      roomCategory: (booking.roomCategory as any)._id || booking.roomCategory,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.PENDING] },
      checkInDate: { $lt: targetCheckOut },
      checkOutDate: { $gt: currentCheckOut },
    }).lean();

    const additionalNights = countNights(currentCheckOut, targetCheckOut);
    const basePrice = (booking.roomCategory as any)?.basePrice || 0;
    const additionalTariff = basePrice * additionalNights;
    // Quote exactly what extendStay posts: taxService room GST per added night.
    const extTax = computeRoomTax(await loadGstRules(), { checkIn: currentCheckOut, checkOut: targetCheckOut, nightlyValue: basePrice });
    const additionalTax = extTax.tax;
    const additionalTotal = extTax.total;

    const isConflict = conflicts.length > 0 && booking.assignedRoom
      ? conflicts.some((c) => c.assignedRoom?.toString() === booking.assignedRoom?.toString())
      : false;

    return res.json({
      success: true,
      data: {
        available: !isConflict,
        additionalNights,
        additionalTariff,
        additionalTax,
        additionalTotal,
        newCheckOutDate: targetCheckOut,
        conflictsCount: conflicts.length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/bookings/:id/extend
 * Executes stay extension, reserves inventory days, posts folio charges, updates reservation date.
 */
export const extendStay = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newCheckOutDate, notes } = req.body;
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const booking = await Booking.findById(id).populate("roomCategory");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const currentCheckOut = new Date(booking.checkOutDate);
    const targetCheckOut = new Date(newCheckOutDate);

    if (targetCheckOut <= currentCheckOut) {
      return res.status(400).json({
        success: false,
        message: "New check-out date must be after current check-out date",
      });
    }

    const additionalNights = countNights(currentCheckOut, targetCheckOut);
    const basePrice = (booking.roomCategory as any)?.basePrice || 0;
    const additionalTariff = basePrice * additionalNights;
    // Room GST per added night via taxService (slab by per-night value, rule in force on each night).
    const extTax = computeRoomTax(await loadGstRules(), { checkIn: currentCheckOut, checkOut: targetCheckOut, nightlyValue: basePrice });
    const extensionRatePct = Math.max(...extTax.lines.map((l) => l.rate));
    const additionalTaxCgst = extTax.cgst;
    const additionalTaxSgst = extTax.sgst;
    const additionalTax = extTax.tax;
    const additionalTotal = extTax.total;
    const tax = { cgst: additionalTaxCgst, sgst: additionalTaxSgst, totalTax: additionalTax, totalWithTax: additionalTotal };

    // ── INVENTORY SAFETY: Reserve inventory days for extension ──
    const categoryId = (booking.roomCategory as any)._id || booking.roomCategory;
    const extStayDates = buildStayDates(currentCheckOut, targetCheckOut);
    const capacity = await Room.countDocuments({
      category: categoryId,
      status: { $nin: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] },
    });

    // A stay date that has never had a booking before has no
    // BookingInventoryDay document at all yet. Without creating it first,
    // the atomic claim below (a plain findOneAndUpdate with no upsert) has
    // nothing to match and falsely reports "Capacity exhausted" for a date
    // that actually has zero reservations — reproduced live during this
    // audit: extending into a brand-new date failed immediately after
    // extension-check had just reported the date as fully available (that
    // check queries overlapping Bookings directly, not the inventory-day
    // ledger, so the two never agreed on this class of date). The real
    // booking-creation path (reserveInventoryDays) always runs this same
    // ensure-step first; extendStay's own inline claim loop had skipped it.
    await ensureInventoryDayDocuments(categoryId.toString(), extStayDates, capacity);

    for (const stayDate of extStayDates) {
      const reservation = await BookingInventoryDay.findOneAndUpdate(
        {
          roomCategory: categoryId,
          stayDate,
          reservedCount: { $lt: capacity },
        },
        {
          $set: { capacity },
          $inc: { reservedCount: 1 },
        },
        { returnDocument: "after" }
      );
      if (!reservation) {
        return res.status(409).json({
          success: false,
          message: `Cannot extend stay: Capacity exhausted for date ${stayDate.toLocaleDateString()}`,
        });
      }
    }

    // Hold the added room-nights on the assigned room (rejected if another booking holds them).
    if (booking.assignedRoom) {
      try {
        await claimRoomNights({ bookingId: booking._id as any, roomId: (booking.assignedRoom as any)._id ?? booking.assignedRoom, checkIn: booking.checkInDate, checkOut: targetCheckOut, propertyId: booking.propertyId as any });
      } catch (e: any) {
        if (e instanceof RoomUnavailableError) return res.status(409).json({ success: false, code: "ROOM_UNAVAILABLE", message: e.message });
        throw e;
      }
    }
    booking.checkOutDate = targetCheckOut;
    booking.totalAmount += additionalTotal;
    booking.taxAmount += additionalTax;
    if (tax.cgst > 0) booking.cgstAmount = (booking.cgstAmount || 0) + tax.cgst;
    if (tax.sgst > 0) booking.sgstAmount = (booking.sgstAmount || 0) + tax.sgst;
    await booking.save();

    // ── FOLIO UPDATE: Post extension room charge and tax lines ──
    const folio = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN });
    if (folio) {
      await postCharge(
        {
          folioId: folio._id.toString(),
          bookingId: booking._id.toString(),
          lineType: FolioLineType.ROOM_CHARGE,
          description: `Stay Extension (${additionalNights} extra night${additionalNights > 1 ? "s" : ""})`,
          amount: additionalTariff,
          date: new Date(),
          postedBy: actorId?.toString() || "FRONT_DESK",
          notes: notes || `Extended check-out to ${targetCheckOut.toLocaleDateString()}`,
        },
        { req }
      );
      if (tax.cgst > 0) {
        await postCharge(
          {
            folioId: folio._id.toString(),
            bookingId: booking._id.toString(),
            lineType: FolioLineType.TAX_CGST,
            description: `CGST on Stay Extension (${extensionRatePct / 2}%)`,
            amount: tax.cgst,
            date: new Date(),
            postedBy: "SYSTEM_TAX",
          },
          { req }
        );
      }
      if (tax.sgst > 0) {
        await postCharge(
          {
            folioId: folio._id.toString(),
            bookingId: booking._id.toString(),
            lineType: FolioLineType.TAX_SGST,
            description: `SGST on Stay Extension (${extensionRatePct / 2}%)`,
            amount: tax.sgst,
            date: new Date(),
            postedBy: "SYSTEM_TAX",
          },
          { req }
        );
      }
    }

    // ── AUDIT & BOOKING EVENT ──
    await BookingEvent.create({
      booking: booking._id,
      eventType: BookingEventType.DATES_CHANGED,
      description: `Stay extended by ${additionalNights} night(s) to ${targetCheckOut.toLocaleDateString()}. Added ₹${additionalTotal} to folio.`,
      performedBy: actorId,
      performedByRole: (req as any).user?.role,
      previousValue: { checkOutDate: currentCheckOut },
      newValue: { checkOutDate: targetCheckOut, additionalTotal },
    }).catch(() => undefined);

    await createAuditLog({
      req,
      action: "booking.stay_extended",
      resourceType: "Booking",
      resourceId: booking._id.toString(),
      metadata: {
        previousCheckOut: currentCheckOut,
        newCheckOut: targetCheckOut,
        additionalNights,
        additionalTotal,
      },
    });

    return res.json({
      success: true,
      message: `Stay extended by ${additionalNights} night(s) until ${targetCheckOut.toLocaleDateString()}`,
      data: booking,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


