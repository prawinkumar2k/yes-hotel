import { Request, Response } from "express";
import { GroupBooking, GroupBookingStatus } from "../models/GroupBooking";
import { createAuditLog } from "../services/audit.service";

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
    const nights = Math.ceil((coDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24));
    if (nights < 1) return res.status(400).json({ success: false, message: "Check-out must be after check-in" });

    // Auto-generate group code
    const prefix = groupName.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4);
    const groupCode = `GRP-${prefix}-${Date.now().toString(36).toUpperCase()}`;

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
      roomBlocks: roomBlocks || [],
      totalPax: Number(totalPax) || 1,
      eventType: eventType || "corporate",
      mealPlan: mealPlan || "EP",
      totalEstimatedValue: Number(totalEstimatedValue) || 0,
      advancePaid: Number(advancePaid) || 0,
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
    const group = await GroupBooking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!group) return res.status(404).json({ success: false, message: "Group booking not found" });

    await createAuditLog({
      req,
      action: "group_booking.status_changed",
      resourceType: "GroupBooking",
      resourceId: group._id.toString(),
      metadata: { groupCode: group.groupCode, newStatus: status },
    });

    return res.json({ success: true, message: `Group booking status updated to ${status}`, data: group });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/group-bookings/:id/advance
 * Record an advance payment received for the group
 */
export const recordGroupAdvance = async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "Valid amount required" });

    const group = await GroupBooking.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: "Group booking not found" });

    group.advancePaid += Number(amount);
    await group.save();

    return res.json({ success: true, message: `Advance of \u20B9${amount} recorded`, data: group });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
