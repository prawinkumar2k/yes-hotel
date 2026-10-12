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
    const user = (req as any).user;
    if (!user || !user.email) return res.status(401).json({ success: false, message: "Unauthorized" });

    const guest = await Guest.findOne({ email: user.email.toLowerCase() });
    if (!guest) return res.status(404).json({ success: false, message: "Guest profile not found" });

    // Include loyalty transactions
    const loyaltyTransactions = await LoyaltyTransaction.find({ guest: guest._id }).sort({ date: -1 }).limit(20);

    return res.status(200).json({
      success: true,
      data: {
        guest,
        loyaltyTransactions
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGuests = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "15", search } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    // Auto-sync: Discover any guests from Bookings that do not yet have a profile
    try {
      const recentBookingGuests = await Booking.find({
        $or: [
          { "guestDetails.email": { $exists: true, $ne: "" } },
          { "guestDetails.phone": { $exists: true, $ne: "" } },
        ],
      })
        .select("guestDetails totalAmount checkInDate checkOutDate")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      for (const b of recentBookingGuests) {
        const email = b.guestDetails?.email?.toLowerCase()?.trim();
        const phone = b.guestDetails?.phone?.trim();
        if (!email && !phone) continue;

        const orConditions: any[] = [];
        if (email) orConditions.push({ email });
        if (phone) orConditions.push({ phone });

        const exists = await Guest.findOne({ $or: orConditions });
        if (!exists) {
          const fullName = `${b.guestDetails.firstName || ""} ${b.guestDetails.lastName || ""}`.trim() || "Guest";
          await Guest.create({
            fullName,
            email: email || `${phone || "guest"}@yeshotels.local`,
            phone: phone || "—",
            address: b.guestDetails.address || "",
            city: b.guestDetails.city || "",
            state: b.guestDetails.state || "",
            country: b.guestDetails.country || "India",
            idType: b.guestDetails.idType,
            idNumber: b.guestDetails.idNumber,
            totalBookings: 1,
            totalSpend: b.totalAmount || 0,
            lastStay: b.checkOutDate || b.checkInDate,
          });
        }
      }
    } catch {
      // Ignore background sync errors so user request always succeeds
    }

    const query: any = {};
    if (search && String(search).trim() !== "") {
      const searchRegex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const [rawGuests, total] = await Promise.all([
      Guest.find(query)
        .select("-idNumber -idType") // don't expose sensitive info in list
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l),
      Guest.countDocuments(query)
    ]);

    const guests = await Promise.all(
      rawGuests.map(async (g) => {
        if (!g.totalSpend || g.totalSpend === 0 || !g.lastStay) {
          const guestBookings = await Booking.find({
            $or: [
              { "guestDetails.email": g.email },
              ...(g.phone ? [{ "guestDetails.phone": g.phone }, { "guestDetails.phoneNumber": g.phone }] : []),
            ],
          }).select("totalAmount checkInDate checkOutDate").lean();

          if (guestBookings.length > 0) {
            const calculatedSpend = guestBookings.reduce((sum, b: any) => sum + (b.totalAmount || b.totalPrice || 0), 0);
            const latestStay = guestBookings.reduce((latest: Date | null, b: any) => {
              const d = b.checkOutDate ? new Date(b.checkOutDate) : (b.checkInDate ? new Date(b.checkInDate) : null);
              if (!d) return latest;
              return !latest || d > latest ? d : latest;
            }, null);

            const resolvedSpend = calculatedSpend > 0 ? calculatedSpend : (g.totalSpend || 0);
            const resolvedCount = Math.max(g.totalBookings || 0, guestBookings.length);

            await Guest.findByIdAndUpdate(g._id, {
              totalSpend: resolvedSpend,
              totalBookings: resolvedCount,
              ...(latestStay ? { lastStay: latestStay } : {}),
            });

            const gObj = g.toObject ? g.toObject() : { ...g };
            gObj.totalSpend = resolvedSpend;
            gObj.totalBookings = resolvedCount;
            if (latestStay) gObj.lastStay = latestStay;
            return gObj;
          }
        }
        return g;
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        guests,
        total,
        totalPages: Math.ceil(total / l),
        page: p
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGuestById = async (req: Request, res: Response) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: "Guest not found" });

    // Fetch booking history matching email or phone
    const bookings = await Booking.find({
      $or: [
        { "guestDetails.email": guest.email },
        ...(guest.phone ? [
          { "guestDetails.phone": guest.phone },
          { "guestDetails.phoneNumber": guest.phone },
        ] : []),
      ]
    })
      .populate("roomCategory", "name")
      .populate("assignedRoom", "roomNumber")
      .sort({ createdAt: -1 })
      .limit(50);

    // Live calculation of guest stats from real bookings
    const totalBookingsCount = Math.max(guest.totalBookings || 0, bookings.length);
    const calculatedSpend = bookings.reduce((sum, b: any) => {
      const bTotal = b.totalAmount || b.totalPrice || 0;
      return sum + bTotal;
    }, 0);
    const resolvedSpend = calculatedSpend > 0 ? calculatedSpend : (guest.totalSpend || 0);

    const latestStayDate = bookings.reduce((latest: Date | null, b: any) => {
      const d = b.checkOutDate ? new Date(b.checkOutDate) : (b.checkInDate ? new Date(b.checkInDate) : null);
      if (!d) return latest;
      return !latest || d > latest ? d : latest;
    }, guest.lastStay ? new Date(guest.lastStay) : null);

    const calculatedPoints = (guest.loyaltyPoints && guest.loyaltyPoints > 0)
      ? guest.loyaltyPoints
      : Math.floor(resolvedSpend / 100);

    // Synchronize to guest document if needed
    let hasChanges = false;
    if (guest.totalSpend !== resolvedSpend) {
      guest.totalSpend = resolvedSpend;
      hasChanges = true;
    }
    if (guest.totalBookings !== totalBookingsCount) {
      guest.totalBookings = totalBookingsCount;
      hasChanges = true;
    }
    if (latestStayDate && (!guest.lastStay || guest.lastStay.getTime() !== latestStayDate.getTime())) {
      guest.lastStay = latestStayDate;
      hasChanges = true;
    }
    if ((!guest.loyaltyPoints || guest.loyaltyPoints === 0) && calculatedPoints > 0) {
      guest.loyaltyPoints = calculatedPoints;
      hasChanges = true;
    }

    if (hasChanges) {
      await guest.save();
    }

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
      data: { guest, bookings, complaints, loyaltyTransactions } 
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
