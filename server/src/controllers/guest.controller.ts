import { guestStats, bookingMatchForGuest, isPlaceholderEmail, phoneDigits } from "../services/guest-stats.service";
import { Request, Response } from "express";
import { Guest } from "../models/Guest";
import { Booking } from "../models/Booking";
import { Complaint } from "../models/Complaint";
import { LoyaltyTransaction } from "../models/LoyaltyTransaction";
import { z } from "zod";
import { isStoredDocument } from "../services/checkin-details.service";

const MAX_DOCUMENTS = 12;
const documentSchema = z.object({
  kind: z.enum(["ID_FRONT", "ID_BACK", "PHOTO", "OTHER"]).default("OTHER"),
  label: z.string().max(80).optional(),
  image: z.string().refine(isStoredDocument, "A document is not a supported image (JPEG, PNG, WebP) or PDF, or is too large"),
});
const extraFields = {
  emergencyPhone: z.string().max(30).optional(),
  organization: z.string().max(120).optional(),
  designation: z.string().max(80).optional(),
  gstin: z.string().max(15).optional(),
  vehicleNumber: z.string().max(20).optional(),
};
const last10 = (p?: string | null) => String(p ?? "").replace(/\D/g, "").slice(-10);

const createGuestSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.union([z.literal(""), z.string().email("Enter a valid email, or leave it empty")]).optional(),
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
  ...extraFields,
  documents: z.array(documentSchema).max(MAX_DOCUMENTS).optional(),
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
  email: z.union([z.literal(""), z.string().email("Enter a valid email, or leave it empty")]).optional(),
  ...extraFields,
  addDocuments: z.array(documentSchema).max(MAX_DOCUMENTS).optional(),
  removeDocumentIds: z.array(z.string()).optional(),
});

export const createGuest = async (req: Request, res: Response) => {
  try {
    const { email, documents, ...data } = createGuestSchema.parse(req.body);
    const digits = last10(data.phone);
    if (digits.length < 7) return res.status(400).json({ success: false, message: "Enter a valid phone number" });
    // The same person is never stored twice: the phone (last 10 digits) or a real email finds the existing profile.
    const existing: any = await Guest.findOne({ $or: [{ phone: new RegExp(`${digits}$`) }, ...(email ? [{ email: email.toLowerCase() }] : [])] }).select("_id fullName phone").lean();
    if (existing) {
      return res.status(409).json({ success: false, message: `${existing.fullName} (${existing.phone}) is already in the directory: open that profile and edit it`, existingId: existing._id });
    }
    const guest = await Guest.create({
      ...data,
      // No email: a placeholder (never emailed, never shown), unique per phone: the same convention walk-ins use.
      email: email ? email.toLowerCase() : `guest-${digits}@yeshotels.local`,
      gstin: data.gstin?.toUpperCase(),
      vehicleNumber: data.vehicleNumber?.toUpperCase(),
      documents: (documents ?? []).map((d) => ({ ...d, at: new Date(), by: (req as any).user?.id })),
    });
    const out: any = guest.toObject();
    delete out.documents;
    return res.status(201).json({ success: true, data: { ...out, documentCount: documents?.length ?? 0 } });
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
      query.$or = [{ fullName: rx }, { email: rx }, { phone: rx }, { idNumber: rx }, { organization: rx }, { vehicleNumber: rx }];
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
      Guest.find(query).select("-idNumber -idType -documents").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      Guest.countDocuments(query),
    ]);
    const docCounts = new Map<string, number>(
      (await Guest.aggregate([{ $match: { _id: { $in: rawGuests.map((g: any) => g._id) } } }, { $project: { n: { $size: { $ifNull: ["$documents", []] } } } }])).map((r: any) => [String(r._id), r.n]),
    );
    const guests = await Promise.all(
      rawGuests.map(async (g: any) => {
        const { bookingIds: _ids, ...stats } = await guestStats(g);
        return { ...g, ...stats, documentCount: docCounts.get(String(g._id)) ?? 0, email: isPlaceholderEmail(g.email) ? "" : g.email, placeholderEmail: isPlaceholderEmail(g.email) };
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

    // Every proof on file in one list: papers added in the directory, and the ID photos taken at each stay.
    const g: any = guest.toObject();
    const proofs: any[] = (g.documents ?? []).map((d: any) => ({ id: String(d._id), source: "DIRECTORY", kind: d.kind, label: d.label, image: d.image, at: d.at }));
    const bookingsOut = bookings.map((b: any) => {
      const o = b.toObject();
      for (const image of o.guestDetails?.idProofImages ?? []) proofs.push({ source: "STAY", kind: "ID", label: `ID at stay ${o.bookingReference}`, image, bookingReference: o.bookingReference, at: o.checkedInAt ?? o.createdAt });
      if (o.guestDetails) { o.proofCount = o.guestDetails.idProofImages?.length ?? 0; delete o.guestDetails.idProofImages; }
      return o;
    });
    delete g.documents;
    return res.status(200).json({
      success: true,
      data: { guest: { ...g, totalStays: stats.totalStays, email: isPlaceholderEmail(g.email) ? "" : g.email, placeholderEmail: isPlaceholderEmail(g.email) }, bookings: bookingsOut, proofs, complaints, loyaltyTransactions },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGuest = async (req: Request, res: Response) => {
  try {
    const { addDocuments, removeDocumentIds, email, ...data } = updateGuestSchema.parse(req.body);
    const guest: any = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ success: false, message: "Guest not found" });

    for (const [k, v] of Object.entries(data)) if (v !== undefined && k !== "dateOfBirth") guest[k] = k === "gstin" || k === "vehicleNumber" ? String(v).toUpperCase() : v;
    if (data.dateOfBirth) guest.dateOfBirth = new Date(data.dateOfBirth);
    // A real email can be added to a profile that has none; an existing real email is not changed here.
    if (email && isPlaceholderEmail(guest.email)) {
      if (await Guest.exists({ email: email.toLowerCase(), _id: { $ne: guest._id } })) return res.status(409).json({ success: false, message: "Another guest profile already uses this email" });
      guest.email = email.toLowerCase();
    }
    if (removeDocumentIds?.length) guest.documents = (guest.documents ?? []).filter((d: any) => !removeDocumentIds.includes(String(d._id)));
    if (addDocuments?.length) {
      if ((guest.documents?.length ?? 0) + addDocuments.length > MAX_DOCUMENTS) return res.status(400).json({ success: false, message: `At most ${MAX_DOCUMENTS} documents can be kept on one guest` });
      guest.documents.push(...addDocuments.map((d) => ({ ...d, at: new Date(), by: (req as any).user?.id })));
    }
    await guest.save();
    const out = guest.toObject();
    const documentCount = out.documents?.length ?? 0;
    delete out.documents;
    return res.status(200).json({ success: true, data: { ...out, documentCount } });
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
