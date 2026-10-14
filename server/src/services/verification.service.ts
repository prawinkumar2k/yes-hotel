/**
 * Reception verification queue.
 *
 *   submitForVerification()  called by the workflow when a task COMPLETES (room cleaned,
 *                            shift closed with a variance, refund / void / cancellation /
 *                            below-default tariff done). If the same subject was rejected
 *                            earlier and not yet resubmitted, the new request is linked as
 *                            the next attempt. Never throws into the caller's flow.
 *   reviewVerification()     approve (verify) or reject with a reason. Type-specific effects:
 *                              ROOM_RELEASE    approve → room released (CLEAN, sellable);
 *                                              reject  → room back to DIRTY for re-cleaning
 *                              SHIFT_VARIANCE  approve → variance accepted, shift RECONCILED;
 *                                              reject  → returned to the cashier
 *                              others          approve records the check; reject returns the
 *                                              task to the Front Desk / Cashier for correction
 *   resubmitVerification()   the desk resubmits a returned task after correcting it.
 */
import mongoose from "mongoose";
import type { Request } from "express";
import { VerificationRequest, VerificationStatus, VerificationType, IVerificationRequest, ReturnQueue } from "../models/VerificationRequest";
import { createAuditLog } from "./audit.service";

export class VerificationRuleError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export const TYPE_LABEL: Record<VerificationType, string> = {
  [VerificationType.ROOM_RELEASE]: "Room cleaned — release",
  [VerificationType.SHIFT_VARIANCE]: "Cash variance at shift close",
  [VerificationType.REFUND]: "Refund",
  [VerificationType.TARIFF_BELOW_DEFAULT]: "Tariff below default",
  [VerificationType.FOLIO_VOID]: "Folio line voided",
  [VerificationType.CANCEL_WITH_ADVANCE]: "Booking cancelled with advance",
};

const actorOf = (req?: Request) => {
  const u = (req as any)?.user;
  return { id: u?.id ? String(u.id) : undefined, role: u?.role as string | undefined };
};

export interface SubmitParams {
  type: VerificationType;
  subjectKey: string;
  returnQueue: ReturnQueue;
  summary: string;
  amount?: number;
  bookingId?: unknown;
  folioId?: unknown;
  roomId?: unknown;
  propertyId?: unknown;
  details?: Record<string, any>;
  note?: string;
  req?: Request;
  /** For system-triggered submissions with no request (e.g. a background flow). */
  actor?: { id?: string; role?: string };
}

/**
 * Queues completed work for verification. Idempotent per subject while pending; links to an
 * earlier rejected attempt. Failures are logged, never thrown: verification must not undo or
 * block the completed task.
 */
export async function submitForVerification(p: SubmitParams): Promise<IVerificationRequest | null> {
  try {
    const actor = p.actor ?? actorOf(p.req);
    const pending = await VerificationRequest.findOne({ subjectKey: p.subjectKey, status: VerificationStatus.PENDING });
    if (pending) return pending;

    const rejected = await VerificationRequest.findOne({ subjectKey: p.subjectKey, status: VerificationStatus.REJECTED, resubmittedAs: { $exists: false } }).sort({ createdAt: -1 });
    const doc: any = await (VerificationRequest as any).create({
      propertyId: p.propertyId ?? (p.req as any)?.propertyId,
      type: p.type,
      status: VerificationStatus.PENDING,
      subjectKey: p.subjectKey,
      returnQueue: p.returnQueue,
      booking: p.bookingId,
      folio: p.folioId,
      room: p.roomId,
      amount: p.amount,
      summary: p.summary,
      details: p.details,
      submittedBy: actor.id,
      submittedRole: actor.role,
      submittedNote: p.note,
      resubmissionOf: rejected?._id,
      attempt: rejected ? (rejected.attempt ?? 1) + 1 : 1,
      history: [{ at: new Date(), by: actor.id as any, role: actor.role, action: rejected ? "RESUBMITTED" : "SUBMITTED", note: p.note }],
    });
    if (rejected) {
      rejected.resubmittedAs = doc._id as any;
      await rejected.save();
    }
    await createAuditLog({
      req: p.req,
      action: rejected ? "verification.resubmitted" : "verification.submitted",
      resourceType: "VerificationRequest",
      resourceId: String(doc._id),
      metadata: { type: p.type, subjectKey: p.subjectKey, amount: p.amount, attempt: doc.attempt },
    });
    return doc;
  } catch (e: any) {
    if (e?.code === 11000) return VerificationRequest.findOne({ subjectKey: p.subjectKey, status: VerificationStatus.PENDING });
    console.error("verification.submit failed:", e?.message);
    return null;
  }
}

/** Type-specific effect of a decision, run inside the decision's transaction. */
async function applyDecision(request: IVerificationRequest, decision: "APPROVE" | "REJECT", note: string, req: Request, session: mongoose.ClientSession) {
  const actor = actorOf(req);
  if (request.type === VerificationType.ROOM_RELEASE) {
    const { Room } = await import("../models/Room");
    const { HousekeepingRoomStatus } = await import("../models/Room");
    const { HousekeepingTask, HousekeepingStatus } = await import("../models/HousekeepingTask");
    const room = await Room.findById(request.room).session(session);
    if (!room) throw new VerificationRuleError("Room not found", 404);
    if (room.housekeepingStatus !== HousekeepingRoomStatus.CLEANING_COMPLETED) {
      throw new VerificationRuleError(`Room ${room.roomNumber} is ${room.housekeepingStatus}, not awaiting verification`, 409);
    }
    const { transitionHousekeepingStatus } = await import("./room-state.service");
    const to = decision === "APPROVE" ? HousekeepingRoomStatus.CLEAN : HousekeepingRoomStatus.DIRTY;
    await transitionHousekeepingStatus(String(room._id), to, {
      req,
      action: decision === "APPROVE" ? "room.released_after_verification" : "room.reclean_after_verification",
      metadata: { verificationId: String(request._id), note },
      releasedBy: decision === "APPROVE" ? actor.id : undefined,
      session,
    } as any);
    // Keep the room's open housekeeping task in step (approved → CLEAN; rejected → DIRTY with the reason).
    await HousekeepingTask.updateMany(
      { room: room._id, status: HousekeepingStatus.CLEANING_COMPLETED },
      decision === "APPROVE"
        ? { $set: { status: HousekeepingStatus.CLEAN, completedAt: new Date() } }
        : { $set: { status: HousekeepingStatus.DIRTY, notes: `Re-clean requested: ${note}` } },
      { session },
    );
    return;
  }
  if (request.type === VerificationType.SHIFT_VARIANCE && decision === "APPROVE") {
    const { CashierShift, CashierShiftStatus } = await import("../models/CashierShift");
    const shift = await CashierShift.findById(request.details?.shiftId).session(session);
    if (!shift) throw new VerificationRuleError("Shift not found", 404);
    if (shift.status !== CashierShiftStatus.CLOSED || !shift.varianceAcceptanceRequired) {
      throw new VerificationRuleError(`Shift ${shift.shiftNumber} has no variance awaiting acceptance`, 409);
    }
    shift.supervisorApproval = { approvedBy: actor.id as any, approvedAt: new Date(), notes: note || "Verified" };
    shift.varianceAcceptanceRequired = false;
    shift.status = CashierShiftStatus.RECONCILED;
    await shift.save({ session });
  }
}

/** Verify (approve) or reject a pending request. A rejection needs a reason. */
export async function reviewVerification(id: string, decision: "APPROVE" | "REJECT", note: string | undefined, req: Request) {
  const actor = actorOf(req);
  const reviewNote = (note ?? "").trim();
  if (decision === "REJECT" && reviewNote.length < 3) throw new VerificationRuleError("A rejection reason is required");

  const session = await mongoose.startSession();
  let updated: IVerificationRequest | null = null;
  try {
    await session.withTransaction(async () => {
      const current = await VerificationRequest.findById(id).session(session);
      if (!current) throw new VerificationRuleError("Verification task not found", 404);
      if (current.status !== VerificationStatus.PENDING) throw new VerificationRuleError(`This task is already ${current.status}`, 409);
      await applyDecision(current, decision, reviewNote, req, session);
      updated = await VerificationRequest.findOneAndUpdate(
        { _id: id, status: VerificationStatus.PENDING },
        {
          $set: { status: decision === "APPROVE" ? VerificationStatus.APPROVED : VerificationStatus.REJECTED, reviewedBy: actor.id, reviewedAt: new Date(), reviewNote: reviewNote || undefined },
          $push: { history: { at: new Date(), by: actor.id, role: actor.role, action: decision === "APPROVE" ? "APPROVED" : "REJECTED", note: reviewNote || undefined } },
        },
        { returnDocument: "after", session },
      );
      if (!updated) throw new VerificationRuleError("This task was decided by someone else just now", 409);
    });
  } finally {
    await session.endSession();
  }
  const u = updated as unknown as IVerificationRequest;
  await createAuditLog({
    req,
    action: decision === "APPROVE" ? "verification.approved" : "verification.rejected",
    resourceType: "VerificationRequest",
    resourceId: id,
    metadata: { type: u.type, subjectKey: u.subjectKey, amount: u.amount, note: reviewNote, returnQueue: decision === "REJECT" ? u.returnQueue : undefined },
  });
  return u;
}

/**
 * The desk resubmits a returned task after correcting it. Room-release tasks are resubmitted
 * automatically when housekeeping marks the room cleaned again, so they are refused here.
 */
export async function resubmitVerification(id: string, note: string, req: Request) {
  const previous = await VerificationRequest.findById(id);
  if (!previous) throw new VerificationRuleError("Verification task not found", 404);
  if (previous.status !== VerificationStatus.REJECTED) throw new VerificationRuleError("Only a rejected task can be resubmitted", 409);
  if (previous.resubmittedAs) throw new VerificationRuleError("This task has already been resubmitted", 409);
  if (previous.type === VerificationType.ROOM_RELEASE) {
    throw new VerificationRuleError("A re-cleaned room is resubmitted automatically when housekeeping marks it cleaned", 409);
  }
  const why = (note ?? "").trim();
  if (why.length < 3) throw new VerificationRuleError("Describe the correction you made");
  if (previous.type === VerificationType.SHIFT_VARIANCE && previous.details?.shiftId) {
    const { CashierShift } = await import("../models/CashierShift");
    await CashierShift.updateOne({ _id: previous.details.shiftId }, { $set: { varianceReason: why } });
  }
  const next = await submitForVerification({
    type: previous.type,
    subjectKey: previous.subjectKey,
    returnQueue: previous.returnQueue,
    summary: previous.summary,
    amount: previous.amount,
    bookingId: previous.booking,
    folioId: previous.folio,
    roomId: previous.room,
    propertyId: previous.propertyId,
    details: previous.details,
    note: why,
    req,
  });
  if (!next) throw new VerificationRuleError("Could not resubmit; try again", 500);
  return next;
}

export function sendVerificationError(res: any, error: any): boolean {
  if (error instanceof VerificationRuleError) {
    res.status(error.status).json({ success: false, message: error.message });
    return true;
  }
  return false;
}
