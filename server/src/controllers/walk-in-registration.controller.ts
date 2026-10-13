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
import { Property } from "../models/Property";
import { User, UserRole } from "../models/User";
import { createFolio, postCharge } from "../services/folio.service";
import { claimRoomNights, RoomUnavailableError } from "../services/room-nights.service";
import { computeRoomTax, loadGstRules } from "../services/tax.service";

/**
 * Room GST for a walk-in: each room is taxed on its own per-night value (which
 * selects the slab), per night of the stay, and the results are summed.
 */
async function walkInStayTax(perRoomTaxable: number[], checkIn: Date, checkOut: Date, chargedNights: number) {
  const rules = await loadGstRules();
  const parts = perRoomTaxable.map((v) =>
    computeRoomTax(rules, { checkIn, checkOut, nightlyValue: Math.max(0, v) / Math.max(1, chargedNights) }),
  );
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cgst = r2(parts.reduce((s, p) => s + p.cgst, 0));
  const sgst = r2(parts.reduce((s, p) => s + p.sgst, 0));
  // Per night (all rooms together), for day-by-day schedules on the GRC / invoice.
  const byDate = new Map<string, { date: string; taxable: number; cgst: number; sgst: number; rates: Set<number> }>();
  for (const l of parts.flatMap((p) => p.lines)) {
    const d = byDate.get(l.date) ?? { date: l.date, taxable: 0, cgst: 0, sgst: 0, rates: new Set<number>() };
    d.taxable += l.taxable; d.cgst += l.cgst; d.sgst += l.sgst; d.rates.add(l.rate);
    byDate.set(l.date, d);
  }
  const daily = [...byDate.values()].map((d) => ({ date: d.date, taxable: r2(d.taxable), cgst: r2(d.cgst), sgst: r2(d.sgst), rates: [...d.rates] }));
  return { cgst, sgst, totalTax: r2(cgst + sgst), daily };
}
import { receiveAdvance } from "../services/advance.service";
import { createAuditLog } from "../services/audit.service";
import { generateBillNumber } from "../utils/bill-number";
import { generateBookingReference } from "../utils/booking-reference";
import crypto from "crypto";
import { nights as countNights, todayBusinessDate } from "../../../shared/dates";

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
    const nights = Math.max(1, countNights(checkInDate, checkOutDate));
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
    const {
      roomId,
      roomIds = [],
      checkIn,
      checkOut,
      bookingType = "NIGHTLY",
      hours = 1,
      extraPersonsNoBed = 0,
      extraPersonsWithBed = 0,
      extraChildrenNoBed = 0,
      extraChildrenWithBed = 0,
      kidsUnder3 = 0,
      discountAmount = 0,
      otherCharges = 0,
      mealPlan = "EP",
      adults = 1,
      children = 0,
      rateOverrideAmount,
    } = req.body;

    const allRoomIds: string[] = (Array.isArray(roomIds) && roomIds.length > 0)
      ? roomIds.map(String)
      : (roomId ? [String(roomId)] : []);

    if (allRoomIds.length === 0 || !checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "At least one roomId, checkIn, and checkOut are required" });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = bookingType === "HOURLY" ? new Date(checkInDate.getTime() + Number(hours) * 3600000) : new Date(checkOut);
    const nights = bookingType === "HOURLY" ? 1 : Math.max(1, countNights(checkInDate, checkOutDate));

    const rooms = await Room.find({ _id: { $in: allRoomIds } }).populate("category", "name basePrice hourlyPrice").lean();
    if (rooms.length === 0) return res.status(404).json({ success: false, message: "No matching rooms found" });

    const settings = await HotelSettings.findOne().lean();
    const mealPlanRates = settings?.mealPlanRates || { EP: 0, CP: 500, MAP: 1000, AP: 1500, RO: 0, BB: 500 };
    const extraPersonRate = settings?.extraPersonRate || 800;
    const extraBedRate = settings?.extraBedRate || 1200;
    const childRateNoBed = settings?.childRateNoBed || 400;
    const childRateWithBed = settings?.childRateWithBed || 600;

    const mealPlanRatePP = mealPlanRates[mealPlan as keyof typeof mealPlanRates] || 0;
    const totalGuestsForMealPlan = Number(adults) + Number(children) + Number(extraPersonsNoBed) + Number(extraPersonsWithBed) + Number(extraChildrenNoBed) + Number(extraChildrenWithBed);
    const mealPlanTotal = mealPlanRatePP * totalGuestsForMealPlan * nights;

    // Calculate room charges across all selected rooms
    let totalRoomCharges = 0;
    const roomBreakdowns = rooms.map(rm => {
      const cat = rm.category as any;
      const baseRatePerNight = bookingType === "HOURLY" ? (cat?.hourlyPrice ?? 0) * Number(hours) : (cat?.basePrice ?? 0);
      const rmRatePerNight = rateOverrideAmount !== undefined && rateOverrideAmount !== null && Number(rateOverrideAmount) > 0 
        ? Number(rateOverrideAmount) 
        : baseRatePerNight;
      const cost = rmRatePerNight * (bookingType === "HOURLY" ? 1 : nights);
      totalRoomCharges += cost;
      return {
        roomId: rm._id,
        roomNumber: rm.roomNumber,
        categoryName: cat?.name || "Suite",
        ratePerNight: rmRatePerNight,
        cost,
      };
    });

    const averageRatePerNight = roomBreakdowns.length > 0 ? Math.round(totalRoomCharges / (roomBreakdowns.length * (bookingType === "HOURLY" ? 1 : nights))) : 0;
    const roomCharges = totalRoomCharges;
    
    const extraPersonTotal = Number(extraPersonsNoBed) * extraPersonRate * nights;
    const extraBedTotal = Number(extraPersonsWithBed) * extraBedRate * nights;
    const childNoBedTotal = Number(extraChildrenNoBed) * childRateNoBed * nights;
    const childWithBedTotal = Number(extraChildrenWithBed) * childRateWithBed * nights;
    
    const subtotal = roomCharges + extraPersonTotal + extraBedTotal + childNoBedTotal + childWithBedTotal + mealPlanTotal + Number(otherCharges) - Number(discountAmount);
    const taxableAmount = Math.max(0, subtotal);

    // Extras, meal plan, other charges and the discount sit on the primary room (as on create).
    const primaryAdjustment = taxableAmount - roomCharges;
    const taxBreakdown = await walkInStayTax(
      roomBreakdowns.length
        ? roomBreakdowns.map((rb: any, i: number) => rb.cost + (i === 0 ? primaryAdjustment : 0))
        : [taxableAmount],
      checkInDate,
      checkOutDate,
      nights,
    );

    return res.json({
      success: true,
      data: {
        nights,
        roomCount: rooms.length,
        rooms: roomBreakdowns,
        ratePerNight: averageRatePerNight,
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
        dailyTax: taxBreakdown.daily,
        totalAmount: taxableAmount + taxBreakdown.totalTax,
        breakdown: {
          roomCharges: bookingType === "HOURLY" ? `₹${averageRatePerNight.toLocaleString("en-IN")} × ${hours} hours` : `₹${averageRatePerNight.toLocaleString("en-IN")} × ${nights} nights (${rooms.length} rooms)`,
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
  let createdBookings: any[] = [];

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
        roomIds = [],
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
        rateOverrideAmount,

        // Source
        isExistingGuest = false,
        existingGuestId,
      } = req.body;

      const allRoomIds: string[] = (Array.isArray(roomIds) && roomIds.length > 0)
        ? roomIds.map(String)
        : (roomId ? [String(roomId)] : []);

      // Validate required fields
      if (!mobile || !checkIn || !checkOut || allRoomIds.length === 0) {
        throw new Error("Mobile, check-in, check-out, and at least one room selection are required");
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = bookingType === "HOURLY" ? new Date(checkInDate.getTime() + Number(hours) * 3600000) : new Date(checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        throw new Error("Invalid check-in or check-out date");
      }
      if (bookingType === "NIGHTLY" && checkInDate >= checkOutDate) {
        throw new Error("Check-out must be after check-in");
      }

      // Resolve rooms
      const rooms = await Room.find({ _id: { $in: allRoomIds } }).populate("category").session(session);
      if (rooms.length !== allRoomIds.length) {
        throw new Error(`Only ${rooms.length} of ${allRoomIds.length} selected rooms could be found`);
      }

      // Resolve property
      let propertyId = (req as any).propertyId || rooms[0].propertyId;
      if (!propertyId) {
        const defaultProp = await Property.findOne().session(session).lean();
        propertyId = defaultProp?._id;
      }

      // Check each room is actually available and ready
      for (const rm of rooms) {
        if (rm.sellStatus !== SellStatus.SELLABLE) {
          throw new Error(`Room ${rm.roomNumber} is ${rm.sellStatus} and cannot be assigned`);
        }
        if (
          rm.housekeepingStatus !== HousekeepingRoomStatus.CLEAN &&
          rm.housekeepingStatus !== HousekeepingRoomStatus.READY
        ) {
          throw new Error(`Room ${rm.roomNumber} is ${rm.housekeepingStatus}. It must be CLEAN or READY for check-in.`);
        }
        if (rm.occupancyStatus === OccupancyStatus.OCCUPIED) {
          throw new Error(`Room ${rm.roomNumber} is already occupied`);
        }

        const overlap = await Booking.findOne({
          assignedRoom: rm._id,
          status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          checkInDate: { $lt: checkOutDate },
          checkOutDate: { $gt: checkInDate },
        }).session(session);
        if (overlap) {
          throw new Error(`Room ${rm.roomNumber} already has a booking (${overlap.bookingReference}) for these dates`);
        }
      }

      // Resolve / create Guest record
      let guestId: string;
      if (isExistingGuest && existingGuestId) {
        guestId = existingGuestId;
      } else {
        const firstName = guestFirstName || (guestName ? guestName.split(" ")[0] : "Guest");
        const lastName = guestLastName || (guestName ? guestName.split(" ").slice(1).join(" ") || "." : ".");
        const guestEmail = email || `walkin+${mobile}@yes-hotels.local`;

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

      const nights = bookingType === "HOURLY" ? 1 : Math.max(1, countNights(checkInDate, checkOutDate));
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

      // Group ID for linking multiple rooms
      const groupId = rooms.length > 1 ? new mongoose.Types.ObjectId() : undefined;
      createdBookings = [];

      for (let i = 0; i < rooms.length; i++) {
        const rm = rooms[i];
        const category = rm.category as any;
        const baseRatePerNight = bookingType === "HOURLY" ? (category?.hourlyPrice ?? 0) * Number(hours) : (category?.basePrice ?? 0);
        const rmRatePerNight = rateOverrideAmount !== undefined && rateOverrideAmount !== null && Number(rateOverrideAmount) > 0 ? Number(rateOverrideAmount) : baseRatePerNight;
        const rmRoomCharges = rmRatePerNight * (bookingType === "HOURLY" ? 1 : nights);

        // Put extra guest charges on the primary room (first room)
        const rmExtraPersonTotal = i === 0 ? extraPersonTotal : 0;
        const rmExtraBedTotal = i === 0 ? extraBedTotal : 0;
        const rmChildNoBedTotal = i === 0 ? childNoBedTotal : 0;
        const rmChildWithBedTotal = i === 0 ? childWithBedTotal : 0;
        const rmMealPlanTotal = i === 0 ? mealPlanTotal : 0;
        const rmOtherCharges = i === 0 ? Number(otherCharges) : 0;

        const rmSubtotal = rmRoomCharges + rmExtraPersonTotal + rmExtraBedTotal + rmChildNoBedTotal + rmChildWithBedTotal + rmMealPlanTotal + rmOtherCharges;
        const rmTaxableAmount = Math.max(0, rmSubtotal);
        const rmTaxBreakdown = await walkInStayTax([rmTaxableAmount], checkInDate, checkOutDate, nights);
        const rmTotalAmount = rmTaxableAmount + rmTaxBreakdown.totalTax;

        let billNumber: string | undefined;
        try {
          billNumber = await generateBillNumber(session);
        } catch {
          billNumber = `BILL-${todayBusinessDate().slice(0, 4)}-${Date.now().toString().slice(-6)}`;
        }

        const bookingReference = await generateBookingReference("WALKIN", session);

        const created = await Booking.create(
          [
            {
              propertyId,
              groupId,
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
              roomCategory: rm.category._id,
              assignedRoom: rm._id,
              checkInDate: checkInDate,
              checkOutDate: checkOutDate,
              stayType: bookingType,
              hours: bookingType === "HOURLY" ? Number(hours) : undefined,
              arrivalTime: arrivalTime || undefined,
              departureTime: departureTime || undefined,
              mealPlan: mealPlan || undefined,
              extraPersonsNoBed: i === 0 ? Number(extraPersonsNoBed) : 0,
              extraPersonsWithBed: i === 0 ? Number(extraPersonsWithBed) : 0,
              extraChildrenNoBed: i === 0 ? Number(extraChildrenNoBed) : 0,
              extraChildrenWithBed: i === 0 ? Number(extraChildrenWithBed) : 0,
              kidsUnder3: i === 0 ? Number(kidsUnder3) : 0,
              ratePerNight: rmRatePerNight,
              billingInstruction: billingInstruction || undefined,
              adults: i === 0 ? Number(adults) : 1,
              children: i === 0 ? Number(children) : 0,
              status: BookingStatus.CHECKED_IN,
              checkedInAt: new Date(),
              checkedInBy: (req as any).user?.id ? new mongoose.Types.ObjectId((req as any).user.id) : undefined,
              totalAmount: rmTotalAmount,
              taxAmount: rmTaxBreakdown.totalTax,
              cgstAmount: rmTaxBreakdown.cgst,
              sgstAmount: rmTaxBreakdown.sgst,
              discountAmount: 0,
              specialRequests: (i === 0 && otherCharges > 0) ? `Other Charges (₹${otherCharges}): ${otherChargesDesc || 'Additional items'}` : undefined,
              paymentStatus: PaymentStatus.UNPAID,
              source: BookingSource.WALK_IN,
              bookingType: rooms.length > 1 ? BookingType.GROUP : BookingType.WALK_IN,
              registrationStatus: RegistrationStatus.CONFIRMED,
              signatureStatus: SignatureStatus.NOT_COLLECTED,
            },
          ],
          { session }
        );
        // Hold the room-nights (unique room + night): the overlap query above is a fast check;
        // this insert is what makes a concurrent double booking impossible.
        await claimRoomNights({ bookingId: created[0]._id as any, roomId: rm._id as any, checkIn: checkInDate, checkOut: checkOutDate, propertyId: propertyId as any, session });
        createdBookings.push(created[0]);

        // Mark assigned room OCCUPIED immediately for walk-in arrivals
        rm.status = RoomStatus.OCCUPIED;
        rm.occupancyStatus = OccupancyStatus.OCCUPIED;
        rm.currentBooking = created[0]._id as mongoose.Types.ObjectId;
        await rm.save({ session });
      }

      booking = createdBookings[0];

      // If advance payment provided, record it on the primary booking (or folio)
      if (advanceAmount && Number(advanceAmount) > 0) {
        const resolvedMethod = (advanceMethod as AdvancePaymentMethod) || AdvancePaymentMethod.CASH;
        const channel = await PaymentChannel.findOne({ code: advanceMethod, isActive: true }).session(session);

        const settings = await HotelSettings.findOne().sort({ updatedAt: -1 }).lean();
        const advPrefix = settings?.advancePrefix ?? "ADV";
        const dateStr = todayBusinessDate().slice(0, 7).replace("-", ""); // YYYYMM at the property
        const advCount = await AdvancePayment.countDocuments().session(session);
        const advanceNumber = `${advPrefix}-${dateStr}-${String(advCount + 1).padStart(4, "0")}`;

        let resolvedReceivedBy = advanceReceivedBy || (req as any).user?.id || (req as any).user?._id;
        if (!resolvedReceivedBy || !mongoose.isValidObjectId(resolvedReceivedBy)) {
          const adminUser = await User.findOne({ role: { $in: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN] } }).session(session).lean();
          resolvedReceivedBy = adminUser?._id;
        }

        const advanceDocs = await AdvancePayment.create(
          [
            {
              propertyId,
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
              receivedBy: resolvedReceivedBy,
              purpose: `Walk-in Advance — ${booking.bookingReference}${rooms.length > 1 ? ` (${rooms.length} Rooms)` : ''}`,
            },
          ],
          { session }
        );
        advance = advanceDocs[0];
      }

      // Pre-create OPEN Folios for all created bookings
      for (const cb of createdBookings) {
        try {
          const f = await createFolio(
            {
              bookingId: cb._id.toString(),
              guestId: guestId.toString(),
              roomId: cb.assignedRoom?.toString(),
              checkInDate: cb.checkInDate,
              checkOutDate: cb.checkOutDate,
            },
            { req, session }
          );

          // Post initial room charge for stay
          await postCharge(
            {
              folioId: f._id.toString(),
              bookingId: cb._id.toString(),
              lineType: FolioLineType.ROOM_CHARGE,
              description: `Room Charge (${cb.bookingReference})`,
              amount: cb.ratePerNight,
              date: new Date(),
              postedBy: (req as any).user?.id || (req as any).user?._id || "SYSTEM",
            },
            { req, session }
          );

          if (cb._id.toString() === booking._id.toString() && advanceAmount && Number(advanceAmount) > 0) {
            await postCharge(
              {
                folioId: f._id.toString(),
                bookingId: cb._id.toString(),
                lineType: FolioLineType.ADVANCE_ADJUSTMENT,
                description: `Advance Payment Received (${advanceMethod || "CASH"})`,
                amount: Number(advanceAmount),
                advancePaymentId: advance?._id?.toString(),
                date: new Date(),
                postedBy: (req as any).user?.id || (req as any).user?._id || "SYSTEM",
              },
              { req, session }
            );
          }
        } catch (fErr) {
          console.error("Error initializing folio during walk-in registration:", fErr);
        }
      }

      // Update guest stats
      const walkInGrandTotal = createdBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      await Guest.findByIdAndUpdate(guestId, {
        $inc: { totalBookings: rooms.length, totalSpend: walkInGrandTotal },
        $set: { lastStay: checkOutDate },
      }).session(session);
    });

    // Audit log
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
        bookings: createdBookings,
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
          countNights(new Date(booking.checkInDate), new Date(booking.checkOutDate))
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
    const advance = await AdvancePayment.findOne({ booking: booking._id }).lean();

    const hotelName = "YES HOTELS";
    const hotelAddress = "No. 51, Khata No. 749, Singasandra, Hosa Road Junction, Parappana Agrahara, Electronic City Ph-2, Bengaluru-560100.";
    const hotelPhone = settings?.phone ?? "080-28522333 / 9902391178";
    const hotelGST = settings?.gstNumber ?? "29AAAFY1234A1Z5";

    const room = booking.assignedRoom as any;
    const category = booking.roomCategory as any;
    const guest = booking.guestDetails as any;
    const foreign = (booking as any).foreignGuestDetails as any;

    const esc = (s: any) =>
      String(s ?? "—").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

    const nights = Math.max(
      1,
      countNights(new Date(booking.checkInDate), new Date(booking.checkOutDate))
    );

    const idType = (guest.idType || "").toUpperCase();
    const isAadhaar = idType.includes("AAD");
    const isDL = idType.includes("DRIV") || idType.includes("DL");
    const isVoter = idType.includes("VOTER") || idType.includes("ECI");
    const isGovt = !isAadhaar && !isDL && !isVoter;

    const billNo = booking.billNumber || booking.bookingReference?.slice(-4) || "—";
    const ratePerNight = (booking as any).ratePerNight ?? Math.round((booking.totalAmount - (booking.taxAmount || 0)) / nights);
    const advanceAmount = advance?.amount ?? (booking as any).advanceAmount ?? 0;
    const advanceMethod = advance?.method ?? (booking as any).paymentMethod ?? "CASH";

    const idProofImages = guest.idProofImages || [];

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Guest Registration Card — ${esc(billNo)}</title>
<style>
  @page { margin: 8mm; size: A4 portrait; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; background: #fff; }
  .page { width: 100%; max-width: 210mm; margin: 0 auto; border: 2px solid #000; padding: 10px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; }
  .brand-title { font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
  .hotel-address { font-size: 9.5px; color: #222; margin-top: 2px; line-height: 1.3; }
  .bill-box { text-align: right; border-left: 1px solid #000; padding-left: 10px; min-width: 140px; }
  .bill-num { font-size: 18px; font-weight: 900; color: #b91c1c; font-family: monospace; }
  .title-strip { text-align: center; border-bottom: 1.5px solid #000; padding: 4px 0 6px 0; }
  .grc-title { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
  .form-c-sub { font-size: 8.5px; font-weight: bold; color: #333; text-transform: uppercase; margin-top: 2px; }
  .id-strip { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #000; padding: 4px 8px; background: #fbfbfb; font-weight: bold; font-size: 10.5px; }
  .id-options { display: flex; gap: 14px; align-items: center; }
  .id-val { font-family: monospace; font-size: 11px; background: #fff; border: 1px solid #000; padding: 1px 6px; }
  .main-grid { display: flex; border-bottom: 1.5px solid #000; }
  .left-col { width: 42%; border-right: 1.5px solid #000; padding: 6px; background: #fafafa; }
  .right-col { width: 58%; padding: 8px; }
  .box { border: 1px solid #000; padding: 6px; background: #fff; margin-bottom: 6px; }
  .box-title { font-size: 10px; font-weight: 900; text-transform: uppercase; text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 5px; }
  .row-field { display: flex; justify-content: space-between; border-bottom: 1px dotted #aaa; padding: 2px 0; font-size: 10px; }
  .f-label { font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #444; }
  .f-val { font-size: 11px; font-weight: bold; color: #000; }
  .rg-row { border-bottom: 1px solid #ddd; padding: 3px 0; }
  .rg-label { font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #555; }
  .rg-val { font-size: 11.5px; font-weight: bold; text-transform: uppercase; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .kyc-docs { border-bottom: 1.5px solid #000; padding: 6px 8px; background: #f9f9f9; }
  .kyc-title { font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
  .img-row { display: flex; gap: 10px; overflow: hidden; }
  .img-card { border: 1px solid #000; padding: 3px; background: #fff; text-align: center; border-radius: 3px; }
  .img-card img { height: 90px; width: 140px; object-fit: contain; }
  .rules-box { border-bottom: 1.5px solid #000; padding: 6px 8px; font-size: 9px; line-height: 1.35; background: #fff; }
  .rules-title { font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin-bottom: 3px; }
  .rules-list { margin: 0; padding-left: 14px; }
  .rules-list li { margin-bottom: 1.5px; }
  .declaration-txt { font-weight: bold; font-size: 9px; margin-top: 4px; color: #111; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; padding-top: 32px; padding-bottom: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
  .sig-line { border-top: 1px solid #000; margin: 0 16px; padding-top: 3px; }
  .guest-sig-line { border-top: 2px solid #000; margin: 0 16px; padding-top: 3px; font-weight: 900; }
  .print-footer { text-align: center; font-size: 8.5px; color: #666; margin-top: 4px; font-family: monospace; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  
  <!-- HEADER -->
  <div class="header">
    <div>
      <h1 class="brand-title">${esc(hotelName)}</h1>
      <div class="hotel-address">${esc(hotelAddress)}</div>
    </div>
    <div class="bill-box">
      <div>Bill No: <span class="bill-num">${esc(billNo)}</span></div>
      <div style="font-size:9px;color:#555;font-family:monospace;margin-top:2px">Ref: ${esc(booking.bookingReference)}</div>
    </div>
  </div>

  <!-- TITLE & STATUTORY FORM-C NOTICE -->
  <div class="title-strip">
    <h2 class="grc-title">Guest Registration Card</h2>
    <div class="form-c-sub">THE REGISTRATION OF FOREIGNERS RULES - 1939 FORM - C HOTEL ARRIVAL REPORT, RULE 14, ID PROOF IS REQUIRED FOR CHECK - IN</div>
  </div>

  <!-- ID CHECKBOXES BANNER -->
  <div class="id-strip">
    <div class="id-options">
      <span>ID :</span>
      <span>[${isAadhaar ? "✓" : " "}] AAD</span>
      <span>[${isDL ? "✓" : " "}] DL</span>
      <span>[${isVoter ? "✓" : " "}] E.C.I</span>
      <span>[${isGovt ? "✓" : " "}] Govt. ID</span>
    </div>
    <div>
      ID No. : <span class="id-val">${esc(guest.idNumber || "—")}</span>
    </div>
  </div>

  <!-- MAIN 2-COLUMN SECTION -->
  <div class="main-grid">
    
    <!-- LEFT: OFFICE USE & FOREIGNERS (MATCHING IMAGE 2) -->
    <div class="left-col">
      
      <!-- BOX 1: FOR OFFICE USE ONLY -->
      <div class="box">
        <div class="box-title">For Office Use Only</div>
        <div class="row-field">
          <span><strong>Room No.</strong> <span style="font-size:12px;font-weight:900">${esc(room?.roomNumber)}</span></span>
          <span><strong>Tariff</strong> ₹${esc(ratePerNight)}/-</span>
        </div>
        <div class="row-field">
          <span><strong>Extra Bed</strong> ${esc((booking as any).extraPersonsWithBed || "—")}</span>
          <span><strong>Bill No.</strong> ${esc(billNo)}</span>
        </div>
        <div class="row-field">
          <span><strong>Advance</strong> <span style="font-weight:900;color:#15803d">₹${esc(advanceAmount)}/-</span></span>
          <span><strong>Receipt No.</strong> ${esc(advance?.advanceNumber?.slice(-6) || "—")}</span>
        </div>
        <div style="margin-top:4px">
          <div class="f-label">Billing Instruction / Payment Details:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px;font-size:9.5px">
            <span>[${advanceMethod === "CASH" ? "✓" : " "}] Cash</span>
            <span>[${advanceMethod === "CARD" ? "✓" : " "}] Card / DD</span>
            <span>[${advanceMethod === "UPI" ? "✓" : " "}] UPI</span>
            <span>[${booking.paymentStatus === "PAID" ? "✓" : " "}] Net Pay</span>
          </div>
        </div>
        <div style="margin-top:4px;border-top:1px dotted #aaa;padding-top:2px">
          <div class="f-label">Type of Plan:</div>
          <div style="display:flex;justify-content:space-between;margin-top:2px;font-size:9.5px">
            <span>[${(booking as any).mealPlan === "EP" || !(booking as any).mealPlan ? "✓" : " "}] EP</span>
            <span>[${(booking as any).mealPlan === "CP" ? "✓" : " "}] CP</span>
            <span>[${(booking as any).mealPlan === "MAP" ? "✓" : " "}] MAP</span>
            <span>[${(booking as any).mealPlan === "AP" ? "✓" : " "}] AP</span>
          </div>
        </div>
        <div class="row-field" style="border:none;margin-top:3px">
          <span><strong>B/ID No.</strong> ${esc(booking.source || "Walk-In")}</span>
        </div>
      </div>

      <!-- BOX 2: FOR FOREIGNERS ONLY -->
      <div class="box" style="margin-bottom:0">
        <div class="box-title">For Foreigners Only</div>
        <div class="row-field"><span>Passport No.</span><span class="f-val">${esc(foreign?.passportNumber)}</span></div>
        <div class="row-field"><span>Place of Issue</span><span>${esc(foreign?.passportIssuePlace)}</span></div>
        <div class="row-field"><span>Date of Issue</span><span>${foreign?.passportIssueDate ? new Date(foreign.passportIssueDate).toLocaleDateString("en-IN") : "—"}</span></div>
        <div class="row-field"><span>Date of Expiry</span><span>${foreign?.passportExpiryDate ? new Date(foreign.passportExpiryDate).toLocaleDateString("en-IN") : "—"}</span></div>
        <div class="row-field"><span>Visa No.</span><span class="f-val">${esc(foreign?.visaNumber)}</span></div>
        <div class="row-field" style="border:none"><span>Visa Date / Place</span><span>${foreign?.visaDate ? new Date(foreign.visaDate).toLocaleDateString("en-IN") : "—"}</span></div>
      </div>

    </div>

    <!-- RIGHT: GUEST IDENTITY & STAY (MATCHING IMAGE 2) -->
    <div class="right-col">
      <div class="rg-row">
        <div class="rg-label">Name (in capital Letters)</div>
        <div class="rg-val" style="font-size:14px;letter-spacing:1px">${esc(guest.firstName)} ${esc(guest.lastName)}</div>
      </div>

      <div class="rg-row grid-2">
        <div><div class="rg-label">Designation</div><div class="rg-val" style="font-size:11px">${esc(guest.designation)}</div></div>
        <div><div class="rg-label">Name of Organization</div><div class="rg-val" style="font-size:11px">${esc(guest.organization)}</div></div>
      </div>

      <div class="rg-row">
        <div class="rg-label">Address</div>
        <div class="rg-val" style="font-size:11px;font-weight:normal">${esc(guest.address)}</div>
      </div>

      <div class="rg-row grid-2">
        <div><div class="rg-label">Mob. No.</div><div class="rg-val" style="font-family:monospace">${esc(guest.phone)}</div></div>
        <div><div class="rg-label">Email</div><div class="rg-val" style="font-size:10px;text-transform:none;font-family:monospace">${esc(guest.email)}</div></div>
      </div>

      <div class="rg-row grid-3">
        <div><div class="rg-label">Nationality</div><div class="rg-val" style="font-size:11px">${esc(guest.nationality || "INDIAN")}</div></div>
        <div><div class="rg-label">DOB / Age</div><div class="rg-val" style="font-size:11px">${guest.dateOfBirth ? new Date(guest.dateOfBirth).toLocaleDateString("en-IN") : "—"}</div></div>
        <div><div class="rg-label">Vech. Reg. No.</div><div class="rg-val" style="font-size:11px;font-family:monospace">${esc(guest.vehicleNumber)}</div></div>
      </div>

      <div class="rg-row grid-3">
        <div><div class="rg-label">No. of Persons</div><div class="rg-val" style="font-size:11px">Adult: ${booking.adults || 1}</div></div>
        <div><div class="rg-label">Child</div><div class="rg-val" style="font-size:11px">${booking.children || 0}</div></div>
        <div><div class="rg-label">Stay Days</div><div class="rg-val" style="font-size:11px">${nights} Night(s)</div></div>
      </div>

      <div class="rg-row grid-2">
        <div><div class="rg-label">Date of Arr &amp; Time</div><div class="rg-val" style="font-size:11px">${new Date(booking.checkInDate).toLocaleDateString("en-IN")} &bull; ${esc((booking as any).arrivalTime || "12:00 PM")}</div></div>
        <div><div class="rg-label">Date of Dep &amp; Time</div><div class="rg-val" style="font-size:11px">${new Date(booking.checkOutDate).toLocaleDateString("en-IN")} &bull; ${esc((booking as any).departureTime || "11:00 AM")}</div></div>
      </div>

      <div class="rg-row grid-2" style="border:none">
        <div><div class="rg-label">Purpose of Visit</div><div class="rg-val" style="font-size:11px">${esc(guest.purposeOfVisit || "Personal / Business")}</div></div>
        <div><div class="rg-label">Proceeding To</div><div class="rg-val" style="font-size:11px">${esc(guest.proceedingTo || "Local / Airport")}</div></div>
      </div>

      ${guest.gstin ? `<div style="margin-top:3px;font-size:9px;border-top:1px dotted #ccc;padding-top:2px"><strong>Company GSTIN:</strong> <span style="font-family:monospace;font-weight:bold">${esc(guest.gstin)}</span></div>` : ""}
    </div>

  </div>

  <!-- CUSTOMER KYC IMAGES (IF UPLOADED) -->
  ${idProofImages.length > 0 ? `
  <div class="kyc-docs">
    <div class="kyc-title">Verified Customer Photo &amp; Government ID Proof Records:</div>
    <div class="img-row">
      ${idProofImages.map((src: string, i: number) => `
        <div class="img-card">
          <img src="${src}" alt="ID Document ${i + 1}" />
          <div style="font-size:8px;font-weight:bold;margin-top:2px">DOCUMENT #${i + 1}</div>
        </div>
      `).join("")}
    </div>
  </div>
  ` : ""}

  <!-- HOTEL RULES, REGULATIONS & CONSENT DECLARATION -->
  <div class="rules-box">
    <div class="rules-title">Hotel Rules, Regulations &amp; Guest Consent Terms:</div>
    <ol class="rules-list">
      <li><strong>Check-in: 12:00 Noon | Check-out: 11:00 AM.</strong> Extensions are subject to room availability and front office approval.</li>
      <li><strong>Statutory ID Mandate:</strong> Original valid Government ID proof is mandatory for every guest upon check-in as per local police regulations. Foreign guests must present valid Passport &amp; Visa (Form-C).</li>
      <li><strong>Valuables:</strong> Management shall not be responsible for cash, jewelry or unattended valuables left in rooms. Safety lockers are available.</li>
      <li><strong>Non-Smoking Policy:</strong> Smoking and consumption of contraband substances are strictly prohibited inside guest rooms and indoor areas.</li>
      <li><strong>Visitors:</strong> Non-resident visitors are permitted in the lobby only and not allowed in guest rooms after 10:00 PM without registration.</li>
      <li><strong>Damages:</strong> Any loss, breakages, or staining of hotel linen, electronics, or fixtures will be billed directly to the guest's folio.</li>
      <li><strong>Billing Liability:</strong> Regardless of corporate or third-party billing instructions, the guest remains personally liable for the full settlement of the bill.</li>
      <li><strong>Key Return:</strong> Room keys must be deposited at the reception desk upon departure.</li>
    </ol>
    <div class="declaration-txt">
      DECLARATION: I hereby declare that all particulars furnished above are true and accurate. I have read, understood, and agree to abide by the rules and regulations of YES HOTELS.
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="sig-grid">
    <div>
      <div class="sig-line">Receptionist</div>
    </div>
    <div>
      <div class="sig-line">Front Office Manager</div>
    </div>
    <div>
      <div class="guest-sig-line">Guest Signature</div>
    </div>
  </div>

</div>

<div class="print-footer">
  Printed via YES HOTELS PMS &bull; Bengaluru &bull; All Rights Reserved
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
