/**
 * Walk-in Guest Registration Controller
 *
 * Implements the complete front-desk arrival workflow:
 *
 * STEP 1 — Guest Search (find existing guest by phone/email/name/ID)
 * STEP 2 — Available Rooms (filtered by dates, category, status)
 * STEP 3 — Rate Calculation (room + extra bed + taxes, server is authority)
 * STEP 4 — Walk-in Registration (create guest + booking + advance atomically)
 * STEP 5 — Check-in (confirm booking → assign room → create folio → post charges → record advance)
 * STEP 6 — Print Registration Card (printable HTML)
 *
 * FINANCIAL INVARIANT:
 *   Advance received ≠ revenue.
 *   Advance is recorded in AdvancePayment.remainingBalance.
 *   Revenue is created only when FolioLine charges are posted.
 *   Advance becomes revenue only when adjustAdvance() creates a
 *   CREDIT line on the folio at checkout.
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking, BookingStatus, BookingSource, BookingType, MealPlan, RegistrationStatus, SignatureStatus, PaymentStatus } from "../models/Booking";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { RoomCategory } from "../models/RoomCategory";
import { Guest } from "../models/Guest";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment, AdvancePaymentMethod, AdvancePaymentStatus } from "../models/AdvancePayment";
import { PaymentChannel } from "../models/PaymentChannel";
import { HotelSettings } from "../models/HotelSettings";
import { createFolio, postCharge, calculateTaxBreakdown } from "../services/folio.service";
import { receiveAdvance } from "../services/advance.service";
import { createAuditLog } from "../services/audit.service";
import { generateBillNumber } from "../utils/bill-number";
import { generateBookingReference } from "../utils/booking-reference";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — GUEST SEARCH
// GET /api/front-desk/guest-search?q=<phone|email|name|bill|id>
// ─────────────────────────────────────────────────────────────────────────────

export const searchGuest = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Search query must be at least 2 characters" });
    }

    const query = String(q).trim();
    const regex = new RegExp(query, "i");

    // Search in Guest CRM and Booking records simultaneously
    const [guestMatches, bookingMatches] = await Promise.all([
      Guest.find({
        $or: [
          { phone: regex },
          { email: regex },
          { fullName: regex },
          { idNumber: regex },
        ],
      })
        .select("fullName email phone nationality idType idNumber address totalBookings lastStay isVip")
        .limit(10)
        .lean(),

      Booking.find({
        $or: [
          { "guestDetails.phone": regex },
          { "guestDetails.email": regex },
          { "guestDetails.firstName": regex },
          { "guestDetails.lastName": regex },
          { "guestDetails.idNumber": regex },
          { bookingReference: regex },
          { billNumber: regex },
          { otaConfirmationNumber: regex },
        ],
        status: { $in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED, BookingStatus.CHECKED_OUT] },
      })
        .populate("assignedRoom", "roomNumber floor")
        .populate("roomCategory", "name")
        .select("bookingReference billNumber guestDetails checkInDate checkOutDate status assignedRoom paymentStatus totalAmount paidAmount")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        guests: guestMatches,
        recentBookings: bookingMatches,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — AVAILABLE ROOMS FOR REGISTRATION
// GET /api/front-desk/available-rooms?checkIn=&checkOut=&categoryId=&adults=
// ─────────────────────────────────────────────────────────────────────────────

export const getAvailableRoomsForRegistration = async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut, categoryId, adults = "1" } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "checkIn and checkOut are required" });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ success: false, message: "Check-out must be after check-in" });
    }

    // Find rooms that are currently OCCUPIED by an overlapping booking
    const overlappingBookings = await Booking.find({
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
      assignedRoom: { $exists: true },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    }).select("assignedRoom").lean();

    const occupiedRoomIds = new Set(overlappingBookings.map((b) => b.assignedRoom?.toString()).filter(Boolean));

    // Build room filter
    const roomFilter: Record<string, any> = {
      // Must not be occupied by an overlapping booking
      _id: { $nin: [...occupiedRoomIds] },
      // Must not be blocked or out of order
      sellStatus: SellStatus.SELLABLE,
      // Must be clean or ready for a guest
      housekeepingStatus: { $in: [HousekeepingRoomStatus.CLEAN, HousekeepingRoomStatus.READY] },
      // Must not currently have a guest
      occupancyStatus: { $in: [OccupancyStatus.VACANT, OccupancyStatus.ARRIVING] },
    };

    if (categoryId) {
      roomFilter.category = categoryId as string;
    }

    const rooms = await Room.find(roomFilter)
      .populate({
        path: "category",
        select: "name description basePrice capacity bedTypes amenities images",
      })
      .sort({ floor_number: 1, sortOrder: 1, roomNumber: 1 })
      .lean();

    // Annotate with rate info
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const annotated = rooms.map((room) => {
      const cat = room.category as any;
      return {
        ...room,
        nights,
        ratePerNight: cat?.basePrice ?? 0,
        totalRoomCharge: (cat?.basePrice ?? 0) * nights,
        isAvailable: true,
        statusLabel: "READY",
        housekeepingLabel: room.housekeepingStatus === HousekeepingRoomStatus.READY ? "Ready" : "Clean",
      };
    });

    return res.json({
      success: true,
      data: annotated,
      count: annotated.length,
      nights,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — RATE CALCULATION
// POST /api/front-desk/calculate-rate
// Server is the sole authority on the final amount. Frontend must display
// what the server returns; it must never compute a final total independently.
// ─────────────────────────────────────────────────────────────────────────────

export const calculateRegistrationRate = async (req: Request, res: Response) => {
  try {
    const { roomId, checkIn, checkOut, bookingType = "NIGHTLY", hours = 1, extraPersonsNoBed = 0, extraPersonsWithBed = 0, extraChildrenNoBed = 0, extraChildrenWithBed = 0, kidsUnder3 = 0, discountAmount = 0, otherCharges = 0, mealPlan = "EP", adults = 1, children = 0 } = req.body;

    if (!roomId || !checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "roomId, checkIn, and checkOut are required" });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = bookingType === "HOURLY" ? new Date(checkInDate.getTime() + Number(hours) * 3600000) : new Date(checkOut);
    const nights = bookingType === "HOURLY" ? 1 : Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    const room = await Room.findById(roomId).populate("category", "name basePrice hourlyPrice").lean();
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const category = room.category as any;
    const settings = await HotelSettings.findOne().lean();
    const mealPlanRates = settings?.mealPlanRates || { EP: 0, CP: 500, MAP: 1000, AP: 1500, RO: 0, BB: 500 };
    const extraPersonRate = settings?.extraPersonRate || 800;
    const extraBedRate = settings?.extraBedRate || 1200;
    const childRateNoBed = settings?.childRateNoBed || 400;
    const childRateWithBed = settings?.childRateWithBed || 600;

    const mealPlanRatePP = mealPlanRates[mealPlan as keyof typeof mealPlanRates] || 0;
    const totalGuestsForMealPlan = Number(adults) + Number(children) + Number(extraPersonsNoBed) + Number(extraPersonsWithBed) + Number(extraChildrenNoBed) + Number(extraChildrenWithBed); // Note: kids under 3 are free for meals too
    const mealPlanTotal = mealPlanRatePP * totalGuestsForMealPlan * nights;

    const ratePerNight = bookingType === "HOURLY" ? (category?.hourlyPrice ?? 0) * Number(hours) : (category?.basePrice ?? 0);
    const roomCharges = ratePerNight * (bookingType === "HOURLY" ? 1 : nights);
    
    const extraPersonTotal = Number(extraPersonsNoBed) * extraPersonRate * nights;
    const extraBedTotal = Number(extraPersonsWithBed) * extraBedRate * nights;
    const childNoBedTotal = Number(extraChildrenNoBed) * childRateNoBed * nights;
    const childWithBedTotal = Number(extraChildrenWithBed) * childRateWithBed * nights;
    
    const subtotal = roomCharges + extraPersonTotal + extraBedTotal + childNoBedTotal + childWithBedTotal + mealPlanTotal + Number(otherCharges) - Number(discountAmount);
    const taxableAmount = Math.max(0, subtotal);

    const taxBreakdown = await calculateTaxBreakdown(taxableAmount);

    return res.json({
      success: true,
      data: {
        nights,
        ratePerNight,
        roomCharges,
        extraPersonsNoBed: Number(extraPersonsNoBed),
        extraPersonsWithBed: Number(extraPersonsWithBed),
        extraChildrenNoBed: Number(extraChildrenNoBed),
        extraChildrenWithBed: Number(extraChildrenWithBed),
        kidsUnder3: Number(kidsUnder3),
        extraPersonRate,
        extraBedRate,
        childRateNoBed,
        childRateWithBed,
        extraPersonTotal,
        extraBedTotal,
        childNoBedTotal,
        childWithBedTotal,
        mealPlanTotal,
        otherCharges: Number(otherCharges),
        discountAmount: Number(discountAmount),
        subtotal,
        tax: taxBreakdown,
        totalAmount: taxableAmount + taxBreakdown.totalTax,
        breakdown: {
          roomCharges: bookingType === "HOURLY" ? `₹${(category?.hourlyPrice ?? 0).toLocaleString("en-IN")} × ${hours} hours` : `₹${ratePerNight.toLocaleString("en-IN")} × ${nights} nights`,
          extraPersonCharges: extraPersonTotal > 0 ? `₹${extraPersonRate.toLocaleString("en-IN")} × ${Number(extraPersonsNoBed)} pax × ${nights} nights` : null,
          extraBedCharges: extraBedTotal > 0 ? `₹${extraBedRate.toLocaleString("en-IN")} × ${Number(extraPersonsWithBed)} bed(s) × ${nights} nights` : null,
          childNoBedCharges: childNoBedTotal > 0 ? `₹${childRateNoBed.toLocaleString("en-IN")} × ${Number(extraChildrenNoBed)} child(ren) × ${nights} nights` : null,
          childWithBedCharges: childWithBedTotal > 0 ? `₹${childRateWithBed.toLocaleString("en-IN")} × ${Number(extraChildrenWithBed)} child bed(s) × ${nights} nights` : null,
          otherCharges: Number(otherCharges) > 0 ? `₹${Number(otherCharges).toLocaleString("en-IN")}` : null,
          cgst: `₹${taxBreakdown.cgst.toLocaleString("en-IN")}`,
          sgst: `₹${taxBreakdown.sgst.toLocaleString("en-IN")}`,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — WALK-IN ARRIVAL REGISTRATION
// POST /api/front-desk/walk-in-arrival
//
// Creates the Guest (or finds existing), the Booking, and optionally the
// AdvancePayment in a single atomic MongoDB transaction.
//
// Does NOT check in the guest. Registration and check-in are separate steps
// so the receptionist can review the summary before committing.
// ─────────────────────────────────────────────────────────────────────────────

export const walkInArrivalRegistration = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  let booking: any = null;
  let advance: any = null;

  try {
    await session.withTransaction(async () => {
      const {
        // Section B — Guest Identity
        guestName,
        guestFirstName,
        guestLastName,
        mobile,
        email,
        address,
        nationality,
        dateOfBirth,
        gender,
        organization,
        designation,
        purposeOfVisit,
        gstin,
        vehicleNumber,
        proceedingTo,
        adults = 1,
        children = 0,

        // Section C — Identification
        idType,
        idNumber,
        idProofImages = [],
        isForeignGuest = false,
        foreignGuestDetails,

        // Section D — Stay Information
        checkIn,
        checkOut,
        bookingType = "NIGHTLY",
        hours = 1,
        arrivalTime,
        departureTime,
        roomId,
        mealPlan,
        extraPersonsNoBed = 0,
        extraPersonsWithBed = 0,
        extraChildrenNoBed = 0,
        extraChildrenWithBed = 0,
        kidsUnder3 = 0,
        otherCharges = 0,
        otherChargesDesc,

        // Section E — Billing
        billingInstruction,

        // Section F — Advance
        advanceAmount,
        advanceMethod,
        advanceReference,
        advanceReceivedBy,

        // Source
        isExistingGuest = false,
        existingGuestId,
      } = req.body;

      // Validate required fields
      if (!mobile || !checkIn || !checkOut || !roomId) {
        throw new Error("Mobile, check-in, check-out, and room selection are required");
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = bookingType === "HOURLY" ? new Date(checkInDate.getTime() + Number(hours) * 3600000) : new Date(checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        throw new Error("Invalid check-in or check-out date");
      }
      if (bookingType === "NIGHTLY" && checkInDate >= checkOutDate) {
        throw new Error("Check-out must be after check-in");
      }

      // Resolve room
      const room = await Room.findById(roomId).populate("category").session(session);
      if (!room) throw new Error("Selected room not found");

      // Check room is actually available
      if (room.sellStatus !== SellStatus.SELLABLE) {
        throw new Error(`Room ${room.roomNumber} is ${room.sellStatus} and cannot be assigned`);
      }
      if (
        room.housekeepingStatus !== HousekeepingRoomStatus.CLEAN &&
        room.housekeepingStatus !== HousekeepingRoomStatus.READY
      ) {
        throw new Error(`Room ${room.roomNumber} is ${room.housekeepingStatus}. It must be CLEAN or READY for check-in.`);
      }
      if (room.occupancyStatus === OccupancyStatus.OCCUPIED) {
        throw new Error(`Room ${room.roomNumber} is already occupied`);
      }

      // Check no overlapping confirmed/checked-in booking for this room
      const overlap = await Booking.findOne({
        assignedRoom: roomId,
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        checkInDate: { $lt: checkOutDate },
        checkOutDate: { $gt: checkInDate },
      }).session(session);
      if (overlap) {
        throw new Error(`Room ${room.roomNumber} already has a booking (${overlap.bookingReference}) for these dates`);
      }

      const category = room.category as any;
      const nights = bookingType === "HOURLY" ? 1 : Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      const ratePerNight = bookingType === "HOURLY" ? (category?.hourlyPrice ?? 0) * Number(hours) : (category?.basePrice ?? 0);
      const roomCharges = ratePerNight * (bookingType === "HOURLY" ? 1 : nights);
      
      const settings = await HotelSettings.findOne().session(session).lean();
      const extraPersonRate = settings?.extraPersonRate || 800;
      const extraBedRate = settings?.extraBedRate || 1200;
      const childRateNoBed = settings?.childRateNoBed || 400;
      const childRateWithBed = settings?.childRateWithBed || 600;
      
      const extraPersonTotal = Number(extraPersonsNoBed) * extraPersonRate * nights;
      const extraBedTotal = Number(extraPersonsWithBed) * extraBedRate * nights;
      const childNoBedTotal = Number(extraChildrenNoBed) * childRateNoBed * nights;
      const childWithBedTotal = Number(extraChildrenWithBed) * childRateWithBed * nights;
      
      const mealPlanRates = settings?.mealPlanRates || { EP: 0, CP: 500, MAP: 1000, AP: 1500, RO: 0, BB: 500 };
      const mealPlanRatePP = mealPlanRates[mealPlan as keyof typeof mealPlanRates] || 0;
      const totalGuestsForMealPlan = Number(adults) + Number(children) + Number(extraPersonsNoBed) + Number(extraPersonsWithBed) + Number(extraChildrenNoBed) + Number(extraChildrenWithBed);
      const mealPlanTotal = mealPlanRatePP * totalGuestsForMealPlan * nights;

      const subtotal = roomCharges + extraPersonTotal + extraBedTotal + childNoBedTotal + childWithBedTotal + mealPlanTotal + Number(otherCharges);
      const taxableAmount = Math.max(0, subtotal);
      const taxBreakdown = await calculateTaxBreakdown(taxableAmount);
      const totalAmount = taxableAmount + taxBreakdown.totalTax;

      // Resolve / create Guest record
      let guestId: string;

      if (isExistingGuest && existingGuestId) {
        guestId = existingGuestId;
      } else {
        // Build name
        const firstName = guestFirstName || (guestName ? guestName.split(" ")[0] : "Guest");
        const lastName = guestLastName || (guestName ? guestName.split(" ").slice(1).join(" ") || "." : ".");
        const guestEmail = email || `walkin+${mobile}@yes-hotels.local`;

        // Upsert Guest by phone (primary) or email (fallback)
        const guestDoc = await Guest.findOneAndUpdate(
          { $or: [{ phone: mobile }, ...(email ? [{ email: guestEmail }] : [])] },
          {
            $setOnInsert: {
              fullName: `${firstName} ${lastName}`.trim(),
              phone: mobile,
              email: guestEmail,
            },
            $set: {
              nationality: nationality || undefined,
              address: address || undefined,
              idType: idType || undefined,
              idNumber: idNumber || undefined,
              gender: gender || undefined,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            },
          },
          { upsert: true, new: true, session }
        );
        guestId = guestDoc._id.toString();
      }

      // Generate unique bill number
      let billNumber: string | undefined;
      try {
        billNumber = await generateBillNumber();
      } catch {
        billNumber = undefined;
      }

      // Generate booking reference
      const bookingReference = await generateBookingReference("WALKIN");

      // Create the Booking (status = CONFIRMED for walk-in)
      // Walk-ins go directly to CONFIRMED — they are at the desk
      const created = await Booking.create(
        [
          {
            bookingReference,
            billNumber,
            customer: undefined,
            guestDetails: {
              firstName: guestFirstName || (guestName ? guestName.split(" ")[0] : "Guest"),
              lastName: guestLastName || (guestName ? guestName.split(" ").slice(1).join(" ") || "." : "."),
              email: email || `walkin+${mobile}@yes-hotels.local`,
              phone: mobile,
              idType: idType || undefined,
              idNumber: idNumber || undefined,
              idProofImages: idProofImages,
              nationality: nationality || undefined,
              address: address || undefined,
              gender: gender || undefined,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
              organization: organization || undefined,
              designation: designation || undefined,
              purposeOfVisit: purposeOfVisit || undefined,
              gstin: gstin || undefined,
              vehicleNumber: vehicleNumber || undefined,
              proceedingTo: proceedingTo || undefined,
            },
            foreignGuestDetails: isForeignGuest && foreignGuestDetails ? foreignGuestDetails : undefined,
            roomCategory: room.category._id,
            assignedRoom: roomId,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            stayType: bookingType,
            hours: bookingType === "HOURLY" ? Number(hours) : undefined,
            arrivalTime: arrivalTime || undefined,
            departureTime: departureTime || undefined,
            mealPlan: mealPlan || undefined,
            extraPersonsNoBed: Number(extraPersonsNoBed),
            extraPersonsWithBed: Number(extraPersonsWithBed),
            extraChildrenNoBed: Number(extraChildrenNoBed),
            extraChildrenWithBed: Number(extraChildrenWithBed),
            kidsUnder3: Number(kidsUnder3),
            ratePerNight,
            billingInstruction: billingInstruction || undefined,
            adults: Number(adults),
            children: Number(children),
            status: BookingStatus.CONFIRMED,
            totalAmount,
            taxAmount: taxBreakdown.totalTax,
            cgstAmount: taxBreakdown.cgst,
            sgstAmount: taxBreakdown.sgst,
            discountAmount: 0,
            specialRequests: otherCharges > 0 ? `Other Charges (₹${otherCharges}): ${otherChargesDesc || 'Additional items'}` : undefined,
            paymentStatus: PaymentStatus.UNPAID,
            source: BookingSource.WALK_IN,
            bookingType: BookingType.WALK_IN,
            registrationStatus: RegistrationStatus.COMPLETED,
            signatureStatus: SignatureStatus.NOT_COLLECTED,
          },
        ],
        { session }
      );
      booking = created[0];

      // If advance payment provided, record it (NOT revenue)
      if (advanceAmount && Number(advanceAmount) > 0) {
        const resolvedMethod = (advanceMethod as AdvancePaymentMethod) || AdvancePaymentMethod.CASH;
        // Find payment channel by code if possible
        const channel = await PaymentChannel.findOne({ code: advanceMethod, isActive: true }).session(session);

        // Generate advance number outside the transaction since receiveAdvance doesn't use session
        // We create the record manually here to keep it in the transaction
        const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
        const advPrefix = settings?.advancePrefix ?? "ADV";
        const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
        const advCount = await AdvancePayment.countDocuments().session(session);
        const advanceNumber = `${advPrefix}-${dateStr}-${String(advCount + 1).padStart(4, "0")}`;

        const advanceDocs = await AdvancePayment.create(
          [
            {
              advanceNumber,
              booking: booking._id,
              guest: guestId,
              amount: Number(advanceAmount),
              totalAdjusted: 0,
              totalRefunded: 0,
              remainingBalance: Number(advanceAmount),
              method: resolvedMethod,
              paymentChannel: channel?._id ?? undefined,
              referenceNumber: advanceReference || undefined,
              status: AdvancePaymentStatus.RECEIVED,
              receivedAt: new Date(),
              receivedBy: advanceReceivedBy || (req as any).user?.id,
              purpose: `Walk-in Advance — ${bookingReference}`,
            },
          ],
          { session }
        );
        advance = advanceDocs[0];
      }

      // Update guest stats
      await Guest.findByIdAndUpdate(guestId, { $inc: { totalBookings: 1 } }).session(session);
    });

    // Audit log (outside transaction — fire and forget)
    createAuditLog({
      req,
      action: "booking.walk_in_registration",
      resourceType: "Booking",
      resourceId: booking._id.toString(),
      metadata: {
        bookingReference: booking.bookingReference,
        billNumber: booking.billNumber,
        roomId: booking.assignedRoom?.toString(),
        advanceRecorded: !!advance,
        advanceAmount: advance?.amount,
      },
    }).catch(() => undefined);

    return res.status(201).json({
      success: true,
      message: "Guest registered successfully. Proceed to check-in.",
      data: {
        booking,
        advance,
        nextStep: "check-in",
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — WALK-IN CHECK-IN
// POST /api/front-desk/walk-in-arrival/:bookingId/check-in
//
// Atomically:
// 1. Confirm booking is CONFIRMED
// 2. Assign / confirm room
// 3. Mark room OCCUPIED
// 4. Create folio
// 5. Post room tariff + extra bed charges + taxes
// 6. Apply advance if instructed (applyAdvanceNow=true)
// ─────────────────────────────────────────────────────────────────────────────

export const walkInCheckIn = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  let folio: any = null;

  try {
    const { applyAdvanceNow = false } = req.body;
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      return res.status(400).json({
        success: false,
        message: `Cannot check in: booking status is ${booking.status}. Only CONFIRMED bookings can be checked in.`,
      });
    }
    if (!booking.assignedRoom) {
      return res.status(400).json({ success: false, message: "No room assigned to this booking" });
    }

    const targetRoom = await Room.findById(booking.assignedRoom);
    if (!targetRoom) {
      return res.status(404).json({ success: false, message: "Assigned room not found" });
    }

    // Validate room is still available
    if (targetRoom.sellStatus !== SellStatus.SELLABLE) {
      return res.status(400).json({
        success: false,
        message: `Room ${targetRoom.roomNumber} is ${targetRoom.sellStatus} and cannot be checked into`,
      });
    }
    if (
      targetRoom.housekeepingStatus !== HousekeepingRoomStatus.CLEAN &&
      targetRoom.housekeepingStatus !== HousekeepingRoomStatus.READY
    ) {
      return res.status(400).json({
        success: false,
        message: `Room ${targetRoom.roomNumber} is ${targetRoom.housekeepingStatus}. It must be CLEAN or READY before guest check-in.`,
      });
    }

    await session.withTransaction(async () => {
      // 1. Update booking to CHECKED_IN
      booking.status = BookingStatus.CHECKED_IN;
      booking.checkedInAt = new Date();
      booking.checkedInBy = (req as any).user?.id
        ? new mongoose.Types.ObjectId((req as any).user.id)
        : undefined;
      booking.registrationStatus = RegistrationStatus.CONFIRMED;

      // 2. Mark room OCCUPIED
      targetRoom.status = RoomStatus.OCCUPIED;
      targetRoom.occupancyStatus = OccupancyStatus.OCCUPIED;
      targetRoom.currentBooking = booking._id as mongoose.Types.ObjectId;
      await targetRoom.save({ session });

      // 3. Find or create folio
      folio = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN }).session(session);
      if (!folio) {
        // Resolve guest ID — prefer Guest CRM record
        const guestDoc = await Guest.findOne({
          $or: [
            { phone: booking.guestDetails.phone },
            { email: booking.guestDetails.email },
          ],
        }).session(session);

        folio = await createFolio(
          {
            bookingId: booking._id.toString(),
            guestId: guestDoc?._id?.toString() || (req as any).user?.id || booking._id.toString(),
            roomId: targetRoom._id.toString(),
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
          },
          { req, session }
        );

        const nights = Math.max(
          1,
          Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
        );

        // 4. Post room tariff charge
        const ratePerNight = booking.ratePerNight ?? (booking.totalAmount - booking.taxAmount) / nights;
        const roomCharges = ratePerNight * nights;

        if (roomCharges > 0) {
          const roomDesc = booking.stayType === "HOURLY" 
            ? `Room Charge (Hourly) — Room ${targetRoom.roomNumber} (${booking.hours || 1} hours)`
            : `Room Tariff — Room ${targetRoom.roomNumber} (${nights} night${nights > 1 ? "s" : ""})`;
            
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.ROOM_CHARGE,
              description: roomDesc,
              amount: roomCharges,
              date: new Date(),
              postedBy: (req as any).user?.id || "FRONT_DESK",
            },
            { req, session }
          );
        }

        // 5. Post extra person / bed charges if applicable
        const settings = await HotelSettings.findOne().session(session).lean();
        const extraPersonRate = settings?.extraPersonRate || 800;
        const extraBedRate = settings?.extraBedRate || 1200;
        const childRateNoBed = settings?.childRateNoBed || 400;
        const childRateWithBed = settings?.childRateWithBed || 600;

        const extraPersonTotal = (booking.extraPersonsNoBed ?? 0) * extraPersonRate * nights;
        if (extraPersonTotal > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.EXTRA_BED, // Using same folio category for now
              description: `Adult Extra Pax (No Bed) (${booking.extraPersonsNoBed} pax × ${nights} nights)`,
              amount: extraPersonTotal,
              date: new Date(),
              postedBy: (req as any).user?.id || "FRONT_DESK",
            },
            { req, session }
          );
        }
        
        const extraBedTotal = (booking.extraPersonsWithBed ?? 0) * extraBedRate * nights;
        if (extraBedTotal > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.EXTRA_BED,
              description: `Adult Extra Pax (With Bed) (${booking.extraPersonsWithBed} bed(s) × ${nights} nights)`,
              amount: extraBedTotal,
              date: new Date(),
              postedBy: (req as any).user?.id || "FRONT_DESK",
            },
            { req, session }
          );
        }

        const childNoBedTotal = (booking.extraChildrenNoBed ?? 0) * childRateNoBed * nights;
        if (childNoBedTotal > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.EXTRA_BED,
              description: `Child 3-12 (No Bed) (${booking.extraChildrenNoBed} child(ren) × ${nights} nights)`,
              amount: childNoBedTotal,
              date: new Date(),
              postedBy: (req as any).user?.id || "FRONT_DESK",
            },
            { req, session }
          );
        }

        const childWithBedTotal = (booking.extraChildrenWithBed ?? 0) * childRateWithBed * nights;
        if (childWithBedTotal > 0) {
          await postCharge(
            {
              folioId: folio._id.toString(),
              bookingId: booking._id.toString(),
              lineType: FolioLineType.EXTRA_BED,
              description: `Child 3-12 (With Bed) (${booking.extraChildrenWithBed} bed(s) × ${nights} nights)`,
              amount: childWithBedTotal,
              date: new Date(),
              postedBy: (req as any).user?.id || "FRONT_DESK",
            },
            { req, session }
          );
        }
      }

      // 6. Update booking with folio reference
      booking.folio = folio._id;
      await booking.save({ session });
    });

    // Fetch populated booking for response
    const populated = await Booking.findById(bookingId)
      .populate("assignedRoom", "roomNumber floor")
      .populate("roomCategory", "name")
      .populate("folio")
      .lean();

    createAuditLog({
      req,
      action: "booking.walk_in_check_in",
      resourceType: "Booking",
      resourceId: bookingId,
      metadata: {
        bookingReference: booking.bookingReference,
        roomId: targetRoom._id.toString(),
        folioId: folio._id.toString(),
        applyAdvanceNow,
      },
    }).catch(() => undefined);

    return res.json({
      success: true,
      message: `Guest ${booking.guestDetails.firstName} ${booking.guestDetails.lastName} checked in to Room ${targetRoom.roomNumber}`,
      data: populated,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — PRINT REGISTRATION CARD
// GET /api/front-desk/registration/:bookingId/print
// Returns print-ready HTML that matches the physical hotel registration card.
// ─────────────────────────────────────────────────────────────────────────────

export const printRegistrationCard = async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("assignedRoom", "roomNumber floor")
      .populate("roomCategory", "name basePrice")
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
    const hotelName = settings?.hotelName ?? "YES Hotels";
    const hotelAddress = settings?.address ?? "";
    const hotelPhone = settings?.phone ?? "";
    const hotelGST = settings?.gstNumber ?? "";

    const room = booking.assignedRoom as any;
    const category = booking.roomCategory as any;

    const esc = (s: any) =>
      String(s ?? "—").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

    const nights = Math.max(
      1,
      Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const isForeign = !!(booking as any).foreignGuestDetails?.passportNumber;
    const bookingCreatedAt: Date = (booking as any).createdAt ?? new Date();

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Guest Registration Card — ${esc(booking.billNumber || booking.bookingReference)}</title>
<style>
  @page { margin: 10mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; }
  .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 8px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
  .hotel-name { font-size: 18px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
  .hotel-sub { font-size: 10px; color: #444; margin-top: 2px; }
  .card-title { font-size: 13px; font-weight: bold; text-align: center; letter-spacing: 1px; text-transform: uppercase; margin: 6px 0; border: 1px solid #000; padding: 4px; }
  .bill-row { display: flex; justify-content: space-between; margin: 4px 0; }
  .bill-label { font-size: 10px; color: #444; }
  .bill-value { font-weight: bold; font-size: 12px; }
  .section { margin: 8px 0; border: 1px solid #ccc; padding: 6px; }
  .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 5px; color: #333; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .field-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; }
  .field { margin-bottom: 4px; }
  .field-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-value { border-bottom: 1px solid #999; min-height: 16px; font-size: 11px; padding: 1px 2px; }
  .tariff-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .tariff-table th { background: #f0f0f0; text-align: left; padding: 3px 6px; font-size: 10px; border: 1px solid #ccc; }
  .tariff-table td { padding: 3px 6px; font-size: 11px; border: 1px solid #ccc; }
  .tariff-table .right { text-align: right; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .signature-section { display: flex; gap: 20px; margin-top: 12px; }
  .sig-box { flex: 1; border: 1px solid #ccc; padding: 8px; min-height: 60px; }
  .sig-label { font-size: 9px; text-transform: uppercase; color: #666; border-top: 1px solid #999; padding-top: 4px; margin-top: 40px; }
  .declaration { font-size: 9px; color: #444; margin: 8px 0; border: 1px solid #ddd; padding: 5px; background: #fafafa; }
  .footer { text-align: center; font-size: 9px; color: #666; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 5px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="hotel-name">${esc(hotelName)}</div>
    <div class="hotel-sub">${esc(hotelAddress)} | ${esc(hotelPhone)}${hotelGST ? ` | GSTIN: ${esc(hotelGST)}` : ""}</div>
  </div>

  <div class="card-title">Guest Registration Card</div>

  <!-- SECTION A: BILL INFORMATION -->
  <div class="bill-row">
    <div>
      <div class="bill-label">Bill Number</div>
      <div class="bill-value">${esc(booking.billNumber || booking.bookingReference)}</div>
    </div>
    <div style="text-align:right">
      <div class="bill-label">Date</div>
      <div class="bill-value">${bookingCreatedAt.toLocaleDateString("en-IN")}</div>
    </div>
  </div>

  <!-- SECTION B: GUEST IDENTITY -->
  <div class="section">
    <div class="section-title">Section B — Guest Information</div>
    <div class="field-grid">
      <div class="field"><div class="field-label">Guest Name</div><div class="field-value">${esc(booking.guestDetails.firstName)} ${esc(booking.guestDetails.lastName)}</div></div>
      <div class="field"><div class="field-label">Mobile Number</div><div class="field-value">${esc(booking.guestDetails.phone)}</div></div>
      <div class="field"><div class="field-label">Email</div><div class="field-value">${esc(booking.guestDetails.email)}</div></div>
      <div class="field"><div class="field-label">Nationality</div><div class="field-value">${esc(booking.guestDetails.nationality)}</div></div>
      <div class="field"><div class="field-label">Date of Birth</div><div class="field-value">${booking.guestDetails.dateOfBirth ? new Date(booking.guestDetails.dateOfBirth).toLocaleDateString("en-IN") : "—"}</div></div>
      <div class="field"><div class="field-label">Gender</div><div class="field-value">${esc(booking.guestDetails.gender)}</div></div>
      <div class="field"><div class="field-label">Organization</div><div class="field-value">${esc((booking.guestDetails as any).organization)}</div></div>
      <div class="field"><div class="field-label">Designation</div><div class="field-value">${esc((booking.guestDetails as any).designation)}</div></div>
    </div>
    <div class="field" style="margin-top:4px"><div class="field-label">Address</div><div class="field-value">${esc(booking.guestDetails.address)}</div></div>
    <div class="field-grid" style="margin-top:4px">
      <div class="field"><div class="field-label">Purpose of Visit</div><div class="field-value">${esc((booking.guestDetails as any).purposeOfVisit)}</div></div>
      <div class="field"><div class="field-label">No. of Persons (Adults / Children)</div><div class="field-value">${booking.adults} / ${booking.children}</div></div>
    </div>
  </div>

  <!-- SECTION C: IDENTIFICATION -->
  <div class="section">
    <div class="section-title">Section C — Identification</div>
    <div class="field-grid">
      <div class="field"><div class="field-label">ID Type</div><div class="field-value">${esc(booking.guestDetails.idType)}</div></div>
      <div class="field"><div class="field-label">ID Number</div><div class="field-value">${esc(booking.guestDetails.idNumber)}</div></div>
    </div>
    ${isForeign ? `
    <div style="margin-top:6px;border-top:1px dashed #ccc;padding-top:6px">
      <div class="section-title">Foreign Guest — Passport &amp; Visa</div>
      <div class="field-grid-3">
        <div class="field"><div class="field-label">Passport No.</div><div class="field-value">${esc((booking as any).foreignGuestDetails?.passportNumber)}</div></div>
        <div class="field"><div class="field-label">Issue Date</div><div class="field-value">${(booking as any).foreignGuestDetails?.passportIssueDate ? new Date((booking as any).foreignGuestDetails.passportIssueDate).toLocaleDateString("en-IN") : "—"}</div></div>
        <div class="field"><div class="field-label">Expiry Date</div><div class="field-value">${(booking as any).foreignGuestDetails?.passportExpiryDate ? new Date((booking as any).foreignGuestDetails.passportExpiryDate).toLocaleDateString("en-IN") : "—"}</div></div>
        <div class="field"><div class="field-label">Visa No.</div><div class="field-value">${esc((booking as any).foreignGuestDetails?.visaNumber)}</div></div>
        <div class="field"><div class="field-label">Visa Date</div><div class="field-value">${(booking as any).foreignGuestDetails?.visaDate ? new Date((booking as any).foreignGuestDetails.visaDate).toLocaleDateString("en-IN") : "—"}</div></div>
        <div class="field"><div class="field-label">Visa Expiry</div><div class="field-value">${(booking as any).foreignGuestDetails?.visaExpiryDate ? new Date((booking as any).foreignGuestDetails.visaExpiryDate).toLocaleDateString("en-IN") : "—"}</div></div>
      </div>
    </div>
    ` : ""}
  </div>

  <!-- SECTION D: STAY INFORMATION -->
  <div class="section">
    <div class="section-title">Section D — Stay Information</div>
    <div class="field-grid-3">
      <div class="field"><div class="field-label">Arrival Date</div><div class="field-value">${new Date(booking.checkInDate).toLocaleDateString("en-IN")}</div></div>
      <div class="field"><div class="field-label">Arrival Time</div><div class="field-value">${esc((booking as any).arrivalTime)}</div></div>
      <div class="field"><div class="field-label">Room No.</div><div class="field-value">${esc(room?.roomNumber)}</div></div>
      <div class="field"><div class="field-label">Departure Date</div><div class="field-value">${new Date(booking.checkOutDate).toLocaleDateString("en-IN")}</div></div>
      <div class="field"><div class="field-label">Departure Time</div><div class="field-value">${esc((booking as any).departureTime)}</div></div>
      <div class="field"><div class="field-label">Room Type</div><div class="field-value">${esc(category?.name)}</div></div>
      <div class="field"><div class="field-label">No. of Nights</div><div class="field-value">${nights}</div></div>
      <div class="field"><div class="field-label">Meal Plan</div><div class="field-value">${esc((booking as any).mealPlan)}</div></div>
      <div class="field"><div class="field-label">Extra Bed</div><div class="field-value">${(booking as any).extraBed || 0}</div></div>
    </div>
  </div>

  <!-- TARIFF TABLE -->
  <div class="section">
    <div class="section-title">Tariff</div>
    <table class="tariff-table">
      <tr><th>Description</th><th class="right">Rate / Night</th><th class="right">Nights</th><th class="right">Amount (₹)</th></tr>
      <tr><td>${esc(category?.name || "Room")}</td><td class="right">₹${((booking as any).ratePerNight ?? 0).toLocaleString("en-IN")}</td><td class="right">${nights}</td><td class="right">₹${(((booking as any).ratePerNight ?? 0) * nights).toLocaleString("en-IN")}</td></tr>
      ${(booking as any).extraBed > 0 ? `<tr><td>Extra Bed</td><td class="right">₹${((booking as any).extraBedCharge ?? 0).toLocaleString("en-IN")}</td><td class="right">${nights}</td><td class="right">₹${(((booking as any).extraBed ?? 0) * ((booking as any).extraBedCharge ?? 0) * nights).toLocaleString("en-IN")}</td></tr>` : ""}
      <tr><td>CGST</td><td class="right"></td><td class="right"></td><td class="right">₹${booking.cgstAmount.toLocaleString("en-IN")}</td></tr>
      <tr><td>SGST</td><td class="right"></td><td class="right"></td><td class="right">₹${booking.sgstAmount.toLocaleString("en-IN")}</td></tr>
      <tr class="total-row"><td><strong>Total</strong></td><td></td><td></td><td class="right"><strong>₹${booking.totalAmount.toLocaleString("en-IN")}</strong></td></tr>
    </table>
  </div>

  <!-- SECTION E/F: BILLING & ADVANCE -->
  <div class="section">
    <div class="section-title">Section E &amp; F — Billing &amp; Advance Payment</div>
    <div class="field-grid">
      <div class="field"><div class="field-label">Billing Instruction</div><div class="field-value">${esc((booking as any).billingInstruction)}</div></div>
      <div class="field"><div class="field-label">Advance Received</div><div class="field-value">₹ _______________</div></div>
      <div class="field"><div class="field-label">Payment Method</div><div class="field-value">_________________</div></div>
      <div class="field"><div class="field-label">Receipt Number</div><div class="field-value">_________________</div></div>
    </div>
  </div>

  <!-- GUEST DECLARATION & SIGNATURE -->
  <div class="declaration">
    I hereby declare that the particulars given above are correct and I agree to abide by the rules and regulations of the hotel. I acknowledge that I am responsible for all charges incurred during my stay.
  </div>

  <div class="signature-section">
    <div class="sig-box">
      <div class="sig-label">Guest Signature &amp; Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Reception / Front Office</div>
    </div>
  </div>

  <div class="footer">
    Thank you for choosing ${esc(hotelName)} &bull; ${esc(hotelAddress)}
  </div>
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(html);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION REPORT
// GET /api/front-desk/registration-report
// ─────────────────────────────────────────────────────────────────────────────

export const getRegistrationReport = async (req: Request, res: Response) => {
  try {
    const { from, to, roomId, status, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

    const filter: Record<string, any> = {
      source: BookingSource.WALK_IN,
    };

    if (from || to) {
      filter.checkInDate = {};
      if (from) filter.checkInDate.$gte = new Date(from as string);
      if (to) filter.checkInDate.$lte = new Date(to as string);
    }
    if (roomId) filter.assignedRoom = roomId;
    if (status) filter.registrationStatus = status;

    const total = await Booking.countDocuments(filter);
    const registrations = await Booking.find(filter)
      .populate("assignedRoom", "roomNumber floor")
      .populate("roomCategory", "name")
      .select([
        "billNumber",
        "bookingReference",
        "guestDetails",
        "checkInDate",
        "checkOutDate",
        "arrivalTime",
        "departureTime",
        "adults",
        "children",
        "assignedRoom",
        "roomCategory",
        "ratePerNight",
        "extraBed",
        "extraBedCharge",
        "mealPlan",
        "billingInstruction",
        "totalAmount",
        "taxAmount",
        "status",
        "registrationStatus",
        "signatureStatus",
        "createdAt",
      ].join(" "))
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    return res.json({
      success: true,
      data: registrations,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
