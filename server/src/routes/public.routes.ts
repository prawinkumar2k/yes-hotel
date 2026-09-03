import { Router } from "express";
import { FAQ } from "../models/FAQ";
import { Testimonial } from "../models/Testimonial";
import { Gallery } from "../models/Gallery";
import { HotelSettings } from "../models/HotelSettings";
import { WebsiteContent } from "../models/WebsiteContent";
import { RoomCategory } from "../models/RoomCategory";
import { Room } from "../models/Room";

const router = Router();

// GET /api/public/settings
router.get("/settings", async (req, res) => {
  try {
    const settings = await HotelSettings.findOne();
    return res.status(200).json({ success: true, data: settings });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/public/gallery
router.get("/gallery", async (req, res) => {
  try {
    const { category, featured, limit = "50" } = req.query;
    const query: any = { published: true };
    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === "true";

    const images = await Gallery.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(parseInt(limit as string));

    return res.status(200).json({ success: true, data: images });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/public/faqs
router.get("/faqs", async (req, res) => {
  try {
    const faqs = await FAQ.find({ isPublished: true }).sort({ displayOrder: 1 });
    return res.status(200).json({ success: true, data: faqs });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/public/testimonials
router.get("/testimonials", async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isPublished: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(20);
    return res.status(200).json({ success: true, data: testimonials });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/public/content/:key
router.get("/content/:key", async (req, res) => {
  try {
    const content = await WebsiteContent.findOne({ key: req.params.key, isPublished: true });
    if (!content) return res.status(404).json({ success: false, message: "Content not found" });
    return res.status(200).json({ success: true, data: content });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/public/rooms — for public listing
router.get("/rooms", async (req, res) => {
  try {
    const categories = await RoomCategory.find({ isActive: true }).sort({ name: 1 });
    return res.status(200).json({ success: true, data: categories });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
