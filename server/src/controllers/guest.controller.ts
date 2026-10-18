import { guestStats, bookingMatchForGuest, isPlaceholderEmail, phoneDigits } from "../services/guest-stats.service";
import { Request, Response } from "express";
import { Guest } from "../models/Guest";
import { Booking } from "../models/Booking";
import { Complaint } from "../models/Complaint";
import { LoyaltyTransaction } from "../models/LoyaltyTransaction";
import { z } from "zod";

const createGuestSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  alternatePhone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  nationality: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
});

const updateGuestSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  alternatePhone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  nationality: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
});

export const createGuest = async (req: Request, res: Response) => {
  try {
    const data = createGuestSchema.parse(req.body);
    const existing = await Guest.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "A guest profile with this email already exists" });
    }
    const guest = await Guest.create({
      ...data,
      email: data.email.toLowerCase(),
    });
    return res.status(201).json({ success: true, data: guest });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyGuestProfile = async (req: Request, res: Response) => {
  try {
    // The access token carries the user id and role, not the email: resolve the account first.
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { User } = await import("../models/User");
    const account = await User.findById(userId).select("email role").lean();
    if (!account) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (account.role !== "CUSTOMER") {
      return res.status(403).json({ success: false, message: "Guest profiles are available to guest accounts only" });
    }

    // A guest who has not stayed yet has no guest record: that is not an error.
    const guest = await Guest.findOne({ email: account.email.toLowerCase() });
    const loyaltyTransactions = guest ? await LoyaltyTransaction.find({ guest: guest._id }).sort({ date: -1 }).limit(20) : [];
    // Stays and spend from the bookings and settled bills themselves (by account, email and phone).
    const { totalStays, totalBookings, totalSpend, lastStay } = await guestStats({ _id: userId, email: account.email, phone: guest?.phone });

    return res.status(200).json({
      success: true,
      data: {
        guest,
        loyaltyTransactions,
        stats: { totalStays, totalBookings, totalSpend, lastStay },
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGuests = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "15", search } = req.query;
    const p = Math.max(1, parseInt(page as string) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit as string) || 15));

    // Read-only: listing guests never creates or updates records.
    const query: any = {};
    if (search && String(search).trim() !== "") {
      const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ fullName: rx }, { email: rx }, { phone: rx }];
    }
    // A walk-in profile with a generated placeholder email is hidden when a real profile
    // with the same phone exists (the same person, recorded twice).
    const realPhones = new Set(
      (await Guest.find({ email: { $not: /@(yes-?hotels)\.local$/i } }).select("phone").lean()).map((g: any) => phoneDigits(g.phone)).filter((d) => d.length >= 7),
    );
    const placeholderDupes = (await Guest.find({ email: /@(yes-?hotels)\.local$/i }).select("_id phone").lean())
      .filter((g: any) => realPhones.has(phoneDigits(g.phone)))
      .map((g: any) => g._id);
    if (placeholderDupes.length) query._id = { $nin: placeholderDupes };

    const [rawGuests, total] = await Promise.all([
      Guest.find(query).select("-idNumber -idType").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      Guest.countDocuments(query),
    ]);
    const guests = await Promise.all(
      rawGuests.map(async (g: any) => {
        const { bookingIds: _ids, ...stats } = await guestStats(g);
        return { ...g, ...stats, email: isPlaceholderEmail(g.email) ? "" : g.email, placeholderEmail: isPlaceholderEmail(g.email) };
      }),
    );

    return res.status(200).json({
      success: true,
      data: { guests, total, totalPages: Math.ceil(total / l), page: p, hiddenDuplicates: placeholderDupes.length },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGuestById = async (req: Request, res: Response) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: "Guest not found" });

    // Stays matched by customer id, real email or phone (never by a placeholder email).
    const bookings = await Booking.find(bookingMatchForGuest(guest))
      .populate("roomCategory", "name")
      .populate("assignedRoom", "roomNumber")
      .sort({ checkInDate: -1 })
      .limit(50);
    // Read-only: figures are computed for the response, not written back.
    const { bookingIds: _ids, ...stats } = await guestStats(guest);
    Object.assign(guest, { totalSpend: stats.totalSpend, totalBookings: stats.totalBookings, lastStay: stats.lastStay ?? guest.lastStay });

    // Fetch complaints
    const complaints = await Complaint.find({ guestId: guest._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Fetch loyalty transactions
    const loyaltyTransactions = await LoyaltyTransaction.find({ guestId: guest._id })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ 
      success: true, 
      data: { guest: { ...guest.toObject(), totalStays: stats.totalStays }, bookings, complaints, loyaltyTransactions } 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGuest = async (req: Request, res: Response) => {
  try {
    const data = updateGuestSchema.parse(req.body);
    
    // Convert date string if provided
    const payload: any = { ...data };
    if (data.dateOfBirth) payload.dateOfBirth = new Date(data.dateOfBirth);
    
    const guest = await Guest.findByIdAndUpdate(req.params.id, payload, { returnDocument: "after" });
    if (!guest) return res.status(404).json({ success: false, message: "Guest not found" });
    
    return res.status(200).json({ success: true, data: guest });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleGuestBlock = async (req: Request, res: Response) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: "Guest not found" });
    
    guest.isBlocked = !guest.isBlocked;
    await guest.save();
    
    return res.status(200).json({ success: true, data: guest });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
