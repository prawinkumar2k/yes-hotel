import { Request, Response } from "express";
import { Gallery, GalleryCategory } from "../models/Gallery";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";
import { z } from "zod";
import { createAuditLog } from "../services/audit.service";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const createGallerySchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.nativeEnum(GalleryCategory),
  altText: z.string().min(2),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

const updateGallerySchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.nativeEnum(GalleryCategory).optional(),
  altText: z.string().min(2).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  displayOrder: z.number().optional(),
});

export const getGallery = async (req: Request, res: Response) => {
  try {
    const { category, featured, published, page = "1", limit = "15" } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    const query: any = {};
    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === "true";
    if (published !== undefined) query.published = published === "true";
    
    // For public endpoint, force published=true
    if (req.path.includes('/public')) {
      query.published = true;
    }

    const total = await Gallery.countDocuments(query);
    const images = await Gallery.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l);

    return res.status(200).json({
      success: true,
      data: {
        images,
        total,
        totalPages: Math.ceil(total / l),
        page: p
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadGalleryImage = async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No image file provided" });

    const rawData = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      altText: req.body.altText,
      featured: req.body.featured === "true",
      published: req.body.published !== "false",
      displayOrder: parseInt(req.body.displayOrder) || 0,
    };

    const data = createGallerySchema.parse(rawData);
    const result = await uploadToCloudinary(req.file.buffer, "yes-hotels/gallery");

    const gallery = new Gallery({
      ...data,
      imageUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
    });
    await gallery.save();

    await createAuditLog({ req, action: "gallery.uploaded", resourceType: "Gallery", resourceId: gallery._id.toString(), metadata: { title: gallery.title, category: gallery.category } });

    return res.status(201).json({ success: true, data: gallery });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGalleryImage = async (req: Request, res: Response) => {
  try {
    const data = updateGallerySchema.parse(req.body);
    const gallery = await Gallery.findByIdAndUpdate(req.params.id, data, { new: true });
    
    if (!gallery) return res.status(404).json({ success: false, message: "Image not found" });

    await createAuditLog({ req, action: "gallery.updated", resourceType: "Gallery", resourceId: gallery._id.toString() });

    return res.status(200).json({ success: true, data: gallery });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGalleryImage = async (req: Request, res: Response) => {
  try {
    const gallery = await Gallery.findById(req.params.id);
    if (!gallery) return res.status(404).json({ success: false, message: "Image not found" });

    // Delete from Cloudinary
    if (gallery.cloudinaryPublicId) {
      await deleteFromCloudinary(gallery.cloudinaryPublicId);
    }

    await gallery.deleteOne();

    await createAuditLog({ req, action: "gallery.deleted", resourceType: "Gallery", resourceId: req.params.id, metadata: { title: gallery.title } });

    return res.status(200).json({ success: true, message: "Image deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reorderGallery = async (req: Request, res: Response) => {
  try {
    const { items } = req.body; // Array of { id, displayOrder }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Invalid request format" });
    }

    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { displayOrder: item.displayOrder }
      }
    }));

    if (bulkOps.length > 0) {
      await Gallery.bulkWrite(bulkOps);
    }

    return res.status(200).json({ success: true, message: "Reordered successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
