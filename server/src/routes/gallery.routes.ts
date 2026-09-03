import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { uploadMiddleware } from "../utils/cloudinary";
import { getGallery, uploadGalleryImage, updateGalleryImage, deleteGalleryImage, reorderGallery } from "../controllers/gallery.controller";

const router = Router();

// Public route for gallery view
router.get("/public", getGallery);

// Admin routes
router.use(protect, authorize(UserRole.ADMIN, UserRole.MANAGER));

router.get("/", getGallery);
router.post("/", uploadMiddleware.single("image"), uploadGalleryImage);
router.patch("/reorder", reorderGallery);
router.patch("/:id", updateGalleryImage);
router.delete("/:id", deleteGalleryImage);

export default router;
