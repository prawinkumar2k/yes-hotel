import { Request, Response } from "express";
import { z } from "zod";
import {
  BookingEnquiry, BookingEnquiryStatus, EnquirySource, EnquiryType, EnquiryPriority
} from "../models/BookingEnquiry";
import { Booking, BookingStatus } from "../models/Booking";
import { Guest } from "../models/Guest";
import { NotificationType } from "../models/NotificationLog";
import { sendNotification } from "../services/notification.service";
import { createAuditLog } from "../services/audit.service";
import mongoose from "mongoose";
import { nights as countNights, toBusinessDate, todayBusinessDate, businessDayRange } from "../../../shared/dates";
import { queueBookingCreatedEmail } from "../services/booking-email.service";
import { PUBLIC_ENQUIRY_STAGES } from "../../../shared/enquiry-stages";
import { RoomCategory } from "../models/RoomCategory";
import { emitToStaff } from "../realtime/socket";

// ─── Chatbot enquiry schema (public — strict, minimal) ─────────────────────
const publicEnquirySchema = z.object({
  guestName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email("A valid email address is required").max(254),
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
  bookingStage: z.enum(PUBLIC_ENQUIRY_STAGES).default("CHATBOT_CONTACT_COLLECTED"),
  /** Why the step failed (e.g. the booking error message), kept in the stage history. */
  reason: z.string().trim().max(300).optional(),
  source: z.enum([EnquirySource.CHATBOT, EnquirySource.WEBSITE]).optional().default(EnquirySource.CHATBOT),
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
  const prefix = `ENQ-${todayBusinessDate().slice(0, 7).replace("-", "")}`; // YYYYMM at the property
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
    const calculatedNights = Math.max(1, countNights(parsed.data.checkIn, parsed.data.checkOut));
    const nights = parsed.data.nights || calculatedNights;
    const { reason, ...data } = parsed.data;
    const now = new Date();
    // The booking page only knows the room type id — use its real name on the enquiry.
    if (data.roomCategoryId && mongoose.Types.ObjectId.isValid(data.roomCategoryId)) {
      const cat = await RoomCategory.findById(data.roomCategoryId).select("name").lean();
      if (cat?.name) data.roomType = cat.name;
    }

    // Check for an existing open enquiry for this guest in the last 48 hours to update rather than flood duplicates
    const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const existingFilter: any = {
      createdAt: { $gte: oneDayAgo },
      status: { $in: [BookingEnquiryStatus.NEW, BookingEnquiryStatus.CONTACTED, BookingEnquiryStatus.FOLLOW_UP, BookingEnquiryStatus.AWAITING_RESPONSE] },
      $or: [{ phone: data.phone }, { email: data.email }],
    };
    const existing = await BookingEnquiry.findOne(existingFilter).sort({ createdAt: -1 });

    if (existing) {
      existing.guestName = data.guestName;
      existing.email = data.email;
      existing.phone = data.phone;
      existing.checkIn = data.checkIn;
      existing.checkOut = data.checkOut;
      existing.nights = nights;
      existing.adults = data.adults;
      existing.children = data.children;
      existing.childAges = data.childAges;
      existing.rooms = data.rooms;
      existing.roomType = data.roomType;
      if (data.roomCategoryId && mongoose.Types.ObjectId.isValid(data.roomCategoryId)) {
        existing.roomCategoryId = new mongoose.Types.ObjectId(data.roomCategoryId);
      }
      if (data.pricePerNight) existing.pricePerNight = data.pricePerNight;
      if (data.roomSubtotal) existing.roomSubtotal = data.roomSubtotal;
      const last = existing.stageHistory?.[existing.stageHistory.length - 1];
      if (!last || last.stage !== data.bookingStage || reason) existing.stageHistory.push({ stage: data.bookingStage, at: now, ...(reason ? { reason } : {}) });
      existing.bookingStage = data.bookingStage;
      existing.lastActivityAt = now;
      if (data.source) existing.source = data.source;
      await existing.save();
      emitToStaff("enquiry:updated", { _id: String(existing._id), bookingStage: existing.bookingStage }, existing.propertyId);

      return res.status(200).json({
        success: true,
        message: "Enquiry updated.",
        data: { id: existing._id, enquiryNumber: existing.enquiryNumber, bookingStage: existing.bookingStage }
      });
    }

    const enquiryNumber = await generateEnquiryNumber();
    const enquiry = await BookingEnquiry.create({
      ...data,
      nights,
      enquiryNumber,
      source: data.source || EnquirySource.CHATBOT,
      bookingStage: data.bookingStage,
      stageHistory: [{ stage: data.bookingStage, at: now, ...(reason ? { reason } : {}) }],
      lastActivityAt: now,
    });
    emitToStaff("enquiry:updated", { _id: String(enquiry._id), bookingStage: enquiry.bookingStage, created: true }, enquiry.propertyId);

    // The hotel's one mailbox (Admin → Settings email, bookings@yeshotels.in) — never the staff
    // login names, which are not real mailboxes.
    const { HotelSettings } = await import("../models/HotelSettings");
    const hotelEmail = String((await HotelSettings.findOne().select("email").lean() as any)?.email || "").trim().toLowerCase();
    const configuredRecipients = (process.env.BOOKING_ENQUIRY_RECIPIENTS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const recipients = [...new Set([hotelEmail, ...configuredRecipients].filter(Boolean))];

    const subject = `New YES Hotels enquiry (${parsed.data.bookingStage || 'Lead'}): ${parsed.data.guestName}`;
    const body = [
      `Guest: ${parsed.data.guestName}`,
      `Phone: ${parsed.data.phone}`,
      `Email: ${parsed.data.email || "Not provided"}`,
      `Check-in: ${toBusinessDate(parsed.data.checkIn)}`,
      `Check-out: ${toBusinessDate(parsed.data.checkOut)}`,
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
const OPEN_ENQUIRY = [BookingEnquiryStatus.NEW, BookingEnquiryStatus.CONTACTED, BookingEnquiryStatus.FOLLOW_UP, BookingEnquiryStatus.QUOTATION_SENT, BookingEnquiryStatus.AWAITING_RESPONSE];

/**
 * Overdue follow-up (one rule): an open enquiry whose next follow-up date is before today's
 * business date, or a NEW enquiry with no follow-up logged within 24 hours of arriving.
 */
export function overdueFollowUpFilter(now = new Date()) {
  const todayStart = businessDayRange(todayBusinessDate()).start;
  return {
    status: { $in: OPEN_ENQUIRY },
    $or: [
      { nextFollowUpDate: { $lt: todayStart } },
      { status: BookingEnquiryStatus.NEW, createdAt: { $lt: new Date(now.getTime() - 24 * 3600 * 1000) }, "followUps.0": { $exists: false } },
    ],
  };
}

export function isFollowUpOverdue(e: { status: string; nextFollowUpDate?: Date | null; createdAt?: Date; followUps?: unknown[] }, now = new Date()): boolean {
  if (!OPEN_ENQUIRY.includes(e.status as BookingEnquiryStatus)) return false;
  if (e.nextFollowUpDate && new Date(e.nextFollowUpDate) < businessDayRange(todayBusinessDate()).start) return true;
  return e.status === BookingEnquiryStatus.NEW && !!e.createdAt && +new Date(e.createdAt) < now.getTime() - 24 * 3600 * 1000 && !(e.followUps?.length);
}

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getBookingEnquiries = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", status, source, priority, search, dateFrom, dateTo, overdue: overdueOnly } = req.query;
    const p = parseInt(page as string);
    const l = Math.min(parseInt(limit as string), 100);
    const filter: Record<string, any> = {};

    if (status && status !== "ALL") filter.status = status;
    if (source && source !== "ALL") filter.source = source;
    if (priority && priority !== "ALL") filter.priority = priority;
    if (dateFrom || dateTo) {
      filter.checkIn = {};
      if (dateFrom) filter.checkIn.$gte = businessDayRange(String(dateFrom).slice(0, 10)).start;
      if (dateTo) filter.checkIn.$lt = businessDayRange(String(dateTo).slice(0, 10)).end;
    }
    if (overdueOnly === "true") Object.assign(filter, { $and: [overdueFollowUpFilter()] });
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), "i");
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
      BookingEnquiry.countDocuments(overdueFollowUpFilter()),
    ]);

    return res.json({
      success: true,
      data: {
        enquiries: enquiries.map((e: any) => ({ ...e, followUpOverdue: isFollowUpOverdue(e) })),
        total,
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
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ success: false, message: "Enquiry not found" });
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
    const nights = countNights(parsed.data.checkIn, parsed.data.checkOut);

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
        update.nights = countNights(checkIn, checkOut);
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

    // CONVERTED is set only by the convert action (it must have a booking); closed enquiries stay closed.
    if (status === BookingEnquiryStatus.CONVERTED) {
      return res.status(400).json({ success: false, message: "Use Convert to Booking to convert an enquiry" });
    }
    if (status === BookingEnquiryStatus.LOST && !(typeof lostReason === "string" && lostReason.trim().length >= 3)) {
      return res.status(400).json({ success: false, message: "A reason is required to mark an enquiry as lost" });
    }
    const current = await BookingEnquiry.findById(req.params.id).select("status").lean();
    if (!current) return res.status(404).json({ success: false, message: "Enquiry not found" });
    if (current.status === BookingEnquiryStatus.CONVERTED) {
      return res.status(400).json({ success: false, message: "A converted enquiry cannot change status" });
    }

    const update: Record<string, any> = { status };
    if (status === BookingEnquiryStatus.QUOTATION_SENT) update.quotationSentAt = new Date();
    if (status === BookingEnquiryStatus.LOST) update.lostReason = lostReason.trim();

    const enquiry = await BookingEnquiry.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    await createAuditLog({ req, action: "enquiry.status_changed", resourceType: "BookingEnquiry", resourceId: enquiry._id.toString(), metadata: { from: current.status, to: status, lostReason } });

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

    const current = await BookingEnquiry.findById(req.params.id).select("status").lean();
    if (!current) return res.status(404).json({ success: false, message: "Enquiry not found" });
    const closed = [BookingEnquiryStatus.CONVERTED, BookingEnquiryStatus.LOST, BookingEnquiryStatus.CANCELLED].includes(current.status);
    if (nextFollowUpDate && isNaN(new Date(nextFollowUpDate).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid next follow-up date" });
    }

    const followUp = {
      date: new Date(),
      method,
      notes,
      conductedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      createdAt: new Date(),
    };

    // A follow-up note on a closed enquiry is kept, but does not reopen it.
    const update: Record<string, any> = {
      $push: { followUps: followUp },
      $set: closed ? {} : { status: BookingEnquiryStatus.FOLLOW_UP },
    };
    if (nextFollowUpDate) update.$set.nextFollowUpDate = new Date(nextFollowUpDate);

    const enquiry = await BookingEnquiry.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });
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
// Creates one CONFIRMED booking per requested room, inside one transaction, using the same
// pricing (priceStay / GST service) and category inventory claim as booking creation.
// A quoted amount, when present, is the agreed pre-tax room charge for the whole enquiry.
class EnquiryConvertError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export const convertEnquiryToBooking = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { RoomCategory } = await import("../models/RoomCategory");
    const { priceStay } = await import("./booking.controller");
    const { reserveInventoryDays } = await import("../services/booking-safety.service");
    const { computeRoomTax, loadGstRules } = await import("../services/tax.service");
    const { generateBookingReference } = await import("../utils/booking-reference");

    const pre = await BookingEnquiry.findById(req.params.id).lean();
    if (!pre) throw new EnquiryConvertError("Enquiry not found", 404);
    const categoryId = (req.body?.roomCategoryId as string | undefined) || (pre.roomCategoryId ? String(pre.roomCategoryId) : undefined);
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new EnquiryConvertError("Choose the room category for this enquiry before converting it");
    }
    const category = await RoomCategory.findById(categoryId).lean();
    if (!category) throw new EnquiryConvertError("Room category not found", 404);


    const preRooms = Math.max(1, Number(pre.rooms) || 1);
    let bookings: any[] = [];
    await session.withTransaction(async () => {
      bookings = [];
      // Category sell limit, claimed first (like booking creation) for all rooms at once;
      // throws when sold out and the whole conversion rolls back.
      await reserveInventoryDays({ roomCategoryId: String(category._id), checkInDate: pre.checkIn, checkOutDate: pre.checkOut, session, count: preRooms });
      const enquiry = await BookingEnquiry.findById(req.params.id).session(session);
      if (!enquiry) throw new EnquiryConvertError("Enquiry not found", 404);
      if (+enquiry.checkIn !== +pre.checkIn || +enquiry.checkOut !== +pre.checkOut || Math.max(1, Number(enquiry.rooms) || 1) !== preRooms) {
        throw new EnquiryConvertError("The enquiry changed while converting; try again", 409);
      }
      if (enquiry.status === BookingEnquiryStatus.CONVERTED) throw new EnquiryConvertError("This enquiry has already been converted to a booking", 409);
      if ([BookingEnquiryStatus.LOST, BookingEnquiryStatus.CANCELLED].includes(enquiry.status)) {
        throw new EnquiryConvertError(`Cannot convert an enquiry with status: ${enquiry.status}`);
      }
      if (toBusinessDate(enquiry.checkIn) < todayBusinessDate()) throw new EnquiryConvertError("The enquiry's check-in date has passed; update the dates first");
      if (enquiry.checkOut <= enquiry.checkIn) throw new EnquiryConvertError("Check-out must be after check-in");
      const rooms = Math.max(1, Number(enquiry.rooms) || 1);

      // Price per room: the agreed quotation (pre-tax, whole enquiry) or the category rate.
      const listed = await priceStay({ category: category as any, checkIn: enquiry.checkIn, checkOut: enquiry.checkOut });
      const nights = listed.nights;
      let perRoom = { roomCharges: listed.roomCharges, taxAmount: listed.taxAmount, cgst: listed.cgst, sgst: listed.sgst, totalAmount: listed.totalAmount };
      if (enquiry.quotationAmount && enquiry.quotationAmount > 0) {
        const roomCharges = Math.round((enquiry.quotationAmount / rooms) * 100) / 100;
        const tax = computeRoomTax(await loadGstRules(), { checkIn: enquiry.checkIn, checkOut: enquiry.checkOut, nightlyValue: roomCharges / Math.max(1, nights) });
        perRoom = { roomCharges, taxAmount: tax.tax, cgst: tax.cgst, sgst: tax.sgst, totalAmount: tax.total };
      }

      // Guest profile: reuse by email or phone; create only when there is an email (required and unique).
      let guest: any = await Guest.findOne(
        enquiry.email ? { $or: [{ email: enquiry.email.toLowerCase() }, { phone: enquiry.phone }] } : { phone: enquiry.phone },
      ).session(session);
      if (!guest && enquiry.email) {
        [guest] = await Guest.create(
          [{ propertyId: enquiry.propertyId, fullName: enquiry.guestName.trim(), phone: enquiry.phone, email: enquiry.email.toLowerCase() }],
          { session },
        );
      }

      const propertyId = enquiry.propertyId || (req as any).propertyId;
      const [firstName, ...rest] = enquiry.guestName.trim().split(/\s+/);
      const groupId = rooms > 1 ? new mongoose.Types.ObjectId() : undefined;
      for (let i = 0; i < rooms; i++) {
        const bookingReference = await generateBookingReference("ENQ", session);
        const [created] = await Booking.create(
          [{
            propertyId,
            bookingReference,
            customer: guest?._id,
            guestDetails: { firstName, lastName: rest.join(" "), phone: enquiry.phone, email: enquiry.email || "" },
            checkInDate: enquiry.checkIn,
            checkOutDate: enquiry.checkOut,
            adults: i === 0 ? enquiry.adults : 1,
            children: i === 0 ? enquiry.children : 0,
            roomCategory: category._id,
            status: BookingStatus.CONFIRMED,
            source: "ADMIN" as any,
            bookingType: (rooms > 1 ? "GROUP" : "INDIVIDUAL") as any,
            groupId,
            stayType: "NIGHTLY" as any,
            paymentStatus: "UNPAID" as any,
            ratePerNight: Math.round((perRoom.roomCharges / Math.max(1, nights)) * 100) / 100,
            taxAmount: perRoom.taxAmount,
            cgstAmount: perRoom.cgst,
            sgstAmount: perRoom.sgst,
            totalAmount: perRoom.totalAmount,
            paidAmount: 0,
            discountAmount: 0,
            specialRequests: enquiry.specialRequirements,
          }],
          { session },
        );
        bookings.push(created);
      }

      enquiry.status = BookingEnquiryStatus.CONVERTED;
      enquiry.convertedToBookingId = bookings[0]._id;
      enquiry.convertedAt = new Date();
      enquiry.convertedBy = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      enquiry.roomCategoryId = category._id as any;
      await enquiry.save({ session });
    });

    await createAuditLog({
      req,
      action: "enquiry.converted",
      resourceType: "BookingEnquiry",
      resourceId: String(req.params.id),
      metadata: { bookings: bookings.map((x) => x.bookingReference), roomCategoryId: categoryId },
    });

    queueBookingCreatedEmail(bookings.map((x) => x._id));

    const label = bookings.length > 1 ? `${bookings.length} bookings` : `Booking ${bookings[0].bookingReference}`;
    return res.status(201).json({
      success: true,
      message: `${label} created from enquiry`,
      data: {
        booking: { _id: bookings[0]._id, bookingReference: bookings[0].bookingReference },
        bookings: bookings.map((x) => ({ _id: x._id, bookingReference: x.bookingReference, totalAmount: x.totalAmount })),
        enquiryId: req.params.id,
      },
    });
  } catch (error: any) {
    const status =
      error instanceof EnquiryConvertError
        ? error.status
        : error?.name === "BookingConflictError" || /sold out|no (rooms|inventory)|unavailable/i.test(error?.message ?? "")
          ? 409
          : 500;
    return res.status(status).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
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