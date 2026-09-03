import type { Request } from "express";
import { BookingStatus, IBooking } from "../models/Booking";
import { createAuditLog } from "./audit.service";

export class IllegalBookingTransitionError extends Error {
  constructor(public readonly from: BookingStatus, public readonly to: BookingStatus) {
    super(`Illegal booking status transition: ${from} -> ${to}`);
    this.name = "IllegalBookingTransitionError";
  }
}

/**
 * The single source of truth for which booking status transitions are
 * legal. Before this existed, each controller (booking.controller.ts
 * checkIn/checkOut, cancellation.controller.ts, refund.controller.ts,
 * payment.controller.ts) re-implemented its own ad hoc precondition check —
 * and they disagreed with each other. Concretely: cancelBooking() refused to
 * cancel a CHECKED_IN booking ("Cannot cancel a booking that is
 * CHECKED_IN"), but refund.controller.ts's full-refund path would silently
 * flip a CHECKED_IN booking straight to CANCELLED anyway. That is exactly
 * the kind of state-machine bug a centralized service exists to prevent —
 * fixed here by making CHECKED_IN -> CANCELLED illegal everywhere, and
 * refund.controller.ts now skips the status transition instead of
 * force-cancelling a guest who is physically checked in.
 */
const LEGAL_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED],
  [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
  [BookingStatus.CHECKED_OUT]: [],
  [BookingStatus.CANCELLED]: [],
};

export function isLegalBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return false;
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

export function assertLegalBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!isLegalBookingTransition(from, to)) {
    throw new IllegalBookingTransitionError(from, to);
  }
}

/**
 * Validates and applies a booking status transition in place, and records
 * the audit entry for it. Deliberately does NOT call booking.save() —
 * callers already batch other field changes (assignedRoom, paidAmount, room
 * status side effects) into their own save()/transaction, and forcing a
 * save here would either double-write or require restructuring every call
 * site's transaction boundaries for no real benefit.
 */
export async function transitionBookingStatus(
  booking: IBooking,
  to: BookingStatus,
  opts: { req?: Request; action: string; metadata?: Record<string, any> }
): Promise<void> {
  const from = booking.status;
  assertLegalBookingTransition(from, to);
  booking.status = to;
  await createAuditLog({
    req: opts.req,
    action: opts.action,
    resourceType: "Booking",
    resourceId: booking._id.toString(),
    metadata: { bookingReference: booking.bookingReference, from, to, ...opts.metadata },
  });
}
