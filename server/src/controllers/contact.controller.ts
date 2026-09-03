import { Request, Response } from "express";
import { z } from "zod";
import { ContactMessage, ContactStatus } from "../models/ContactMessage";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

// POST /api/contact — public
export const submitContact = async (req: Request, res: Response) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.issues });
    }
    const msg = await ContactMessage.create(parsed.data);
    return res.status(201).json({ success: true, message: "Your message has been received. We will get back to you within 24 hours.", data: { id: msg._id } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/contact-messages — admin
export const getContactMessages = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", status } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const filter: Record<string, any> = {};
    if (status && status !== "ALL") filter.status = status;

    const [messages, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
      ContactMessage.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, data: { messages, total, totalPages: Math.ceil(total / l), page: p } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/contact-messages/:id/status — admin
export const updateContactStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!Object.values(ContactStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }
    const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
    return res.status(200).json({ success: true, data: msg });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/admin/contact-messages/:id — admin
export const deleteContactMessage = async (req: Request, res: Response) => {
  try {
    const msg = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
    return res.status(200).json({ success: true, message: "Message deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
