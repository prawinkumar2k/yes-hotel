import { Request, Response } from "express";
import { z } from "zod";
import { Testimonial } from "../models/Testimonial";
import { createAuditLog } from "../services/audit.service";

const testimonialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(1, "Comment is required"),
  avatar: z.string().optional(),
  isPublished: z.boolean().default(false),
  displayOrder: z.number().default(0),
});

export const getTestimonials = async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.publishedOnly === "true") {
      filter.isPublished = true;
    }
    const testimonials = await Testimonial.find(filter).sort({ displayOrder: 1, createdAt: -1 });
    return res.status(200).json({ success: true, data: testimonials });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTestimonial = async (req: Request, res: Response) => {
  try {
    const data = testimonialSchema.parse(req.body);
    const testimonial = await Testimonial.create(data);

    await createAuditLog({ req, action: "testimonial.created", resourceType: "Testimonial", resourceId: testimonial._id.toString() });

    return res.status(201).json({ success: true, data: testimonial });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTestimonial = async (req: Request, res: Response) => {
  try {
    const data = testimonialSchema.partial().parse(req.body);
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, data, { returnDocument: "after" });
    if (!testimonial) return res.status(404).json({ success: false, message: "Testimonial not found" });

    await createAuditLog({ req, action: "testimonial.updated", resourceType: "Testimonial", resourceId: testimonial._id.toString() });

    return res.status(200).json({ success: true, data: testimonial });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTestimonial = async (req: Request, res: Response) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) return res.status(404).json({ success: false, message: "Testimonial not found" });

    await createAuditLog({ req, action: "testimonial.deleted", resourceType: "Testimonial", resourceId: req.params.id });

    return res.status(200).json({ success: true, message: "Testimonial deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
