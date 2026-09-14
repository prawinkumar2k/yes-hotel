import { Request, Response } from "express";
import { z } from "zod";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority } from "../models/HousekeepingTask";
import { Room, HousekeepingRoomStatus } from "../models/Room";
import { createAuditLog } from "../services/audit.service";

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
