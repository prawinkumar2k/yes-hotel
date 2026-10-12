import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissionAuth";
import { uploadMiddleware } from "../utils/cloudinary";
import { getGallery, uploadGalleryImage, updateGalleryImage, deleteGalleryImage, reorderGallery } from "../controllers/gallery.controller";

const router = Router();

// Public route for gallery view
router.get("/public", getGallery);

// Admin routes
router.use(protect);

router.get("/", requirePermission("GALLERY", "VIEW"), getGallery);
router.post("/", requirePermission("GALLERY", "CREATE"), uploadMiddleware.single("image"), uploadGalleryImage);
router.patch("/reorder", requirePermission("GALLERY", "EDIT"), reorderGallery);
router.patch("/:id", requirePermission("GALLERY", "EDIT"), updateGalleryImage);
router.delete("/:id", requirePermission("GALLERY", "DELETE"), deleteGalleryImage);

export default router;
