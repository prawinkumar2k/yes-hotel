import { Request, Response } from "express";
import { z } from "zod";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority } from "../models/HousekeepingTask";
import { RoomStatus } from "../models/Room";
import { createAuditLog } from "../services/audit.service";
import { transitionRoomStatus } from "../services/room-state.service";

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
      { new: true }
    ).populate("room", "roomNumber floor");

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // When cleaned and inspected, make room available — but only if the
    // room is actually still CLEANING. If a maintenance issue was
    // discovered and the room was moved to MAINTENANCE in the meantime,
    // this must NOT silently overwrite that back to AVAILABLE; it's caught
    // (not thrown) because a stale housekeeping task shouldn't block the
    // inspection itself from being recorded.
    if (data.status === HousekeepingStatus.INSPECTED && task.room) {
      await transitionRoomStatus((task.room as any)._id.toString(), RoomStatus.AVAILABLE, {
        req,
        action: "room.cleaned_and_available",
        metadata: { housekeepingTaskId: task._id.toString() },
      }).catch(() => undefined);
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
