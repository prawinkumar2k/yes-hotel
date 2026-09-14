import { Request, Response } from "express";
import { z } from "zod";
import { BookingEnquiry } from "../models/BookingEnquiry";
import { User, UserRole } from "../models/User";
import { NotificationType } from "../models/NotificationLog";
import { sendNotification } from "../services/notification.service";

const enquirySchema = z.object({
  guestName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().min(1).max(30).refine((value) => value.replace(/\D/g, "").length === 10, "Phone number must contain exactly 10 digits"),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  nights: z.coerce.number().int().positive(),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20),
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(20).default([]),
  rooms: z.coerce.number().int().min(1).max(20),
  roomType: z.string().trim().min(1).max(120),
  roomCategoryId: z.string().trim().optional(),
  pricePerNight: z.coerce.number().nonnegative().optional(),
  roomSubtotal: z.coerce.number().nonnegative().optional(),
}).superRefine((value, context) => {
  if (value.checkOut <= value.checkIn) {
    context.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in" });
  }
  const nights = Math.ceil((value.checkOut.getTime() - value.checkIn.getTime()) / 86400000);
  if (value.nights !== nights) {
    context.addIssue({ code: "custom", path: ["nights"], message: "Nights does not match the selected dates" });
  }
  if (value.childAges.length > value.children) {
    context.addIssue({ code: "custom", path: ["childAges"], message: "Child ages must match the number of children" });
  }
});

export const submitBookingEnquiry = async (req: Request, res: Response) => {
  const parsed = enquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Please check the enquiry details", errors: parsed.error.issues });
  }

  try {
    const enquiry = await BookingEnquiry.create(parsed.data);
    const staff = await User.find({
      role: { $in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST] },
      isActive: true,
    }).select("email").lean();
    const configuredRecipients = (process.env.BOOKING_ENQUIRY_RECIPIENTS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const recipients = [...new Set([...staff.map((user) => user.email), ...configuredRecipients])];
    const subject = `New YES Hotels booking enquiry: ${parsed.data.guestName}`;
    const body = [
      "A new booking enquiry has been submitted through the YES Hotels concierge.",
      "",
      `Guest: ${parsed.data.guestName}`,
      `Phone: ${parsed.data.phone}`,
      `Email: ${parsed.data.email || "Not provided"}`,
      `Check-in: ${parsed.data.checkIn.toISOString().slice(0, 10)}`,
      `Check-out: ${parsed.data.checkOut.toISOString().slice(0, 10)}`,
      `Stay: ${parsed.data.nights} night(s)`,
      `Guests: ${parsed.data.adults} adult(s), ${parsed.data.children} child(ren)`,
      `Rooms: ${parsed.data.rooms}`,
      `Room type: ${parsed.data.roomType}`,
      `Price per night: ${parsed.data.pricePerNight == null ? "To be confirmed" : parsed.data.pricePerNight}`,
      `Room subtotal: ${parsed.data.roomSubtotal == null ? "To be confirmed" : parsed.data.roomSubtotal}`,
      "",
      `Enquiry ID: ${enquiry._id.toString()}`,
    ].join("\n");
    await Promise.allSettled(recipients.map((recipientEmail) => sendNotification({
      type: NotificationType.BOOKING_ENQUIRY,
      recipientEmail,
      subject,
      body,
    })));
    return res.status(201).json({ success: true, message: "Your booking enquiry has been sent to YES Hotels.", data: { id: enquiry._id } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "We couldn't submit your enquiry right now. Please try again or contact YES Hotels directly." });
  }
};