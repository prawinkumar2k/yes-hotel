import { Request, Response } from "express";
import { GroupBooking, GroupBookingStatus } from "../models/GroupBooking";
import { createAuditLog } from "../services/audit.service";
import { nights as countNights } from "../../../shared/dates";
import mongoose from "mongoose";
import { assertGroupTransition, holdGroupBlocks, prepareGroupInventory, releaseGroupRooms, pickupGroupRoom, GroupRuleError } from "../services/group-block.service";

function groupFail(res: Response, error: any) {
  const status = error instanceof GroupRuleError ? error.status : error?.name === "BookingConflictError" ? 409 : 400;
  return res.status(status).json({ success: false, message: error.message });
}

async function inTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } finally {
    await session.endSession();
  }
}

/**
 * GET /api/group-bookings
 */
export const getGroupBookings = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    const groups = await GroupBooking.find(filter).sort({ createdAt: -1 }).populate("corporateAccountId", "companyName companyCode").lean();
    return res.json({ success: true, data: groups });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/group-bookings/:id
 */
export const getGroupBookingById = async (req: Request, res: Response) => {
  try {
    const group = await GroupBooking.findById(req.params.id).populate("corporateAccountId assignedBookings").lean();
    if (!group) return res.status(404).json({ success: false, message: "Group booking not found" });
    return res.json({ success: true, data: group });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/group-bookings
 */
export const createGroupBooking = async (req: Request, res: Response) => {
  try {
    const {
      groupName, organiserName, organiserEmail, organiserPhone, corporateAccountId,
      checkIn, checkOut, totalRooms, roomBlocks, totalPax, eventType, mealPlan,
      totalEstimatedValue, advancePaid, notes, specialRequirements,
    } = req.body;

    if (!groupName || !organiserName || !checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "groupName, organiserName, checkIn, checkOut are required" });
    }

    const ciDate = new Date(checkIn);
    const coDate = new Date(checkOut);
    const nights = countNights(ciDate, coDate);
    if (nights < 1) return res.status(400).json({ success: false, message: "Check-out must be after check-in" });

    // Auto-generate group code
    const prefix = groupName.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4);
    const { nextSequence } = await import("../services/counter.service");
    const groupCode = `GRP-${prefix || "GRP"}-${String(await nextSequence("group")).padStart(4, "0")}`;

    const group = new GroupBooking({
      groupName,
      groupCode,
      organiserName,
      organiserEmail,
      organiserPhone,
      corporateAccountId: corporateAccountId || undefined,
      checkIn: ciDate,
      checkOut: coDate,
      nights,
      totalRooms: Number(totalRooms) || 1,
      roomBlocks: (roomBlocks || []).map((b: any) => ({ ...b, roomsHeld: 0, roomsPickedUp: 0, roomsConfirmed: 0 })),
      totalPax: Number(totalPax) || 1,
      eventType: eventType || "corporate",
      mealPlan: mealPlan || "EP",
      totalEstimatedValue: Number(totalEstimatedValue) || 0,
      advancePaid: 0, // money is recorded through POST /:id/advance (an AdvancePayment), never typed in
      releaseDate: req.body.releaseDate ? new Date(req.body.releaseDate) : undefined,
      notes,
      specialRequirements,
    });

    await group.save();

    await createAuditLog({
      req,
      action: "group_booking.created",
      resourceType: "GroupBooking",
      resourceId: group._id.toString(),
      metadata: { groupCode, totalRooms, totalEstimatedValue },
    });

    return res.json({ success: true, message: `Group booking ${groupCode} created`, data: group });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/group-bookings/:id/status
 */
export const updateGroupStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!Object.values(GroupBookingStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const current = await GroupBooking.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ success: false, message: "Group booking not found" });
    assertGroupTransition(current.status, status);

    // Confirming holds the block inventory; cancelling releases every unpicked room. Atomic.
    const capacities = status === GroupBookingStatus.CONFIRMED ? await prepareGroupInventory(String(current._id)) : undefined;
    const group = await inTransaction(async (session) => {
      if (capacities) await holdGroupBlocks(String(current._id), capacities, session);
      if (status === GroupBookingStatus.CANCELLED) await releaseGroupRooms(String(current._id), undefined, undefined, session);
      return GroupBooking.findByIdAndUpdate(current._id, { status }, { returnDocument: "after", session });
    });

    await createAuditLog({
      req,
      action: "group_booking.status_changed",
      resourceType: "GroupBooking",
      resourceId: String(current._id),
      metadata: { groupCode: current.groupCode, from: current.status, to: status },
    });
    return res.json({ success: true, message: `Group booking status updated to ${status}`, data: group });
  } catch (error: any) {
    return groupFail(res, error);
  }
};

/** POST /api/group-bookings/:id/pickup { blockIndex, firstName, lastName?, email?, phone, adults?, children? } */
export const pickupGroupRoomHandler = async (req: Request, res: Response) => {
  try {
    const { blockIndex = 0, firstName, phone } = req.body ?? {};
    if (!firstName || !phone) return res.status(400).json({ success: false, message: "Guest first name and phone are required" });
    const { group, booking } = await inTransaction((session) => pickupGroupRoom(String(req.params.id), Number(blockIndex), req.body, session));
    await createAuditLog({ req, action: "group_booking.room_picked_up", resourceType: "GroupBooking", resourceId: String(group._id), metadata: { bookingReference: booking.bookingReference, blockIndex } });
    return res.status(201).json({ success: true, message: `Booking ${booking.bookingReference} added to the rooming list`, data: { group, booking } });
  } catch (error: any) {
    return groupFail(res, error);
  }
};

/** POST /api/group-bookings/:id/release { blockIndex?, count? } */
export const releaseGroupRoomsHandler = async (req: Request, res: Response) => {
  try {
    const { blockIndex, count } = req.body ?? {};
    const { group, released } = await inTransaction((session) =>
      releaseGroupRooms(String(req.params.id), blockIndex == null ? undefined : Number(blockIndex), count == null ? undefined : Number(count), session),
    );
    await createAuditLog({ req, action: "group_booking.rooms_released", resourceType: "GroupBooking", resourceId: String(group._id), metadata: { released, blockIndex } });
    return res.json({ success: true, message: `${released} room(s) released back to sale`, data: group });
  } catch (error: any) {
    return groupFail(res, error);
  }
};

/** GET /api/group-bookings/:id/rooming-list */
export const getRoomingList = async (req: Request, res: Response) => {
  try {
    const group = await GroupBooking.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ success: false, message: "Group booking not found" });
    const { Booking } = await import("../models/Booking");
    const bookings = await Booking.find({ groupId: group._id })
      .select("bookingReference guestDetails roomCategory assignedRoom status checkInDate checkOutDate totalAmount")
      .populate("roomCategory", "name")
      .populate("assignedRoom", "roomNumber")
      .lean();
    const blocks = group.roomBlocks.map((b: any, i: number) => ({ index: i, category: b.categoryName, required: b.roomsRequired, held: b.roomsHeld ?? 0, pickedUp: b.roomsPickedUp ?? 0 }));
    return res.json({ success: true, data: { groupCode: group.groupCode, status: group.status, blocks, bookings } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/group-bookings/:id/advance
 * Record an advance payment received for the group
 */
export const recordGroupAdvance = async (req: Request, res: Response) => {
  try {
    const { amount, method = "CASH", referenceNumber } = req.body ?? {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "Valid amount required" });
    const group = await GroupBooking.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: "Group booking not found" });
    if (group.status === GroupBookingStatus.CANCELLED) return res.status(400).json({ success: false, message: "Cannot take an advance on a cancelled group" });

    // Money is recorded as an AdvancePayment against the organiser's guest profile.
    const { Guest } = await import("../models/Guest");
    const { receiveAdvance } = await import("../services/advance.service");
    const email = group.organiserEmail.toLowerCase();
    const guest =
      (await Guest.findOne({ email })) ??
      (await Guest.create({ fullName: group.organiserName, email, phone: group.organiserPhone, propertyId: (group as any).propertyId } as any));
    const advance = await receiveAdvance(
      {
        propertyId: (group as any).propertyId ? String((group as any).propertyId) : undefined,
        guestId: String(guest._id),
        amount: Number(amount),
        method,
        referenceNumber,
        purpose: `Group ${group.groupCode}`,
        receivedBy: String((req as any).user?.id),
      },
      { req },
    );
    group.advanceIds = [...(group.advanceIds ?? []), advance._id as any];
    group.advancePaid = Math.round(((group.advancePaid || 0) + Number(amount)) * 100) / 100;
    await group.save();

    return res.json({ success: true, message: `Advance ${advance.advanceNumber} of \u20B9${amount} recorded`, data: { group, advance } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
