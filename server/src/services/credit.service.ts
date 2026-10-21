/**
 * Credit ("kadan"): the guest leaves part of the bill unpaid and pays it later.
 * The bill is balanced with a credit line (so checkout can close) and the debt is kept as a CreditEntry
 * that the Credits page collects against. Money is counted as received only when it is collected.
 */
import type { Request } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { CreditEntry } from "../models/CreditEntry";
import { FolioLineType } from "../models/FolioLine";
import { Payment, PaymentTxStatus } from "../models/Payment";
import { postCharge } from "./folio.service";

const r2 = (n: number) => Math.round(n * 100) / 100;
export class CreditError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function recordCredit(
  p: { folioId: string; bookingId: string; amount: number; note?: string; by?: string },
  opts: { req?: Request; session?: mongoose.ClientSession },
) {
  const amount = r2(Number(p.amount));
  if (!(amount > 0)) throw new CreditError("Enter an amount greater than zero");
  const q = Booking.findById(p.bookingId).populate("assignedRoom", "roomNumber");
  const booking: any = await (opts.session ? q.session(opts.session) : q);
  if (!booking) throw new CreditError("Booking not found", 404);
  const guestName = [booking.guestDetails?.firstName, booking.guestDetails?.lastName].filter(Boolean).join(" ").trim() || "Guest";
  const phone = booking.guestDetails?.phone;
  if (!phone) throw new CreditError("Credit needs the guest's phone number on the booking, so the dues can be followed up");

  await postCharge(
    { folioId: p.folioId, bookingId: p.bookingId, lineType: FolioLineType.PAYMENT, description: "Credit (Kadan): to be paid later", amount, date: new Date(), postedBy: "CREDIT_KADAN", notes: p.note || undefined },
    { req: opts.req, session: opts.session },
  );
  const [entry] = await CreditEntry.create(
    [{
      propertyId: booking.propertyId, booking: booking._id, folio: p.folioId, guestName, phone, roomNumber: booking.assignedRoom?.roomNumber,
      amount, note: p.note || undefined, createdBy: p.by && mongoose.isValidObjectId(p.by) ? p.by : undefined,
    }],
    { session: opts.session },
  );
  return entry;
}

export async function collectCredit(id: string, p: { amount: number; method: string; reference?: string; by?: string; propertyId?: unknown }) {
  const method = String(p.method ?? "").toUpperCase();
  if (!["CASH", "CARD", "UPI"].includes(method)) throw new CreditError("Choose how it was paid: CASH, CARD or UPI");
  const amount = r2(Number(p.amount));
  if (!(amount > 0)) throw new CreditError("Enter an amount greater than zero");
  if ((method === "CARD" || method === "UPI") && !String(p.reference ?? "").trim()) throw new CreditError(`A ${method} reference (approval code / UTR) is required`);
  const entry = await CreditEntry.findById(id);
  if (!entry || (p.propertyId && String(entry.propertyId) !== String(p.propertyId))) throw new CreditError("Credit not found", 404);
  const due = r2(entry.amount - entry.collectedTotal);
  if (amount > due + 0.001) throw new CreditError(due <= 0 ? "This credit is already settled" : `Only ₹${due.toFixed(2)} is still due`, 409);

  const payment = await Payment.create({
    propertyId: entry.propertyId, booking: entry.booking, amount, currency: "INR", method: method as any, reference: p.reference?.trim() || undefined,
    status: PaymentTxStatus.COMPLETED,
  });
  // Guard against two desks collecting at once: only add if the amount still fits.
  const updated = await CreditEntry.findOneAndUpdate(
    { _id: entry._id, collectedTotal: { $lte: r2(entry.amount - amount) + 0.001 } },
    {
      $inc: { collectedTotal: amount },
      $push: { collections: { amount, method, reference: p.reference?.trim() || undefined, at: new Date(), by: p.by && mongoose.isValidObjectId(p.by) ? p.by : undefined, payment: payment._id } },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    await Payment.deleteOne({ _id: payment._id });
    throw new CreditError("Another collection was recorded at the same time; refresh and try again", 409);
  }
  if (r2(updated.amount - updated.collectedTotal) <= 0.001 && updated.status !== "SETTLED") {
    updated.status = "SETTLED";
    await updated.save();
  }
  return { entry: updated, payment };
}
