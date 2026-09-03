import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { Room, RoomStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { Payment } from "../models/Payment";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { validateAndCalculateCoupon } from "../services/coupon.service";
import { calculateBookingTotals } from "../services/pricing.service";
import { logger } from "../services/logger.service";
import { IllegalBookingTransitionError, transitionBookingStatus } from "../services/booking-state.service";
import { transitionRoomStatus } from "../services/room-state.service";
import { createAuditLog } from "../services/audit.service";
import crypto from "crypto";
import { z } from "zod";
import { BookingIdempotency, BookingIdempotencyStatus } from "../models/BookingIdempotency";
import { BookingConflictError, buildBookingRequestHash, reserveInventoryDays } from "../services/booking-safety.service";
import { assertGuestNotBlocked, GuestBlockedError, syncGuestOnBookingCreated } from "../services/guest.service";

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
    const { checkIn, checkOut, adults = 1, children = 0 } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "checkIn and checkOut dates are required" });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

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

      if (availableCount > 0) {
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        available.push({
          ...cat.toObject(),
          availableCount,
          nights,
          totalPrice: cat.basePrice * nights,
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

    // Validate the room can actually receive a NEW guest BEFORE touching the
    // booking at all — previously check-in never looked at the room's
    // status, so a receptionist could check a guest into a room that was
    // under MAINTENANCE or already OCCUPIED by someone else. This is
    // deliberately a stricter, explicit rule ("must be AVAILABLE") rather
    // than the generic isLegalRoomTransition(current, OCCUPIED) check —
    // MAINTENANCE -> OCCUPIED is legal in the transition table because
    // resolving a maintenance ticket must be able to restore a room's PRIOR
    // occupancy, but that is a different operation from checking a brand
    // new guest into a room that merely happens to allow that transition.
    const targetRoom = await Room.findById(roomId);
    if (!targetRoom) return res.status(404).json({ success: false, message: "Room not found" });
    if (targetRoom.status !== RoomStatus.AVAILABLE) {
      return res.status(400).json({
        success: false,
        message: `Room ${targetRoom.roomNumber} is currently ${targetRoom.status} and cannot be checked into`,
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
    await booking.save();

    await transitionRoomStatus(roomId, RoomStatus.OCCUPIED, {
      req,
      action: "room.occupied",
      metadata: { bookingId: booking._id.toString(), bookingReference: booking.bookingReference },
    });

    return res.status(200).json({ success: true, message: "Checked in successfully", data: booking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Check-Out
export const checkOut = async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    try {
      await transitionBookingStatus(booking, BookingStatus.CHECKED_OUT, { req, action: "booking.checked_out" });
    } catch (error) {
      if (error instanceof IllegalBookingTransitionError) {
        return res.status(400).json({ success: false, message: "Guest must be checked in to check out" });
      }
      throw error;
    }
    await booking.save();

    // Mark room as dirty → generate housekeeping task
    if (booking.assignedRoom) {
      await transitionRoomStatus(booking.assignedRoom.toString(), RoomStatus.CLEANING, {
        req,
        action: "room.needs_cleaning",
        metadata: { bookingId: booking._id.toString(), bookingReference: booking.bookingReference },
      }).catch(() => undefined); // room may legitimately already be in a non-OCCUPIED state; don't block checkout on it
      await HousekeepingTask.create({ room: booking.assignedRoom, status: HousekeepingStatus.DIRTY });
    }

    return res.status(200).json({ success: true, message: "Checked out successfully", data: booking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
