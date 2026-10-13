/**
 * Maintenance rules (write side).
 *
 *  Status machine
 *    OPEN → ASSIGNED | IN_PROGRESS | CLOSED (cancelled, reason required)
 *    ASSIGNED → IN_PROGRESS | OPEN
 *    IN_PROGRESS → RESOLVED | ASSIGNED
 *    RESOLVED → CLOSED | IN_PROGRESS (reopened)
 *    CLOSED → —
 *
 *  Room effect
 *    While a room has any open CRITICAL ticket it is OUT_OF_ORDER (not sellable). When the
 *    last one is resolved, the sell status it had before is restored. Lower priorities are
 *    recorded against the room without taking it off sale.
 */
import mongoose from "mongoose";
import { MaintenanceTicket, MaintenanceStatus, MaintenancePriority } from "../models/MaintenanceTicket";
import { Room, RoomStatus, SellStatus } from "../models/Room";
import { createAuditLog } from "./audit.service";
import type { Request } from "express";

export const OPEN_TICKET_STATUSES = [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS];

const NEXT: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.OPEN]: [MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CLOSED],
  [MaintenanceStatus.ASSIGNED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.OPEN],
  [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.RESOLVED, MaintenanceStatus.ASSIGNED],
  [MaintenanceStatus.RESOLVED]: [MaintenanceStatus.CLOSED, MaintenanceStatus.IN_PROGRESS],
  [MaintenanceStatus.CLOSED]: [],
};

export class MaintenanceRuleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function assertTicketTransition(from: MaintenanceStatus, to: MaintenanceStatus) {
  if (from === to) return;
  if (!NEXT[from]?.includes(to)) {
    throw new MaintenanceRuleError(`A ${from} ticket cannot move to ${to}. Allowed: ${NEXT[from].join(", ") || "none"}.`);
  }
}

/** Rooms that can be sold (capacity for availability and the category sell limit). */
export const SELLABLE_ROOM_FILTER = {
  status: { $nin: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE, RoomStatus.OUT_OF_ORDER] },
  sellStatus: { $nin: [SellStatus.OUT_OF_ORDER, SellStatus.OUT_OF_SERVICE] },
};

/**
 * Brings a room's sell status in line with its open CRITICAL tickets. Idempotent.
 * The pre-ticket sell status is kept on the room (maintenanceHold) so it can be restored.
 */
export async function syncRoomSellStatusWithTickets(roomId: string, opts: { req?: Request; session?: mongoose.ClientSession } = {}) {
  const room: any = await Room.findById(roomId).session(opts.session ?? null);
  if (!room) return;
  const critical = await MaintenanceTicket.findOne({ room: roomId, priority: MaintenancePriority.CRITICAL, status: { $in: OPEN_TICKET_STATUSES } })
    .session(opts.session ?? null)
    .lean();

  if (critical && room.sellStatus !== SellStatus.OUT_OF_ORDER) {
    const before = room.sellStatus;
    await Room.updateOne(
      { _id: roomId },
      { $set: { sellStatus: SellStatus.OUT_OF_ORDER, maintenanceHold: { previousSellStatus: before, ticket: critical._id, since: new Date() } } },
      { session: opts.session },
    );
    await createAuditLog({ req: opts.req, action: "room.out_of_order", resourceType: "Room", resourceId: String(roomId), metadata: { ticketId: String(critical._id), before } });
  } else if (!critical && room.maintenanceHold) {
    const restore = room.maintenanceHold.previousSellStatus ?? SellStatus.SELLABLE;
    await Room.updateOne({ _id: roomId }, { $set: { sellStatus: restore }, $unset: { maintenanceHold: 1 } }, { session: opts.session });
    await createAuditLog({ req: opts.req, action: "room.back_in_order", resourceType: "Room", resourceId: String(roomId), metadata: { restoredTo: restore } });
  }
}
