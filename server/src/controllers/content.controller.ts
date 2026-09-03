import { Request, Response } from "express";
import { z } from "zod";
import { WebsiteContent } from "../models/WebsiteContent";
import { createAuditLog } from "../services/audit.service";

const contentSchema = z.object({
  key: z.string().min(1, "Key is required"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).default([]),
  metadata: z.any().optional(),
  isPublished: z.boolean().default(true),
});

export const getContentKeys = async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.publishedOnly === "true") {
      filter.isPublished = true;
    }
    const contents = await WebsiteContent.find(filter).sort({ key: 1 });
    return res.status(200).json({ success: true, data: contents });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getContentByKey = async (req: Request, res: Response) => {
  try {
    const content = await WebsiteContent.findOne({ key: req.params.key });
    if (!content) return res.status(404).json({ success: false, message: "Content not found" });
    return res.status(200).json({ success: true, data: content });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createContent = async (req: Request, res: Response) => {
  try {
    const data = contentSchema.parse(req.body);
    const existing = await WebsiteContent.findOne({ key: data.key });
    if (existing) return res.status(400).json({ success: false, message: "Content key already exists" });
    const content = await WebsiteContent.create(data);

    await createAuditLog({ req, action: "content.created", resourceType: "WebsiteContent", resourceId: content._id.toString(), metadata: { key: content.key } });

    return res.status(201).json({ success: true, data: content });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateContent = async (req: Request, res: Response) => {
  try {
    const data = contentSchema.partial().parse(req.body);
    if (data.key) {
      const existing = await WebsiteContent.findOne({ key: data.key, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Content key already exists" });
    }
    const content = await WebsiteContent.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!content) return res.status(404).json({ success: false, message: "Content not found" });

    await createAuditLog({ req, action: "content.updated", resourceType: "WebsiteContent", resourceId: content._id.toString(), metadata: { key: content.key } });

    return res.status(200).json({ success: true, data: content });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteContent = async (req: Request, res: Response) => {
  try {
    const content = await WebsiteContent.findByIdAndDelete(req.params.id);
    if (!content) return res.status(404).json({ success: false, message: "Content not found" });

    await createAuditLog({ req, action: "content.deleted", resourceType: "WebsiteContent", resourceId: req.params.id, metadata: { key: content.key } });

    return res.status(200).json({ success: true, message: "Content deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
