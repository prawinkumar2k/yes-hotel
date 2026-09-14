import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  InspectionTemplate,
  InspectionResult,
  InspectionOutcome,
  InspectionResultStatus,
  IInspectionLineResult,
} from "../models/Inspection";
import { Room, RoomStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType } from "../models/HousekeepingTask";
import { createAuditLog } from "../services/audit.service";

const DEFAULT_INSPECTION_ITEMS = [
  { itemCode: "BED_LINEN", label: "Bed Linen & Pillowcases Clean & Made", category: "BED", isMandatory: true, sortOrder: 1 },
  { itemCode: "BATHROOM_CLEAN", label: "Bathroom Sanitized & Fixtures Polished", category: "BATHROOM", isMandatory: true, sortOrder: 2 },
  { itemCode: "AMENITIES_STOCKED", label: "Towels, Toiletries & Fresh Amenities Placed", category: "BATHROOM", isMandatory: true, sortOrder: 3 },
  { itemCode: "AC_CLIMATE", label: "AC & Climate Control Tested", category: "ELECTRONICS", isMandatory: true, sortOrder: 4 },
  { itemCode: "LIGHTS_SWITCHES", label: "All Lights, Switches & Power Outlets Working", category: "ELECTRONICS", isMandatory: false, sortOrder: 5 },
  { itemCode: "TV_REMOTE", label: "TV Functional & Remote Working", category: "ELECTRONICS", isMandatory: false, sortOrder: 6 },
  { itemCode: "DUSTING_SURFACES", label: "Furniture, Desk & Headboard Dusted", category: "CLEANLINESS", isMandatory: true, sortOrder: 7 },
  { itemCode: "FLOOR_VACUUMED", label: "Floors Vacuumed / Mop Dried", category: "CLEANLINESS", isMandatory: true, sortOrder: 8 },
  { itemCode: "MINIBAR_WATER", label: "Complimentary Water Bottles Restocked", category: "AMENITIES", isMandatory: false, sortOrder: 9 },
  { itemCode: "SAFETY_LOCKS", label: "Keycard Reader & Deadbolt Tested", category: "SAFETY", isMandatory: true, sortOrder: 10 },
];

/**
 * GET /api/inspections/templates
 * Fetches inspection templates. Auto-seeds default if empty.
 */
export const getInspectionTemplates = async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.id || (req as any).user?._id;
    let templates = await InspectionTemplate.find({ isActive: true }).lean();

    if (templates.length === 0 && actorId) {
      const seeded = await InspectionTemplate.create({
        name: "Standard Room Inspection Checklist",
        description: "Standard 10-point checklist for hotel room turnover and supervisor release.",
        isDefault: true,
        items: DEFAULT_INSPECTION_ITEMS,
        isActive: true,
        createdBy: actorId,
      });
      templates = [seeded.toObject()];
    }

    return res.status(200).json({ success: true, data: templates });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const submitInspectionSchema = z.object({
  roomId: z.string(),
  housekeepingTaskId: z.string().optional(),
  templateId: z.string().optional(),
  items: z.array(
    z.object({
      itemCode: z.string(),
      label: z.string(),
      isMandatory: z.boolean(),
      outcome: z.nativeEnum(InspectionOutcome),
      notes: z.string().optional(),
    })
  ),
  overallNotes: z.string().optional(),
});

/**
 * POST /api/inspections/submit
 * Submits an immutable room inspection result.
 * If all mandatory items pass -> Room moves to WAITING_FOR_RELEASE.
 * If any mandatory item fails -> Room moves to INSPECTION_FAILED and triggers a re-clean task.
 */
export const submitInspectionResult = async (req: Request, res: Response) => {
  try {
    const data = submitInspectionSchema.parse(req.body);
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const room = await Room.findById(data.roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Determine template
    let templateId = data.templateId;
    if (!templateId) {
      let defaultTpl = await InspectionTemplate.findOne({ isDefault: true, isActive: true });
      if (!defaultTpl && actorId) {
        defaultTpl = await InspectionTemplate.create({
          name: "Standard Room Inspection Checklist",
          description: "Standard 10-point checklist for hotel room turnover.",
          isDefault: true,
          items: DEFAULT_INSPECTION_ITEMS,
          isActive: true,
          createdBy: actorId,
        });
      }
      templateId = defaultTpl?._id.toString();
    }

    const failedItems = data.items
      .filter((item) => item.outcome === InspectionOutcome.FAIL)
      .map((item) => item.itemCode);

    const mandatoryFailed = data.items.some(
      (item) => item.isMandatory && item.outcome === InspectionOutcome.FAIL
    );

    let inspectionStatus: InspectionResultStatus;
    if (mandatoryFailed) {
      inspectionStatus = InspectionResultStatus.FAILED;
    } else if (failedItems.length > 0) {
      inspectionStatus = InspectionResultStatus.PARTIAL;
    } else {
      inspectionStatus = InspectionResultStatus.PASSED;
    }

    // Create immutable InspectionResult
    const inspectionResult = await InspectionResult.create({
      room: room._id,
      housekeepingTask: data.housekeepingTaskId ? new mongoose.Types.ObjectId(data.housekeepingTaskId) : undefined,
      template: templateId ? new mongoose.Types.ObjectId(templateId) : undefined,
      inspectedBy: actorId,
      inspectedAt: new Date(),
      status: inspectionStatus,
      items: data.items as IInspectionLineResult[],
      failedItems,
      mandatoryFailed,
      overallNotes: data.overallNotes,
      triggeredReclean: mandatoryFailed,
    });

    // Update Room & HousekeepingTask based on outcome
    if (mandatoryFailed) {
      room.housekeepingStatus = HousekeepingRoomStatus.INSPECTION_FAILED;
      room.lastInspectedAt = new Date();
      room.lastInspectedBy = actorId;
      await room.save();

      // If there was an active housekeeping task, mark as failed
      if (data.housekeepingTaskId) {
        await HousekeepingTask.findByIdAndUpdate(data.housekeepingTaskId, {
          status: HousekeepingStatus.INSPECTION_FAILED,
          notes: `Inspection failed on items: ${failedItems.join(", ")}. ${data.overallNotes || ""}`.trim(),
        });
      }

      // Automatically spawn a re-clean task
      await HousekeepingTask.create({
        room: room._id,
        taskType: HousekeepingTaskType.TOUCH_UP,
        status: HousekeepingStatus.DIRTY,
        priority: HousekeepingPriority.URGENT,
        notes: `Urgent re-clean required after failed inspection. Issues: ${failedItems.join(", ")}`,
      });

      await createAuditLog({
        req,
        action: "housekeeping.inspection_failed",
        resourceType: "InspectionResult",
        resourceId: inspectionResult._id.toString(),
        metadata: {
          roomId: room._id.toString(),
          roomNumber: room.roomNumber,
          failedItems,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Inspection failed. Room marked INSPECTION_FAILED and urgent re-clean task generated.",
        data: {
          inspectionResult,
          roomHousekeepingStatus: room.housekeepingStatus,
          passed: false,
        },
      });
    }

    // PASSED or PARTIAL without mandatory failures:
    // Transition to WAITING_FOR_RELEASE (NOT sellable CLEAN/READY yet!)
    room.housekeepingStatus = HousekeepingRoomStatus.WAITING_FOR_RELEASE;
    room.lastInspectedAt = new Date();
    room.lastInspectedBy = actorId;
    await room.save();

    if (data.housekeepingTaskId) {
      await HousekeepingTask.findByIdAndUpdate(data.housekeepingTaskId, {
        status: HousekeepingStatus.INSPECTED,
        completedAt: new Date(),
        notes: `Inspection passed. ${data.overallNotes || ""}`.trim(),
      });
    }

    await createAuditLog({
      req,
      action: "housekeeping.inspection_passed",
      resourceType: "InspectionResult",
      resourceId: inspectionResult._id.toString(),
      metadata: {
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        status: inspectionStatus,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Inspection passed successfully. Room is WAITING_FOR_RELEASE.",
      data: {
        inspectionResult,
        roomHousekeepingStatus: room.housekeepingStatus,
        passed: true,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const releaseRoomSchema = z.object({
  roomId: z.string(),
  notes: z.string().optional(),
});

/**
 * POST /api/inspections/release
 * Authoritative release of an inspected room by supervisor or front-desk manager.
 * Transitions:
 * - housekeepingStatus: READY (and CLEAN)
 * - sellStatus: SELLABLE
 * - legacy status: AVAILABLE (if vacant)
 */
export const releaseRoom = async (req: Request, res: Response) => {
  try {
    const { roomId, notes } = releaseRoomSchema.parse(req.body);
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Room must have been inspected and waiting for release
    const validStates = [
      HousekeepingRoomStatus.WAITING_FOR_RELEASE,
      HousekeepingRoomStatus.INSPECTED,
      HousekeepingRoomStatus.CLEANING_COMPLETED, // supervisor override allowed
    ];

    if (!validStates.includes(room.housekeepingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot release room ${room.roomNumber}: current status is ${room.housekeepingStatus}. Room must be INSPECTED or WAITING_FOR_RELEASE.`,
      });
    }

    room.housekeepingStatus = HousekeepingRoomStatus.READY;
    room.sellStatus = SellStatus.SELLABLE;
    if (room.occupancyStatus === "VACANT" || !room.occupancyStatus) {
      room.status = RoomStatus.AVAILABLE;
    }
    room.releasedAt = new Date();
    room.releasedBy = actorId;
    if (notes) {
      room.notes = room.notes ? `${room.notes} | Release note: ${notes}` : `Release note: ${notes}`;
    }
    await room.save();

    await createAuditLog({
      req,
      action: "room.released_to_service",
      resourceType: "Room",
      resourceId: room._id.toString(),
      metadata: {
        roomNumber: room.roomNumber,
        housekeepingStatus: room.housekeepingStatus,
        sellStatus: room.sellStatus,
        releasedBy: actorId,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Room ${room.roomNumber} successfully released to front desk as SELLABLE.`,
      data: room,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/inspections/room/:roomId
 * Returns inspection history for a specific room.
 */
export const getRoomInspectionHistory = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const history = await InspectionResult.find({ room: roomId })
      .populate("inspectedBy", "name email")
      .populate("template", "name")
      .sort({ inspectedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
