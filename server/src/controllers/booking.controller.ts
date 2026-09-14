import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking, BookingStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { Payment } from "../models/Payment";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType } from "../models/HousekeepingTask";
import { validateAndCalculateCoupon } from "../services/coupon.service";
import { calculateBookingTotals } from "../services/pricing.service";
import { logger } from "../services/logger.service";
import { IllegalBookingTransitionError, transitionBookingStatus } from "../services/booking-state.service";
import { transitionRoomStatus } from "../services/room-state.service";
import { createAuditLog } from "../services/audit.service";
import crypto from "crypto";
import { z } from "zod";
import { BookingIdempotency, BookingIdempotencyStatus } from "../models/BookingIdempotency";
import { BookingConflictError, buildBookingRequestHash, reserveInventoryDays, buildStayDates } from "../services/booking-safety.service";
import { assertGuestNotBlocked, GuestBlockedError, syncGuestOnBookingCreated } from "../services/guest.service";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { createFolio, postCharge, finalizeFolio, settleFolio, calculateTaxBreakdown, recomputeFolioBalance } from "../services/folio.service";
import { AdvancePayment, AdvancePaymentStatus } from "../models/AdvancePayment";
import { adjustAdvance } from "../services/advance.service";
import { BookingEvent, BookingEventType } from "../models/BookingEvent";
import { BookingInventoryDay } from "../models/BookingInventoryDay";

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ success: false, message: "Valid check-in and check-out dates are required" });
    }
    if (checkInDate < today) {
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
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
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

    // Calculate price — server is the sole source of truth for pricing
    const category = await RoomCategory.findById(roomCategoryId);
    if (!category) return res.status(404).json({ success: false, message: "Room category not found" });
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const roomCharges = category.basePrice * nights;

    let discountAmount = 0;
    let appliedCoupon: string | undefined;
    if (couponCode) {
      const { coupon, discount } = await validateAndCalculateCoupon({
        code: couponCode,
        bookingAmount: roomCharges,
        roomCategoryId,
        guestEmail: guestDetails?.email,
      });
      discountAmount = discount;
      appliedCoupon = coupon.code;
    }

    const { taxAmount, totalAmount } = calculateBookingTotals(roomCharges, discountAmount);

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

        const bookingReference = `YES-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const created = await Booking.create(
          [
            {
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
    const nights = Math.ceil(
      (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    );
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

// Admin Check-In
export const checkIn = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const targetRoom = await Room.findById(roomId);
    if (!targetRoom) return res.status(404).json({ success: false, message: "Room not found" });

    // Validate legacy status
    if (targetRoom.status !== RoomStatus.AVAILABLE) {
      return res.status(400).json({
        success: false,
        message: `Room ${targetRoom.roomNumber} is currently ${targetRoom.status} and cannot be checked into`,
      });
    }

    // Validate Sell Status (must not be OUT_OF_ORDER, BLOCKED, OUT_OF_SERVICE)
    if (targetRoom.sellStatus && targetRoom.sellStatus !== SellStatus.SELLABLE) {
      return res.status(400).json({
        success: false,
        message: `Room ${targetRoom.roomNumber} is ${targetRoom.sellStatus} and cannot be checked into`,
      });
    }

    // Validate Housekeeping Status (must be CLEAN or READY)
    if (
      targetRoom.housekeepingStatus &&
      targetRoom.housekeepingStatus !== HousekeepingRoomStatus.CLEAN &&
      targetRoom.housekeepingStatus !== HousekeepingRoomStatus.READY
    ) {
      return res.status(400).json({
        success: false,
        message: `Room ${targetRoom.roomNumber} is ${targetRoom.housekeepingStatus}. It must be CLEAN or READY before guest check-in.`,
      });
    }

    try {
      await transitionBookingStatus(booking, BookingStatus.CHECKED_IN, {
        req,
        action: "booking.checked_in",
        metadata: { roomId },
      });
    } catch (error) {
      if (error instanceof IllegalBookingTransitionError) {
        return res.status(400).json({ success: false, message: "Booking must be CONFIRMED before check-in" });
      }
      throw error;
    }

    booking.assignedRoom = roomId;
    booking.checkedInAt = new Date();
    booking.checkedInBy = (req as any).user?.id ? new mongoose.Types.ObjectId((req as any).user.id) : undefined;

    // Room state update
    targetRoom.status = RoomStatus.OCCUPIED;
    targetRoom.occupancyStatus = OccupancyStatus.OCCUPIED;
    targetRoom.currentBooking = booking._id as mongoose.Types.ObjectId;
    await targetRoom.save();

    await createAuditLog({
      req,
      action: "room.occupied",
      resourceType: "Room",
      resourceId: targetRoom._id.toString(),
      metadata: { bookingId: booking._id.toString(), bookingReference: booking.bookingReference, roomNumber: targetRoom.roomNumber },
    });

    // ── FOLIO INITIALIZATION ──
    let folio: any = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN });
    if (!folio) {
      folio = await createFolio(
        {
          bookingId: booking._id.toString(),
          guestId: (booking.customer || (req as any).user?.id || targetRoom._id).toString(),
          roomId: targetRoom._id.toString(),
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
        },
        { req }
      );

      // Post initial room tariff
      const nights = Math.max(1, Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
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
          { req }
        );

        // Post GST lines
        const tax = await calculateTaxBreakdown(baseTariff);
        if (tax.cgst > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.TAX_CGST,
              description: "CGST (9%)",
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
              description: "SGST (9%)",
              amount: tax.sgst,
              date: new Date(),
              postedBy: "SYSTEM_TAX",
            },
            { req }
          );
        }
        if (tax.igst > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.TAX_IGST,
              description: "IGST (18%)",
              amount: tax.igst,
              date: new Date(),
              postedBy: "SYSTEM_TAX",
            },
            { req }
          );
        }
      }

      // If prepayment was made upon online booking, credit to Folio
      if (booking.paidAmount > 0) {
        await postCharge(
          {
            folioId: folio._id.toString(),
            bookingId: booking._id.toString(),
            lineType: FolioLineType.PAYMENT,
            description: "Prepayment received online",
            amount: booking.paidAmount,
            date: new Date(),
            postedBy: "SYSTEM_PAYMENT",
            notes: "Razorpay / Online payment credited to folio",
          },
          { req }
        );
      }
    }

    booking.folio = folio._id as mongoose.Types.ObjectId;
    await booking.save();

    // Record booking event
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
      .populate("roomCategory", "name basePrice")
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Find open or finalized folio
    let folio = await Folio.findOne({
      booking: booking._id,
      status: { $in: [FolioStatus.OPEN, FolioStatus.FINALIZED] },
    }).lean();

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

    const {
      advanceAdjustmentAmount,
      advancePaymentId,
      paymentAmount,
      paymentMethod = "CASH",
      refundAmount,
      forceBypassBalance = false,
      notes,
    } = req.body || {};

    let folio: any = await Folio.findOne({
      booking: booking._id,
      status: { $in: [FolioStatus.OPEN, FolioStatus.FINALIZED] },
    });

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
          { req }
        );
      } else {
        const adv = await AdvancePayment.findOne({
          $or: [{ booking: booking._id }, ...(booking.customer ? [{ guest: booking.customer }] : [])],
          remainingBalance: { $gte: Number(advanceAdjustmentAmount) },
          status: { $in: [AdvancePaymentStatus.RECEIVED, AdvancePaymentStatus.PARTIALLY_ADJUSTED] },
        });
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
            { req }
          );
        }
      }
      folio = await Folio.findById(folio._id);
    }

    // 2. Process final Payment if specified
    if (paymentAmount && Number(paymentAmount) > 0 && folio) {
      await postCharge(
        {
          folioId: folio._id.toString(),
          bookingId: booking._id.toString(),
          lineType: FolioLineType.PAYMENT,
          description: `Checkout Payment (${paymentMethod})`,
          amount: Number(paymentAmount),
          date: new Date(),
          postedBy: actorId?.toString() || "CHECKOUT",
          notes: notes || `Settled via ${paymentMethod} at checkout`,
        },
        { req }
      );
      booking.paidAmount = (booking.paidAmount || 0) + Number(paymentAmount);
      folio = await Folio.findById(folio._id);
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
        { req }
      );
      folio = await Folio.findById(folio._id);
    }

    // 4. Financial Invariant Check: Verify Folio Balance is settled
    if (folio) {
      const balanceCheck = await recomputeFolioBalance(folio._id.toString());
      if (Math.abs(balanceCheck.balance) > 1 && !forceBypassBalance) {
        return res.status(400).json({
          success: false,
          message: `Cannot checkout: Outstanding folio balance of ₹${balanceCheck.balance.toFixed(2)}. Settle balance with payment, advance adjustment, or refund.`,
          balance: balanceCheck.balance,
        });
      }

      // Finalize and Settle Folio
      if (folio.status === FolioStatus.OPEN) {
        await finalizeFolio(folio._id.toString(), { req });
      }
      folio = await settleFolio(folio._id.toString(), { req, closedBy: actorId?.toString() || "FRONT_DESK" });
    }

    // 5. Transition booking status
    await transitionBookingStatus(booking, BookingStatus.CHECKED_OUT, {
      req,
      action: "booking.checked_out",
      metadata: { invoiceNumber: folio?.invoiceNumber },
    });

    booking.checkedOutAt = new Date();
    booking.checkedOutBy = actorId ? new mongoose.Types.ObjectId(actorId) : undefined;
    if (folio && folio.balance <= 1) {
      booking.paymentStatus = PaymentStatus.PAID;
    }
    await booking.save();

    // 6. Hard Room State Machine: Room becomes DIRTY, occupancy VACANT
    if (booking.assignedRoom) {
      const room = await Room.findById(booking.assignedRoom);
      if (room) {
        room.status = RoomStatus.CLEANING;
        room.occupancyStatus = OccupancyStatus.VACANT;
        room.housekeepingStatus = HousekeepingRoomStatus.DIRTY;
        room.currentBooking = undefined;
        await room.save();

        await createAuditLog({
          req,
          action: "room.vacated_dirty",
          resourceType: "Room",
          resourceId: room._id.toString(),
          metadata: { roomNumber: room.roomNumber, bookingId: booking._id.toString() },
        });

        // Housekeeping task generation
        await HousekeepingTask.create({
          room: room._id,
          status: HousekeepingStatus.DIRTY,
          priority: HousekeepingPriority.HIGH,
          taskType: HousekeepingTaskType.CHECKOUT_CLEAN,
          notes: `Checkout turnover for ${booking.guestDetails?.firstName} ${booking.guestDetails?.lastName} (${booking.bookingReference})`,
        });
      }
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

    const additionalNights = Math.ceil((targetCheckOut.getTime() - currentCheckOut.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = (booking.roomCategory as any)?.basePrice || 0;
    const additionalTariff = basePrice * additionalNights;
    const tax = await calculateTaxBreakdown(additionalTariff);
    const additionalTotal = tax.totalWithTax;
    const additionalTax = tax.totalTax;

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

    const additionalNights = Math.ceil((targetCheckOut.getTime() - currentCheckOut.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = (booking.roomCategory as any)?.basePrice || 0;
    const additionalTariff = basePrice * additionalNights;
    const tax = await calculateTaxBreakdown(additionalTariff);
    const additionalTotal = tax.totalWithTax;
    const additionalTax = tax.totalTax;

    // ── INVENTORY SAFETY: Reserve inventory days for extension ──
    const categoryId = (booking.roomCategory as any)._id || booking.roomCategory;
    const extStayDates = buildStayDates(currentCheckOut, targetCheckOut);
    const capacity = await Room.countDocuments({
      category: categoryId,
      status: { $nin: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] },
    });

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
            description: "CGST on Stay Extension (9%)",
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
            description: "SGST on Stay Extension (9%)",
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


