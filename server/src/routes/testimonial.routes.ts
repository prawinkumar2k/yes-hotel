import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissionAuth";
import { getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } from "../controllers/testimonial.controller";

const router = Router();

// Public
router.get("/", getTestimonials);

// Admin / Manager only
router.post("/", protect, requirePermission("TESTIMONIALS", "CREATE"), createTestimonial);
router.patch("/:id", protect, requirePermission("TESTIMONIALS", "EDIT"), updateTestimonial);
router.delete("/:id", protect, requirePermission("TESTIMONIALS", "DELETE"), deleteTestimonial);

export default router;
