import { Request, Response } from "express";
import { Guest } from "../models/Guest";
import { Booking } from "../models/Booking";
import { z } from "zod";

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

export const getGuests = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "15", search } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    const query: any = {};
    if (search) {
      query.$text = { $search: search as string };
    }

    const [guests, total] = await Promise.all([
      Guest.find(query)
        .select("-idNumber -idType") // don't expose sensitive info in list
        .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l),
      Guest.countDocuments(query)
    ]);

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

    // Fetch booking history
    const bookings = await Booking.find({ "guestDetails.email": guest.email })
      .populate("roomCategory", "name")
      .populate("assignedRoom", "roomNumber")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ 
      success: true, 
      data: { guest, bookings } 
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
