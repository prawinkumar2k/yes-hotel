/**
 * Automatic housekeeping assignment: a room that needs cleaning (checkout, room move, cancelled
 * stay) is given to the housekeeper who is free — no one at Reception or Admin has to assign it.
 *
 * "Free" = an active HOUSEKEEPING user of the room's property who is not cleaning a room right
 * now; among them, the one with the fewest open rooms, then the one who got a room longest ago.
 * When everyone is busy, the least-loaded housekeeper gets it. Waiting (unassigned) rooms are
 * handed out again whenever a housekeeper finishes a room. Staff can still reassign by hand.
 */
import type { Request } from "express";
import mongoose from "mongoose";
import { HousekeepingTask, HousekeepingStatus } from "../models/HousekeepingTask";
import { HousekeepingRoomStatus } from "../models/Room";
import { User, UserRole } from "../models/User";
import { createAuditLog } from "./audit.service";

/** Statuses in which a housekeeper is holding a room. */
const OPEN = [HousekeepingStatus.ASSIGNED, HousekeepingStatus.CLEANING, HousekeepingStatus.INSPECTION_FAILED];
/** Tasks still waiting for someone. */
const WAITING = [HousekeepingStatus.DIRTY];

async function pickHousekeeper(propertyId?: unknown): Promise<{ _id: mongoose.Types.ObjectId; name: string } | null> {
  const staff: any[] = await User.find({ role: UserRole.HOUSEKEEPING, isActive: { $ne: false } })
    .select("_id firstName lastName propertyId propertyIds")
    .lean();
  const pid = propertyId ? String(propertyId) : "";
  const eligible = staff.filter((u) => {
    if (!pid) return true;
    const props = [u.propertyId, ...(u.propertyIds ?? [])].filter(Boolean).map(String);
    return props.length === 0 || props.includes(pid);
  });
  if (!eligible.length) return null;

  const ids = eligible.map((u) => u._id);
  // A room still "held" only while the room itself still needs work (the mobile app moves the room on
  // without touching the task, so the room's own state decides).
  const load = await HousekeepingTask.aggregate([
    { $match: { assignedTo: { $in: ids }, status: { $in: OPEN } } },
    { $lookup: { from: "rooms", localField: "room", foreignField: "_id", as: "r" } },
    { $set: { roomHk: { $arrayElemAt: ["$r.housekeepingStatus", 0] } } },
    { $match: { roomHk: { $in: [HousekeepingRoomStatus.DIRTY, HousekeepingRoomStatus.ASSIGNED, HousekeepingRoomStatus.CLEANING, HousekeepingRoomStatus.INSPECTION_FAILED] } } },
    { $group: { _id: "$assignedTo", open: { $sum: 1 }, cleaning: { $sum: { $cond: [{ $eq: ["$roomHk", HousekeepingRoomStatus.CLEANING] }, 1, 0] } } } },
  ]);
  const last = await HousekeepingTask.aggregate([
    { $match: { assignedTo: { $in: ids }, assignedAt: { $ne: null } } },
    { $group: { _id: "$assignedTo", at: { $max: "$assignedAt" } } },
  ]);
  const byId = new Map(load.map((l: any) => [String(l._id), l]));
  const lastAt = new Map(last.map((l: any) => [String(l._id), new Date(l.at).getTime()]));
  const ranked = eligible
    .map((u) => ({ u, open: byId.get(String(u._id))?.open ?? 0, cleaning: byId.get(String(u._id))?.cleaning ?? 0, last: lastAt.get(String(u._id)) ?? 0 }))
    .sort((a, b) => (a.cleaning > 0 ? 1 : 0) - (b.cleaning > 0 ? 1 : 0) || a.open - b.open || a.last - b.last);
  const best = ranked[0].u;
  return { _id: best._id, name: `${best.firstName ?? ""} ${best.lastName ?? ""}`.trim() || "Housekeeping" };
}

/** Assigns one waiting task. Returns the housekeeper, or null when there is nobody to give it to. */
export async function autoAssignTask(taskId: unknown, opts: { req?: Request } = {}) {
  const task: any = await HousekeepingTask.findById(taskId).populate("room", "roomNumber propertyId housekeepingStatus");
  if (!task || task.assignedTo || !WAITING.includes(task.status)) return null;
  const who = await pickHousekeeper(task.propertyId ?? task.room?.propertyId);
  if (!who) return null;

  // Claim it (a manual assignment at the same moment wins).
  const claimed = await HousekeepingTask.findOneAndUpdate(
    { _id: task._id, assignedTo: { $in: [null, undefined] }, status: { $in: WAITING } },
    { $set: { assignedTo: who._id, assignedAt: new Date(), status: HousekeepingStatus.ASSIGNED } },
    { returnDocument: "after" },
  );
  if (!claimed) return null;
  if (task.room?._id) {
    const { transitionHousekeepingStatus } = await import("./room-state.service");
    await transitionHousekeepingStatus(String(task.room._id), HousekeepingRoomStatus.ASSIGNED, {
      req: opts.req,
      action: "housekeeping.auto_assigned",
      metadata: { taskId: String(task._id), assignedTo: String(who._id) },
    }).catch(() => undefined); // the room may already be further along; the task assignment stands
  }
  await createAuditLog({
    req: opts.req,
    action: "housekeeping.auto_assigned",
    resourceType: "HousekeepingTask",
    resourceId: String(task._id),
    metadata: { room: task.room?.roomNumber, assignedTo: String(who._id), assignedToName: who.name },
  });
  try {
    const { emitToStaff } = await import("../realtime/socket");
    emitToStaff("housekeeping:assigned", { taskId: String(task._id), room: task.room?.roomNumber, assignedTo: String(who._id), name: who.name }, task.propertyId);
  } catch { /* realtime is best effort */ }
  return who;
}

/** Hands out every waiting room (oldest first) — after a checkout, and whenever a housekeeper becomes free. */
export async function assignWaitingTasks(opts: { req?: Request } = {}) {
  const waiting = await HousekeepingTask.find({ status: { $in: WAITING }, assignedTo: { $in: [null, undefined] } })
    .sort({ createdAt: 1 })
    .select("_id")
    .limit(50)
    .lean();
  const out: { taskId: string; assignedTo: string }[] = [];
  for (const t of waiting) {
    const who = await autoAssignTask(t._id, opts);
    if (!who) break; // nobody to assign to
    out.push({ taskId: String(t._id), assignedTo: who.name });
  }
  return out;
}
