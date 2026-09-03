import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } from "../controllers/testimonial.controller";

const router = Router();

// Public
router.get("/", getTestimonials);

// Admin / Manager only
const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MANAGER];
router.post("/", protect, authorize(...ADMIN_ROLES), createTestimonial);
router.patch("/:id", protect, authorize(...ADMIN_ROLES), updateTestimonial);
router.delete("/:id", protect, authorize(...ADMIN_ROLES), deleteTestimonial);

export default router;
