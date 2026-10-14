import type { Request } from "express";
import {
  Room,
  RoomStatus,
  IRoom,
  OccupancyStatus,
  HousekeepingRoomStatus,
  SellStatus,
} from "../models/Room";
import { createAuditLog } from "./audit.service";

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY COMBINED STATUS TRANSITIONS
// Preserved for backward compatibility with existing controllers that still
// use the single `status` field.
// ─────────────────────────────────────────────────────────────────────────────

export class IllegalRoomTransitionError extends Error {
  constructor(public readonly from: RoomStatus, public readonly to: RoomStatus) {
    super(`Illegal room status transition: ${from} -> ${to}`);
    this.name = "IllegalRoomTransitionError";
  }
}

/**
 * Single source of truth for legal Room.status (legacy) transitions.
 *
 * New code should use the three-dimensional state transition functions below.
 * This table is preserved because the existing booking-safety, housekeeping,
 * and maintenance controllers depend on it and have tests passing against it.
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
  // OCCUPIED is a legal restore target — a maintenance ticket can be filed
  // against an occupied room (mid-stay issue), and resolving it must restore
  // OCCUPIED rather than incorrectly freeing the room.
  [RoomStatus.MAINTENANCE]: [RoomStatus.AVAILABLE, RoomStatus.OCCUPIED, RoomStatus.OUT_OF_SERVICE],
  [RoomStatus.OUT_OF_SERVICE]: [RoomStatus.MAINTENANCE, RoomStatus.AVAILABLE, RoomStatus.OUT_OF_ORDER],
  [RoomStatus.OUT_OF_ORDER]: [RoomStatus.MAINTENANCE, RoomStatus.AVAILABLE, RoomStatus.OUT_OF_SERVICE],
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
 * Validates and applies a legacy room status transition, audited.
 * Returns the updated room, or null if the room doesn't exist.
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


// ─────────────────────────────────────────────────────────────────────────────
// THREE-DIMENSIONAL STATE TRANSITIONS (NEW)
// Each dimension (occupancy, housekeeping, sellability) transitions
// independently. The functions below enforce legal transitions per dimension.
// ─────────────────────────────────────────────────────────────────────────────

export class IllegalHousekeepingTransitionError extends Error {
  constructor(public readonly from: HousekeepingRoomStatus, public readonly to: HousekeepingRoomStatus) {
    super(`Illegal housekeeping status transition: ${from} -> ${to}`);
    this.name = "IllegalHousekeepingTransitionError";
  }
}

const LEGAL_HOUSEKEEPING_TRANSITIONS: Record<HousekeepingRoomStatus, HousekeepingRoomStatus[]> = {
  [HousekeepingRoomStatus.CLEAN]: [
    HousekeepingRoomStatus.DIRTY,
    HousekeepingRoomStatus.ASSIGNED, // Allow direct assignment to clean rooms for touch-ups
    HousekeepingRoomStatus.CLEANING, // Allow direct cleaning of clean room (touch-up, sanitization, deep clean)
    HousekeepingRoomStatus.INSPECTION, // Allow supervisor inspection
    HousekeepingRoomStatus.DND,
    HousekeepingRoomStatus.REFUSED_SERVICE,
  ],
  [HousekeepingRoomStatus.DIRTY]: [
    HousekeepingRoomStatus.ASSIGNED,
    HousekeepingRoomStatus.CLEANING,  // direct start without assignment
    HousekeepingRoomStatus.CLEAN,     // supervisor or admin direct override to clean
    HousekeepingRoomStatus.INSPECTION,
    HousekeepingRoomStatus.DND,
    HousekeepingRoomStatus.REFUSED_SERVICE,
  ],
  [HousekeepingRoomStatus.ASSIGNED]: [
    HousekeepingRoomStatus.CLEANING,
    HousekeepingRoomStatus.DIRTY,     // unassigned
    HousekeepingRoomStatus.CLEAN,     // supervisor direct mark clean
    HousekeepingRoomStatus.INSPECTION,
    HousekeepingRoomStatus.DND,
    HousekeepingRoomStatus.REFUSED_SERVICE,
  ],
  [HousekeepingRoomStatus.CLEANING]: [
    HousekeepingRoomStatus.CLEANING_COMPLETED,
    HousekeepingRoomStatus.DIRTY,     // housekeeper paused/cancelled
    HousekeepingRoomStatus.CLEAN,     // direct mark clean
    HousekeepingRoomStatus.INSPECTION,
    HousekeepingRoomStatus.DND,
    HousekeepingRoomStatus.REFUSED_SERVICE,
  ],
  [HousekeepingRoomStatus.CLEANING_COMPLETED]: [
    HousekeepingRoomStatus.INSPECTION,
    HousekeepingRoomStatus.INSPECTED,  // if inspection not required by hotel config
    HousekeepingRoomStatus.WAITING_FOR_RELEASE,
    HousekeepingRoomStatus.CLEAN,      // if neither inspection nor manual release required
    HousekeepingRoomStatus.DIRTY,      // sent back for re-clean without formal inspection
  ],
  [HousekeepingRoomStatus.INSPECTION]: [
    HousekeepingRoomStatus.INSPECTED,
    HousekeepingRoomStatus.INSPECTION_FAILED,
    HousekeepingRoomStatus.WAITING_FOR_RELEASE,
    HousekeepingRoomStatus.CLEAN,
    HousekeepingRoomStatus.DIRTY,
  ],
  [HousekeepingRoomStatus.INSPECTION_FAILED]: [
    HousekeepingRoomStatus.DIRTY,     // sent back to start cleaning again
    HousekeepingRoomStatus.ASSIGNED,  // re-assigned for re-clean
    HousekeepingRoomStatus.CLEANING,  // restart cleaning
    HousekeepingRoomStatus.CLEAN,
  ],
  [HousekeepingRoomStatus.INSPECTED]: [
    HousekeepingRoomStatus.WAITING_FOR_RELEASE,
    HousekeepingRoomStatus.CLEAN,     // if manual release not required
    HousekeepingRoomStatus.DIRTY,
    HousekeepingRoomStatus.CLEANING,
  ],
  [HousekeepingRoomStatus.WAITING_FOR_RELEASE]: [
    HousekeepingRoomStatus.CLEAN,     // after authorized manual release
    HousekeepingRoomStatus.DIRTY,     // re-dirted (e.g. early arrival prep)
    HousekeepingRoomStatus.CLEANING,
  ],
  [HousekeepingRoomStatus.READY]: [
    HousekeepingRoomStatus.DIRTY,
    HousekeepingRoomStatus.CLEAN,
    HousekeepingRoomStatus.CLEANING,
    HousekeepingRoomStatus.DND,
  ],
  [HousekeepingRoomStatus.DND]: [
    HousekeepingRoomStatus.DIRTY,
    HousekeepingRoomStatus.CLEAN,
    HousekeepingRoomStatus.CLEANING,
    HousekeepingRoomStatus.ASSIGNED,
  ],
  [HousekeepingRoomStatus.REFUSED_SERVICE]: [
    HousekeepingRoomStatus.DIRTY,
    HousekeepingRoomStatus.CLEAN,
    HousekeepingRoomStatus.CLEANING,
    HousekeepingRoomStatus.ASSIGNED,
  ],
};

export function isLegalHousekeepingTransition(
  from: HousekeepingRoomStatus,
  to: HousekeepingRoomStatus
): boolean {
  if (from === to) return true; // Idempotent updates are safe and allowed
  return (LEGAL_HOUSEKEEPING_TRANSITIONS[from] ?? []).includes(to);
}

export function assertLegalHousekeepingTransition(
  from: HousekeepingRoomStatus,
  to: HousekeepingRoomStatus
): void {
  if (!isLegalHousekeepingTransition(from, to)) {
    throw new IllegalHousekeepingTransitionError(from, to);
  }
}

/**
 * Applies a new housekeepingStatus to a room, enforces legal transitions,
 * optionally updates sellStatus if the transition makes the room sellable/unsellable,
 * and writes an audit log entry.
 */
export async function transitionHousekeepingStatus(
  roomId: string,
  to: HousekeepingRoomStatus,
  opts: {
    req?: Request;
    action: string;
    metadata?: Record<string, any>;
    // If provided, also update sellStatus atomically
    sellStatus?: SellStatus;
    releasedBy?: string;
    session?: mongoose.ClientSession;
  }
): Promise<IRoom | null> {
  const room = await Room.findById(roomId).session(opts.session ?? null);
  if (!room) return null;

  const from = room.housekeepingStatus;
  assertLegalHousekeepingTransition(from, to);
  // A no-op (e.g. CLEANING → CLEANING) changes nothing and is not audit-logged.
  if (from === to && (opts.sellStatus === undefined || opts.sellStatus === room.sellStatus)) return room;

  const updateFields: Partial<IRoom> = { housekeepingStatus: to };

  if (opts.sellStatus !== undefined) {
    updateFields.sellStatus = opts.sellStatus;
  }

  // When releasing to CLEAN, record who released and when
  if (to === HousekeepingRoomStatus.CLEAN && opts.releasedBy) {
    updateFields.releasedAt = new Date();
    updateFields.releasedBy = new mongoose.Types.ObjectId(opts.releasedBy);
  }
  if (to === HousekeepingRoomStatus.CLEAN || to === HousekeepingRoomStatus.CLEANING) {
    updateFields.lastCleanedAt = new Date();
  }

  // housekeepingStatus and the legacy room.status field are two separate
  // state machines that were never wired together: reaching CLEAN here
  // (the end of DIRTY -> ... -> WAITING_FOR_RELEASE -> CLEAN, the full
  // manual-release lifecycle) left room.status stuck at whatever it was
  // set to at checkout (CLEANING) forever. checkIn() requires room.status
  // === AVAILABLE before assigning a room, and the room rack reads
  // room.status for its AVAILABLE/OCCUPIED/CLEANING display — so a fully
  // released, guest-ready room silently stayed unbookable and stuck
  // showing "Cleaning" until someone manually patched it elsewhere.
  // Reproduced live during a full checkout-to-resale walkthrough. Only
  // sync CLEANING -> AVAILABLE (the legal, expected post-checkout path);
  // never touch OCCUPIED/MAINTENANCE/OUT_OF_SERVICE rooms, whose legacy
  // status is governed by other flows entirely.
  if (to === HousekeepingRoomStatus.CLEAN && room.status === RoomStatus.CLEANING) {
    updateFields.status = RoomStatus.AVAILABLE;
  } else if (to === HousekeepingRoomStatus.CLEANING && room.status === RoomStatus.AVAILABLE && room.occupancyStatus === OccupancyStatus.VACANT) {
    updateFields.status = RoomStatus.CLEANING;
  }

  Object.assign(room, updateFields);
  await room.save({ session: opts.session });

  // Housekeeping finished the room: queue it for Reception verification before it is released.
  if (to === HousekeepingRoomStatus.CLEANING_COMPLETED) {
    const { submitForVerification } = await import("./verification.service");
    const { VerificationType } = await import("../models/VerificationRequest");
    await submitForVerification({
      type: VerificationType.ROOM_RELEASE,
      subjectKey: `room:${room._id}:release`,
      returnQueue: "HOUSEKEEPING",
      summary: `Room ${room.roomNumber} cleaned — verify and release`,
      roomId: room._id,
      propertyId: room.propertyId,
      details: {
        room: room.roomNumber,
        floor: room.floor,
        ...(opts.metadata?.cleaningProofPhoto ? { cleaningProofPhoto: opts.metadata.cleaningProofPhoto } : {}),
      },
      req: opts.req,
    });
  }

  await createAuditLog({
    req: opts.req,
    action: opts.action,
    resourceType: "Room",
    resourceId: room._id.toString(),
    metadata: {
      roomNumber: room.roomNumber,
      housekeepingFrom: from,
      housekeepingTo: to,
      ...(opts.sellStatus ? { sellStatus: opts.sellStatus } : {}),
      ...opts.metadata,
    },
  });

  return room;
}

/**
 * Applies a sellStatus change (SELLABLE ↔ BLOCKED ↔ OUT_OF_ORDER ↔ OUT_OF_SERVICE).
 * Sell status changes do not require a lifecycle check — they can be applied
 * by MANAGER/ADMIN at any time. But they ARE audited.
 */
export async function setSellStatus(
  roomId: string,
  to: SellStatus,
  opts: { req?: Request; action: string; reason?: string; metadata?: Record<string, any> }
): Promise<IRoom | null> {
  const room = await Room.findByIdAndUpdate(
    roomId,
    { sellStatus: to },
    { new: true }
  );
  if (!room) return null;

  await createAuditLog({
    req: opts.req,
    action: opts.action,
    resourceType: "Room",
    resourceId: room._id.toString(),
    metadata: { roomNumber: room.roomNumber, sellStatus: to, reason: opts.reason, ...opts.metadata },
  });

  return room;
}

/**
 * Sets the occupancy status for a room (called on check-in, check-out,
 * reservation assignment, etc.).
 */
export async function setOccupancyStatus(
  roomId: string,
  to: OccupancyStatus,
  opts: {
    req?: Request;
    action: string;
    currentBookingId?: string;
    metadata?: Record<string, any>;
  }
): Promise<IRoom | null> {
  const updateFields: Record<string, any> = { occupancyStatus: to };
  if (opts.currentBookingId) {
    updateFields.currentBooking = opts.currentBookingId;
  } else if (to === OccupancyStatus.VACANT) {
    updateFields.currentBooking = null;
  }

  const room = await Room.findByIdAndUpdate(roomId, updateFields, { new: true });
  if (!room) return null;

  await createAuditLog({
    req: opts.req,
    action: opts.action,
    resourceType: "Room",
    resourceId: room._id.toString(),
    metadata: { roomNumber: room.roomNumber, occupancyStatus: to, ...opts.metadata },
  });

  return room;
}

// Need mongoose for ObjectId construction inside transitionHousekeepingStatus
import mongoose from "mongoose";
