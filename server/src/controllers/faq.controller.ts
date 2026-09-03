import { Request, Response } from "express";
import { z } from "zod";
import { FAQ } from "../models/FAQ";
import { createAuditLog } from "../services/audit.service";

const faqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  category: z.string().min(1).default("General"),
  displayOrder: z.number().default(0),
  isPublished: z.boolean().default(true),
});

export const getFAQs = async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.publishedOnly === "true") {
      filter.isPublished = true;
    }
    const faqs = await FAQ.find(filter).sort({ displayOrder: 1, createdAt: -1 });
    return res.status(200).json({ success: true, data: faqs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createFAQ = async (req: Request, res: Response) => {
  try {
    const data = faqSchema.parse(req.body);
    const faq = await FAQ.create(data);

    await createAuditLog({ req, action: "faq.created", resourceType: "FAQ", resourceId: faq._id.toString() });

    return res.status(201).json({ success: true, data: faq });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFAQ = async (req: Request, res: Response) => {
  try {
    const data = faqSchema.partial().parse(req.body);
    const faq = await FAQ.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });

    await createAuditLog({ req, action: "faq.updated", resourceType: "FAQ", resourceId: faq._id.toString() });

    return res.status(200).json({ success: true, data: faq });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFAQ = async (req: Request, res: Response) => {
  try {
    const faq = await FAQ.findByIdAndDelete(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });

    await createAuditLog({ req, action: "faq.deleted", resourceType: "FAQ", resourceId: req.params.id });

    return res.status(200).json({ success: true, message: "FAQ deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
