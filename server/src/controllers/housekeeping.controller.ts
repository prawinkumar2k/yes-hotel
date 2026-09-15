import { Request, Response } from "express";
import { z } from "zod";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority } from "../models/HousekeepingTask";
import { Room, HousekeepingRoomStatus } from "../models/Room";
import { createAuditLog } from "../services/audit.service";
import {
  transitionHousekeepingStatus,
  IllegalHousekeepingTransitionError,
} from "../services/room-state.service";

const updateTaskSchema = z.object({
  status: z.nativeEnum(HousekeepingStatus).optional(),
  priority: z.nativeEnum(HousekeepingPriority).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const getHousekeepingTasks = async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await HousekeepingTask.find(filter)
      .populate("room", "roomNumber floor")
      .populate("assignedTo", "firstName lastName")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: tasks });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Task status values map 1:1 onto Room.housekeepingStatus by name — both
// enums share the same lifecycle (DIRTY -> ASSIGNED -> CLEANING ->
// CLEANING_COMPLETED -> INSPECTION -> [INSPECTION_FAILED | WAITING_FOR_RELEASE]
// -> CLEAN). CLEAN is the terminal, released-and-sellable state.
const TASK_TO_ROOM_HOUSEKEEPING_STATUS: Partial<Record<HousekeepingStatus, HousekeepingRoomStatus>> = {
  [HousekeepingStatus.DIRTY]: HousekeepingRoomStatus.DIRTY,
  [HousekeepingStatus.ASSIGNED]: HousekeepingRoomStatus.ASSIGNED,
  [HousekeepingStatus.CLEANING]: HousekeepingRoomStatus.CLEANING,
  [HousekeepingStatus.CLEANING_COMPLETED]: HousekeepingRoomStatus.CLEANING_COMPLETED,
  [HousekeepingStatus.INSPECTION]: HousekeepingRoomStatus.INSPECTION,
  [HousekeepingStatus.INSPECTION_FAILED]: HousekeepingRoomStatus.INSPECTION_FAILED,
  [HousekeepingStatus.WAITING_FOR_RELEASE]: HousekeepingRoomStatus.WAITING_FOR_RELEASE,
  [HousekeepingStatus.INSPECTED]: HousekeepingRoomStatus.INSPECTED,
  [HousekeepingStatus.CLEAN]: HousekeepingRoomStatus.CLEAN,
};

export const updateHousekeepingTask = async (req: Request, res: Response) => {
  try {
    const data = updateTaskSchema.parse(req.body);
    const actorId = (req as any).user?.id || (req as any).user?._id;

    const existingTask = await HousekeepingTask.findById(req.params.id).populate("room", "roomNumber floor");
    if (!existingTask) return res.status(404).json({ success: false, message: "Task not found" });

    // Apply the room-side transition FIRST, through the single source of
    // truth for legal housekeeping transitions, so this admin/desktop task
    // board can never push a room through an illegal skip (e.g. straight
    // from DIRTY to CLEAN, bypassing inspection and manual release) — this
    // endpoint previously enforced no legal-transition check at all and had
    // no mapping for INSPECTION/INSPECTION_FAILED/WAITING_FOR_RELEASE, so a
    // room could never actually reach a real "awaiting manual release" state
    // through the desktop UI, and CLEAN never reached the room at all (it
    // was mapped to CLEANING_COMPLETED instead). Only update the task
        // record after the room transition succeeds, so the two can't drift.

    if (existingTask.room && data.status) {
      const roomId = (existingTask.room as any)._id.toString();
      const targetRoomStatus = TASK_TO_ROOM_HOUSEKEEPING_STATUS[data.status];
      if (targetRoomStatus) {
        try {
          await transitionHousekeepingStatus(roomId, targetRoomStatus, {
            req,
            action: "housekeeping.task_status_change",
            metadata: { taskId: existingTask._id.toString() },
            releasedBy: targetRoomStatus === HousekeepingRoomStatus.CLEAN ? actorId?.toString() : undefined,
          });
        } catch (error: any) {
          if (error instanceof IllegalHousekeepingTransitionError) {
            return res.status(400).json({ success: false, message: error.message });
          }
          throw error;
        }
      }
    }

    const task = await HousekeepingTask.findByIdAndUpdate(
      req.params.id,
      { ...data, ...(data.status === HousekeepingStatus.INSPECTED && { completedAt: new Date() }) },
      { returnDocument: "after" }
    ).populate("room", "roomNumber floor");

    await createAuditLog({
      req,
      action: "housekeeping.task_updated",
      resourceType: "HousekeepingTask",
      resourceId: task!._id.toString(),
      metadata: { status: task!.status, priority: task!.priority, room: (task!.room as any)?.roomNumber },
    });

    return res.status(200).json({ success: true, data: task });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE HOUSEKEEPING — room-centric view for MobileHousekeeping.tsx.
//
// The admin desktop Housekeeping page above is task-centric (HousekeepingTask
// documents, with assignment). This is a separate, simpler room-centric view:
// "which rooms currently need attention" and "move this room to the next
// housekeeping state" — matching what a housekeeper walking the floor with a
// phone actually needs. It shares the same underlying Room.housekeepingStatus
// field and the same legal-transition enforcement (transitionHousekeepingStatus),
// so a room can't end up in a state the task-based flow would reject; it does
// NOT create or update a HousekeepingTask record, so the two views can show a
// room at the same housekeeping status without a task ever having existed for it.
// ─────────────────────────────────────────────────────────────────────────────

const ROOM_STATUS_UPDATE_ROLES_REQUIRING_MANAGER = new Set([HousekeepingRoomStatus.INSPECTED]);

const updateRoomStatusSchema = z.object({
  status: z.nativeEnum(HousekeepingRoomStatus),
  notes: z.string().optional(),
});

export const getHousekeepingDashboard = async (_req: Request, res: Response) => {
  try {
    const rooms = await Room.find({
      housekeepingStatus: {
        $in: [
          HousekeepingRoomStatus.DIRTY,
          HousekeepingRoomStatus.CLEANING,
          HousekeepingRoomStatus.CLEANING_COMPLETED,
        ],
      },
    })
      .populate("category", "name")
      .sort({ housekeepingStatus: 1, roomNumber: 1 })
      .lean();

    return res.status(200).json({ success: true, data: { rooms } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoomHousekeepingStatus = async (req: Request, res: Response) => {
  try {
    const { status, notes } = updateRoomStatusSchema.parse(req.body);
    const actorRole = (req as any).user?.role;

    // Passing inspection is a supervisory action — the frontend already
    // hides this button from non-managers, but that's not enforcement, so
    // the backend must reject it independently.
    if (ROOM_STATUS_UPDATE_ROLES_REQUIRING_MANAGER.has(status) && actorRole !== "MANAGER" && actorRole !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Only a manager can pass inspection" });
    }

    const room = await transitionHousekeepingStatus(String(req.params.id), status, {
      req,
      action: "housekeeping.mobile_status_change",
      metadata: { notes },
    });

    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    return res.status(200).json({ success: true, data: room });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    if (error instanceof IllegalHousekeepingTransitionError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
