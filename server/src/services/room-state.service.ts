import type { Request } from "express";
import { Room, RoomStatus, IRoom } from "../models/Room";
import { createAuditLog } from "./audit.service";

export class IllegalRoomTransitionError extends Error {
  constructor(public readonly from: RoomStatus, public readonly to: RoomStatus) {
    super(`Illegal room status transition: ${from} -> ${to}`);
    this.name = "IllegalRoomTransitionError";
  }
}

/**
 * Single source of truth for legal Room.status transitions. Before this
 * existed, 6 call sites across 4 controllers (booking check-in/check-out,
 * cancellation, housekeeping, maintenance, refund) each mutated Room.status
 * unconditionally with no idea what any of the others were doing — which
 * produced two real, live bugs this centralization fixes:
 *
 * 1. Check-in never checked the room's current status at all. A
 *    receptionist could check a guest into a room already MAINTENANCE (or
 *    already OCCUPIED by someone else) and the system would just silently
 *    accept it — an unavailable room being marked as occupied by a NEW
 *    guest while, say, still under maintenance.
 * 2. Maintenance-ticket resolution and housekeeping-task inspection both
 *    unconditionally forced the room to AVAILABLE regardless of what state
 *    it was actually in. A maintenance ticket filed against a room that is
 *    currently OCCUPIED (a guest reports a broken AC mid-stay is a normal,
 *    real scenario) would, on resolution, incorrectly mark an occupied room
 *    AVAILABLE for a new booking — while a guest is still inside it.
 */
const LEGAL_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  [RoomStatus.AVAILABLE]: [
    RoomStatus.RESERVED,
    RoomStatus.OCCUPIED,
    RoomStatus.CLEANING,
    RoomStatus.MAINTENANCE,
    RoomStatus.OUT_OF_SERVICE,
  ],
  [RoomStatus.RESERVED]: [RoomStatus.OCCUPIED, RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE],
  [RoomStatus.OCCUPIED]: [RoomStatus.CLEANING, RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE],
  [RoomStatus.CLEANING]: [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE],
  // OCCUPIED is a legal restore target here (not just AVAILABLE) — a
  // maintenance ticket can legitimately be filed against a currently
  // OCCUPIED room (a guest reporting an issue mid-stay), and resolving it
  // must be able to put the room back to OCCUPIED rather than incorrectly
  // freeing it up for a new booking while the original guest is still in it.
  [RoomStatus.MAINTENANCE]: [RoomStatus.AVAILABLE, RoomStatus.OCCUPIED, RoomStatus.OUT_OF_SERVICE],
  [RoomStatus.OUT_OF_SERVICE]: [RoomStatus.MAINTENANCE, RoomStatus.AVAILABLE],
};

export function isLegalRoomTransition(from: RoomStatus, to: RoomStatus): boolean {
  if (from === to) return false;
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

export function assertLegalRoomTransition(from: RoomStatus, to: RoomStatus): void {
  if (!isLegalRoomTransition(from, to)) {
    throw new IllegalRoomTransitionError(from, to);
  }
}

/**
 * Validates and applies a room status transition by id, and records an
 * audit entry. Returns the updated room, or null if the room doesn't exist.
 * Throws IllegalRoomTransitionError if the transition isn't legal from the
 * room's current status — callers decide how to surface that (a hard 400
 * for check-in; a silent skip for an auto-restore that no longer applies).
 */
export async function transitionRoomStatus(
  roomId: string,
  to: RoomStatus,
  opts: { req?: Request; action: string; metadata?: Record<string, any> }
): Promise<IRoom | null> {
  const room = await Room.findById(roomId);
  if (!room) return null;

  const from = room.status;
  assertLegalRoomTransition(from, to);

  room.status = to;
  await room.save();

  await createAuditLog({
    req: opts.req,
    action: opts.action,
    resourceType: "Room",
    resourceId: room._id.toString(),
    metadata: { roomNumber: room.roomNumber, from, to, ...opts.metadata },
  });

  return room;
}
