import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { createAuditLog } from "../services/audit.service";
import { isStoredDocument, MAX_TOTAL_DOCUMENT_CHARS } from "../services/checkin-details.service";

/**
 * ID documents on a booking can be added at any time (before, during or after the stay) and there is no fixed count.
 * The only limit is the total size kept on one booking, so one booking document never outgrows the database's 16 MB cap.
 *
 * POST   /api/bookings/:id/id-documents          { images: string[] }   add one or many
 * DELETE /api/bookings/:id/id-documents/:index                          remove one
 */
export const addIdDocuments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid booking ID" });
    const images: unknown[] = Array.isArray(req.body?.images) ? req.body.images : req.body?.image ? [req.body.image] : [];
    if (!images.length) return res.status(400).json({ success: false, message: "Choose at least one ID document" });
    if (images.length > 50) return res.status(400).json({ success: false, message: "Add at most 50 documents in one go" });
    const bad = images.filter((x) => !isStoredDocument(x));
    if (bad.length) return res.status(400).json({ success: false, message: "A document is not a supported image (JPEG, PNG, WebP) or PDF, or it is too large" });

    const booking: any = await Booking.findById(id).select("guestDetails.idProofImages bookingReference").lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    const existing: string[] = booking.guestDetails?.idProofImages ?? [];
    const fresh = (images as string[]).filter((x) => !existing.includes(x));
    const used = existing.reduce((t, x) => t + x.length, 0) + fresh.reduce((t, x) => t + x.length, 0);
    if (used > MAX_TOTAL_DOCUMENT_CHARS) {
      return res.status(413).json({ success: false, message: "This booking already holds as many ID documents as it can store. Remove some, or add smaller photos." });
    }
    if (fresh.length) await Booking.updateOne({ _id: id }, { $push: { "guestDetails.idProofImages": { $each: fresh } } });
    await createAuditLog({ req, action: "booking.id_documents_added", resourceType: "Booking", resourceId: id, metadata: { bookingReference: booking.bookingReference, added: fresh.length } }).catch(() => undefined);
    return res.json({ success: true, message: fresh.length ? `${fresh.length} ID document${fresh.length > 1 ? "s" : ""} added` : "Those documents were already on the booking", data: { count: existing.length + fresh.length, added: fresh.length } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeIdDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = Number(req.params.index);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(index) || index < 0) return res.status(400).json({ success: false, message: "Invalid request" });
    const booking: any = await Booking.findById(id).select("guestDetails.idProofImages bookingReference").lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    const docs: string[] = booking.guestDetails?.idProofImages ?? [];
    if (index >= docs.length) return res.status(404).json({ success: false, message: "That document was not found" });
    const next = docs.filter((_, i) => i !== index);
    await Booking.updateOne({ _id: id }, { $set: { "guestDetails.idProofImages": next } });
    await createAuditLog({ req, action: "booking.id_document_removed", resourceType: "Booking", resourceId: id, metadata: { bookingReference: booking.bookingReference, position: index + 1 } }).catch(() => undefined);
    return res.json({ success: true, message: "ID document removed", data: { count: next.length } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
