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

export const updateHousekeepingTask = async (req: Request, res: Response) => {
  try {
    const data = updateTaskSchema.parse(req.body);

    const task = await HousekeepingTask.findByIdAndUpdate(
      req.params.id,
      { ...data, ...(data.status === HousekeepingStatus.INSPECTED && { completedAt: new Date() }) },
      { returnDocument: "after" }
    ).populate("room", "roomNumber floor");

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Operational lifecycle update for room:
    // Housekeeping tasks drive the physical state; inspection and authorized release make it sellable.
    if (task.room) {
      const roomId = (task.room as any)._id.toString();
      if (data.status === HousekeepingStatus.CLEANING) {
        await Room.findByIdAndUpdate(roomId, {
          housekeepingStatus: HousekeepingRoomStatus.CLEANING,
          lastCleanedAt: new Date(),
        }).catch(() => undefined);
      } else if (data.status === HousekeepingStatus.CLEAN || data.status === HousekeepingStatus.CLEANING_COMPLETED) {
        await Room.findByIdAndUpdate(roomId, {
          housekeepingStatus: HousekeepingRoomStatus.CLEANING_COMPLETED,
          lastCleanedAt: new Date(),
        }).catch(() => undefined);
      } else if (data.status === HousekeepingStatus.INSPECTED) {
        await Room.findByIdAndUpdate(roomId, {
          housekeepingStatus: HousekeepingRoomStatus.WAITING_FOR_RELEASE,
          lastInspectedAt: new Date(),
        }).catch(() => undefined);
      }
    }

    await createAuditLog({
      req,
      action: "housekeeping.task_updated",
      resourceType: "HousekeepingTask",
      resourceId: task._id.toString(),
      metadata: { status: task.status, priority: task.priority, room: (task.room as any)?.roomNumber },
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
