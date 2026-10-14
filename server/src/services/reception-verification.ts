/**
 * Queues completed sensitive front-office actions for Reception verification, with the
 * booking context a reviewer needs. Never blocks or fails the completed action.
 */
import type { Request } from "express";
import { submitForVerification } from "./verification.service";
import { VerificationType, ReturnQueue } from "../models/VerificationRequest";

async function bookingContext(bookingId: unknown) {
  if (!bookingId) return {};
  const { Booking } = await import("../models/Booking");
  await import("../models/Room");
  const b: any = await Booking.findById(bookingId).populate("assignedRoom", "roomNumber").select("bookingReference guestDetails assignedRoom propertyId").lean();
  if (!b) return {};
  return {
    bookingReference: b.bookingReference,
    guest: `${b.guestDetails?.firstName ?? ""} ${b.guestDetails?.lastName ?? ""}`.replace(/\s+\.$/, "").trim(),
    room: b.assignedRoom?.roomNumber,
    propertyId: b.propertyId,
  };
}

export async function queueForVerification(p: {
  type: VerificationType;
  subjectKey: string;
  returnQueue: ReturnQueue;
  summary: string;
  amount?: number;
  bookingId?: unknown;
  folioId?: unknown;
  details?: Record<string, any>;
  note?: string;
  req?: Request;
}) {
  const ctx: any = await bookingContext(p.bookingId);
  const { propertyId, ...bookingFacts } = ctx;
  const where = [bookingFacts.bookingReference, bookingFacts.room ? `Room ${bookingFacts.room}` : undefined, bookingFacts.guest].filter(Boolean).join(" · ");
  return submitForVerification({
    type: p.type,
    subjectKey: p.subjectKey,
    returnQueue: p.returnQueue,
    summary: where ? `${p.summary} — ${where}` : p.summary,
    amount: p.amount,
    bookingId: p.bookingId,
    folioId: p.folioId,
    propertyId,
    details: { ...bookingFacts, ...p.details },
    note: p.note,
    req: p.req,
  });
}
