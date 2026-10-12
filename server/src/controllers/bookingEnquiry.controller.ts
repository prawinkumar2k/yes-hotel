import { Request, Response } from "express";
import { z } from "zod";
import {
  BookingEnquiry, BookingEnquiryStatus, EnquirySource, EnquiryType, EnquiryPriority
} from "../models/BookingEnquiry";
import { User, UserRole } from "../models/User";
import { Booking, BookingStatus } from "../models/Booking";
import { Guest } from "../models/Guest";
import { NotificationType } from "../models/NotificationLog";
import { sendNotification } from "../services/notification.service";
import { createAuditLog } from "../services/audit.service";
import mongoose from "mongoose";

// ─── Chatbot enquiry schema (public — strict, minimal) ─────────────────────
const publicEnquirySchema = z.object({
  guestName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().min(1).max(30).refine((v) => v.replace(/\D/g, "").length >= 7, "Phone must contain at least 7 digits"),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  nights: z.coerce.number().int().positive().optional(),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(20).default([]),
  rooms: z.coerce.number().int().min(1).max(20).default(1),
  roomType: z.string().trim().min(1).max(120).default("Deluxe Room"),
  roomCategoryId: z.string().trim().optional(),
  pricePerNight: z.coerce.number().nonnegative().optional(),
  roomSubtotal: z.coerce.number().nonnegative().optional(),
  bookingStage: z.string().trim().optional().default("CHATBOT_CONTACT_COLLECTED"),
  source: z.nativeEnum(EnquirySource).optional().default(EnquirySource.CHATBOT),
}).superRefine((v, ctx) => {
  if (v.checkOut <= v.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
});

// ─── Admin enquiry create schema (staff — full fields) ──────────────────────
const adminEnquirySchema = z.object({
  guestName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().min(1).max(30),
  company: z.string().trim().max(120).optional(),
  preferredContactMethod: z.enum(["PHONE", "EMAIL", "WHATSAPP", "ANY"]).optional(),

  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  nights: z.coerce.number().int().positive().optional(),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20).default(0),
  childAges: z.array(z.coerce.number()).default([]),
  rooms: z.coerce.number().int().min(1).max(50).default(1),
  roomType: z.string().trim().min(1).max(120),
  roomCategoryId: z.string().trim().optional(),
  mealPlan: z.string().trim().optional(),
  expectedBudget: z.coerce.number().nonnegative().optional(),
  specialRequirements: z.string().trim().max(2000).optional(),

  enquiryType: z.nativeEnum(EnquiryType).default(EnquiryType.INDIVIDUAL),
  eventName: z.string().trim().max(120).optional(),
  eventDate: z.coerce.date().optional(),
  venueRequirements: z.string().trim().max(1000).optional(),
  expectedAttendance: z.coerce.number().nonnegative().optional(),
  cateringRequired: z.boolean().default(false),

  source: z.nativeEnum(EnquirySource).default(EnquirySource.PHONE),
  priority: z.nativeEnum(EnquiryPriority).default(EnquiryPriority.MEDIUM),
  notes: z.string().trim().max(2000).optional(),
  nextFollowUpDate: z.coerce.date().optional(),
  assignedTo: z.string().trim().optional(),
  bookingStage: z.string().trim().optional(),
}).superRefine((v, ctx) => {
  if (v.checkOut <= v.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
});

// ─── Generate enquiry number ───────────────────────────────────────────────
async function generateEnquiryNumber(): Promise<string> {
  const d = new Date();
  const prefix = `ENQ-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const count = await BookingEnquiry.countDocuments({
    enquiryNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

// ─── PUBLIC: POST /api/booking-enquiries ───────────────────────────────────
export const submitBookingEnquiry = async (req: Request, res: Response) => {
  const parsed = publicEnquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Please check the enquiry details", errors: parsed.error.issues });
  }
  try {
    const calculatedNights = Math.max(1, Math.round((parsed.data.checkOut.getTime() - parsed.data.checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const nights = parsed.data.nights || calculatedNights;

    // Check for an existing open enquiry for this guest in the last 48 hours to update rather than flood duplicates
    const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const existingFilter: any = {
      createdAt: { $gte: oneDayAgo },
      status: { $in: [BookingEnquiryStatus.NEW, BookingEnquiryStatus.CONTACTED, BookingEnquiryStatus.FOLLOW_UP, BookingEnquiryStatus.AWAITING_RESPONSE] },
      $or: [
        { phone: parsed.data.phone },
        ...(parsed.data.email ? [{ email: parsed.data.email }] : [])
      ]
    };
    const existing = await BookingEnquiry.findOne(existingFilter).sort({ createdAt: -1 });

    if (existing) {
      existing.guestName = parsed.data.guestName;
      if (parsed.data.email) existing.email = parsed.data.email;
      existing.checkIn = parsed.data.checkIn;
      existing.checkOut = parsed.data.checkOut;
      existing.nights = nights;
      existing.adults = parsed.data.adults;
      existing.children = parsed.data.children;
      existing.childAges = parsed.data.childAges;
      existing.rooms = parsed.data.rooms;
      existing.roomType = parsed.data.roomType;
      if (parsed.data.roomCategoryId && mongoose.Types.ObjectId.isValid(parsed.data.roomCategoryId)) {
        existing.roomCategoryId = new mongoose.Types.ObjectId(parsed.data.roomCategoryId);
      }
      if (parsed.data.pricePerNight) existing.pricePerNight = parsed.data.pricePerNight;
      if (parsed.data.roomSubtotal) existing.roomSubtotal = parsed.data.roomSubtotal;
      existing.bookingStage = parsed.data.bookingStage || existing.bookingStage;
      if (parsed.data.source) existing.source = parsed.data.source;
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "Enquiry updated.",
        data: { id: existing._id, enquiryNumber: existing.enquiryNumber, bookingStage: existing.bookingStage }
      });
    }

    const enquiryNumber = await generateEnquiryNumber();
    const enquiry = await BookingEnquiry.create({
      ...parsed.data,
      nights,
      enquiryNumber,
      source: parsed.data.source || EnquirySource.CHATBOT,
      bookingStage: parsed.data.bookingStage || "CHATBOT_CONTACT_COLLECTED",
    });

    const staff = await User.find({
      role: { $in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST] },
      isActive: true,
    }).select("email").lean();
    const configuredRecipients = (process.env.BOOKING_ENQUIRY_RECIPIENTS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const recipients = [...new Set([...staff.map((u) => u.email), ...configuredRecipients])];

    const subject = `New YES Hotels enquiry (${parsed.data.bookingStage || 'Lead'}): ${parsed.data.guestName}`;
    const body = [
      `Guest: ${parsed.data.guestName}`,
      `Phone: ${parsed.data.phone}`,
      `Email: ${parsed.data.email || "Not provided"}`,
      `Check-in: ${parsed.data.checkIn.toISOString().slice(0, 10)}`,
      `Check-out: ${parsed.data.checkOut.toISOString().slice(0, 10)}`,
      `Nights: ${nights}`,
      `Guests: ${parsed.data.adults} adults, ${parsed.data.children} children`,
      `Rooms: ${parsed.data.rooms} × ${parsed.data.roomType}`,
      `Stage: ${parsed.data.bookingStage || "CHATBOT_CONTACT_COLLECTED"}`,
      `Enquiry #: ${enquiryNumber}`,
    ].join("\n");

    Promise.allSettled(recipients.map((recipientEmail) => sendNotification({
      type: NotificationType.BOOKING_ENQUIRY,
      recipientEmail,
      subject,
      body,
    }))).catch(() => undefined);

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been submitted.",
      data: { id: enquiry._id, enquiryNumber, bookingStage: enquiry.bookingStage }
    });
  } catch (error: any) {
    console.error("submitBookingEnquiry error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Could not submit enquiry. Please try again." });
  }
};

// ─── ADMIN: GET /api/admin/booking-enquiries ──────────────────────────────
export const getBookingEnquiries = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", status, source, priority, search, dateFrom, dateTo } = req.query;
    const p = parseInt(page as string);
    const l = Math.min(parseInt(limit as string), 100);
    const filter: Record<string, any> = {};

    if (status && status !== "ALL") filter.status = status;
    if (source && source !== "ALL") filter.source = source;
    if (priority && priority !== "ALL") filter.priority = priority;
    if (dateFrom || dateTo) {
      filter.checkIn = {};
      if (dateFrom) filter.checkIn.$gte = new Date(dateFrom as string);
      if (dateTo) filter.checkIn.$lte = new Date(dateTo as string);
    }
    if (search) {
      const rx = new RegExp(search as string, "i");
      filter.$or = [
        { guestName: rx }, { phone: rx }, { email: rx },
        { company: rx }, { enquiryNumber: rx },
      ];
    }

    const [enquiries, total] = await Promise.all([
      BookingEnquiry.find(filter)
        .populate("assignedTo", "firstName lastName role")
        .populate("convertedToBookingId", "bookingReference status")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      BookingEnquiry.countDocuments(filter),
    ]);

    // Summary stats
    const [totalAll, newCount, followUpCount, quotationCount, convertedCount, lostCount, overdue] = await Promise.all([
      BookingEnquiry.countDocuments({}),
      BookingEnquiry.countDocuments({ status: BookingEnquiryStatus.NEW }),
      BookingEnquiry.countDocuments({ status: BookingEnquiryStatus.FOLLOW_UP }),
      BookingEnquiry.countDocuments({ status: BookingEnquiryStatus.QUOTATION_SENT }),
      BookingEnquiry.countDocuments({ status: BookingEnquiryStatus.CONVERTED }),
      BookingEnquiry.countDocuments({ status: BookingEnquiryStatus.LOST }),
      BookingEnquiry.countDocuments({
        nextFollowUpDate: { $lt: new Date() },
        status: { $nin: [BookingEnquiryStatus.CONVERTED, BookingEnquiryStatus.LOST, BookingEnquiryStatus.CANCELLED] },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        enquiries, total,
        totalPages: Math.ceil(total / l),
        page: p,
        stats: { totalAll, newCount, followUpCount, quotationCount, convertedCount, lostCount, overdue },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: GET /api/admin/booking-enquiries/:id ──────────────────────────
export const getBookingEnquiryById = async (req: Request, res: Response) => {
  try {
    const enquiry = await BookingEnquiry.findById(req.params.id)
      .populate("assignedTo", "firstName lastName role email")
      .populate("convertedToBookingId", "bookingReference status checkInDate checkOutDate")
      .populate("convertedBy", "firstName lastName role")
      .populate("followUps.conductedBy", "firstName lastName");
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.json({ success: true, data: enquiry });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: POST /api/admin/booking-enquiries ──────────────────────────────
export const createAdminEnquiry = async (req: Request, res: Response) => {
  const parsed = adminEnquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Validation failed", errors: parsed.error.issues });
  }
  try {
    const enquiryNumber = await generateEnquiryNumber();
    const nights = Math.ceil((parsed.data.checkOut.getTime() - parsed.data.checkIn.getTime()) / 86400000);

    const enquiry = await BookingEnquiry.create({
      ...parsed.data,
      enquiryNumber,
      nights,
    });

    await createAuditLog({
      req, action: "enquiry.created", resourceType: "BookingEnquiry",
      resourceId: enquiry._id.toString(),
      metadata: { enquiryNumber, guestName: enquiry.guestName, source: enquiry.source },
    });

    return res.status(201).json({ success: true, message: "Enquiry created", data: enquiry });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: PATCH /api/admin/booking-enquiries/:id ────────────────────────
export const updateBookingEnquiry = async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      "guestName", "email", "phone", "company", "preferredContactMethod",
      "checkIn", "checkOut", "adults", "children", "rooms", "roomType", "roomCategoryId",
      "mealPlan", "expectedBudget", "specialRequirements",
      "enquiryType", "eventName", "eventDate", "venueRequirements", "expectedAttendance",
      "cateringRequired", "source", "priority", "notes", "nextFollowUpDate", "assignedTo",
      "status", "lostReason", "quotationAmount", "quotationNotes", "quotationValidUntil",
    ];
    const update: Record<string, any> = {};
    for (const k of allowedFields) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    // Auto-set nights if dates changed
    if (update.checkIn || update.checkOut) {
      const enquiry = await BookingEnquiry.findById(req.params.id).lean();
      if (enquiry) {
        const checkIn = update.checkIn ? new Date(update.checkIn) : enquiry.checkIn;
        const checkOut = update.checkOut ? new Date(update.checkOut) : enquiry.checkOut;
        update.nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000);
      }
    }

    // Handle quotation sent
    if (update.status === BookingEnquiryStatus.QUOTATION_SENT && !update.quotationSentAt) {
      update.quotationSentAt = new Date();
    }

    const enquiry = await BookingEnquiry.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    ).populate("assignedTo", "firstName lastName role");

    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    await createAuditLog({
      req, action: "enquiry.updated", resourceType: "BookingEnquiry",
      resourceId: enquiry._id.toString(),
      metadata: { fields: Object.keys(update) },
    });

    return res.json({ success: true, data: enquiry });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: PATCH /api/admin/booking-enquiries/:id/status ────────────────
export const updateBookingEnquiryStatus = async (req: Request, res: Response) => {
  try {
    const { status, lostReason } = req.body;
    if (!Object.values(BookingEnquiryStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const update: Record<string, any> = { status };
    if (status === BookingEnquiryStatus.QUOTATION_SENT) update.quotationSentAt = new Date();
    if (status === BookingEnquiryStatus.LOST && lostReason) update.lostReason = lostReason;

    const enquiry = await BookingEnquiry.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    return res.json({ success: true, data: enquiry });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: POST /api/admin/booking-enquiries/:id/follow-up ──────────────
export const addFollowUp = async (req: Request, res: Response) => {
  try {
    const { notes, method, nextFollowUpDate } = req.body;
    if (!notes || !method) {
      return res.status(400).json({ success: false, message: "Notes and contact method are required" });
    }

    const followUp = {
      date: new Date(),
      method,
      notes,
      conductedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      createdAt: new Date(),
    };

    const update: Record<string, any> = {
      $push: { followUps: followUp },
      $set: { status: BookingEnquiryStatus.FOLLOW_UP },
    };
    if (nextFollowUpDate) update.$set.nextFollowUpDate = new Date(nextFollowUpDate);

    const enquiry = await BookingEnquiry.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    await createAuditLog({
      req, action: "enquiry.follow-up.added", resourceType: "BookingEnquiry",
      resourceId: enquiry._id.toString(),
      metadata: { method, nextFollowUpDate },
    });

    return res.json({ success: true, message: "Follow-up recorded", data: enquiry });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: POST /api/admin/booking-enquiries/:id/convert ────────────────
export const convertEnquiryToBooking = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const enquiry = await BookingEnquiry.findById(req.params.id).session(session);
    if (!enquiry) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }
    if (enquiry.status === BookingEnquiryStatus.CONVERTED) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "This enquiry has already been converted to a booking", data: { bookingId: enquiry.convertedToBookingId } });
    }
    if ([BookingEnquiryStatus.LOST, BookingEnquiryStatus.CANCELLED].includes(enquiry.status)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Cannot convert an enquiry with status: ${enquiry.status}` });
    }

    // Verify availability (basic check — real booking logic is in booking.controller)
    const { Room } = await import("../models/Room");
    const availableRooms = await Room.countDocuments({
      sellStatus: "SELLABLE" as any,
      occupancyStatus: "VACANT" as any,
    }).session(session);
    if (availableRooms < enquiry.rooms) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Insufficient available rooms. Requested: ${enquiry.rooms}, Available: ${availableRooms}. Please assign rooms manually after booking creation.` });
    }

    // Get default property
    const { Property } = await import("../models/Property");
    const property = await Property.findOne({}).session(session).lean();

    // Find or create guest profile
    let guest = await Guest.findOne({ phone: enquiry.phone }).session(session);
    if (!guest) {
      const newGuest = await Guest.create({
        propertyId: property?._id,
        fullName: enquiry.guestName.trim(),
        phone: enquiry.phone,
        email: enquiry.email || undefined,
      });
      guest = Array.isArray(newGuest) ? newGuest[0] : newGuest;
    }

    // Generate booking reference
    const { generateBookingReference } = await import("../utils/booking-reference");
    const bookingReference = await generateBookingReference("ENQ");

    // Create the booking as CONFIRMED (pending physical room assignment)
    const [firstName, ...rest] = guest.fullName.trim().split(" ");
    // Fetch room category or default
    let finalRoomCategory = enquiry.roomCategoryId;
    if (!finalRoomCategory) {
      const { RoomCategory } = await import("../models/RoomCategory");
      const defaultCategory = await RoomCategory.findOne({}).session(session).lean();
      if (!defaultCategory) {
        throw new Error("No room categories found in the system to assign to booking.");
      }
      finalRoomCategory = defaultCategory._id as any;
    }

    const newBooking = await Booking.create({
      bookingReference,
      property: property?._id,
      customer: guest._id,
      guestDetails: {
        firstName,
        lastName: rest.join(" ") || "",
        phone: enquiry.phone,
        email: enquiry.email || "",
      },
      checkInDate: enquiry.checkIn,
      checkOutDate: enquiry.checkOut,
      adults: enquiry.adults,
      children: enquiry.children,
      roomCategory: new mongoose.Types.ObjectId(finalRoomCategory),
      status: BookingStatus.CONFIRMED,
      source: "ADMIN" as any,
      bookingType: "INDIVIDUAL" as any,
      stayType: "NIGHTLY" as any,
      paymentStatus: "UNPAID" as any,
      registrationStatus: "DRAFT" as any,
      signatureStatus: "NOT_COLLECTED" as any,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      paidAmount: 0,
      discountAmount: 0,
      couponRedeemed: false,
      extraPersonsNoBed: 0,
      extraPersonsWithBed: 0,
      extraChildrenNoBed: 0,
      extraChildrenWithBed: 0,
      kidsUnder3: 0,
      totalAmount: enquiry.quotationAmount || enquiry.roomSubtotal || 0,
      specialRequests: enquiry.specialRequirements,
    });

    const createdBooking = Array.isArray(newBooking) ? newBooking[0] : newBooking;
    if (!createdBooking) {
      throw new Error("Failed to create booking from enquiry.");
    }

    // Mark enquiry as converted
    await BookingEnquiry.findByIdAndUpdate(
      enquiry._id,
      {
        status: BookingEnquiryStatus.CONVERTED,
        convertedToBookingId: createdBooking._id,
        convertedAt: new Date(),
        convertedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
      },
      { session }
    );

    await createAuditLog({
      req,
      action: "enquiry.converted",
      resourceType: "BookingEnquiry",
      resourceId: enquiry._id.toString(),
      metadata: { bookingReference, bookingId: createdBooking._id.toString(), enquiryNumber: enquiry.enquiryNumber },
    });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: `Booking ${bookingReference} created from enquiry ${enquiry.enquiryNumber}`,
      data: {
        booking: { _id: createdBooking._id, bookingReference: createdBooking.bookingReference },
        enquiryId: enquiry._id,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ─── ADMIN: DELETE /api/admin/booking-enquiries/:id ──────────────────────
export const deleteBookingEnquiry = async (req: Request, res: Response) => {
  try {
    const enquiry = await BookingEnquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    if (enquiry.status === BookingEnquiryStatus.CONVERTED) {
      return res.status(400).json({ success: false, message: "Cannot delete a converted enquiry. Archive it instead." });
    }
    await BookingEnquiry.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Enquiry deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};