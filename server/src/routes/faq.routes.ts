import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getFAQs, createFAQ, updateFAQ, deleteFAQ } from "../controllers/faq.controller";

const router = Router();

// Public
router.get("/", getFAQs);

// Admin / Manager only
const ADMIN_ROLES = [UserRole.ADMIN, UserRole.MANAGER];
router.post("/", protect, authorize(...ADMIN_ROLES), createFAQ);
router.patch("/:id", protect, authorize(...ADMIN_ROLES), updateFAQ);
router.delete("/:id", protect, authorize(...ADMIN_ROLES), deleteFAQ);

export default router;
