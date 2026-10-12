import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissionAuth";
import { getFAQs, createFAQ, updateFAQ, deleteFAQ } from "../controllers/faq.controller";

const router = Router();

// Public
router.get("/", getFAQs);

// Admin / Manager only
router.post("/", protect, requirePermission("FAQS", "CREATE"), createFAQ);
router.patch("/:id", protect, requirePermission("FAQS", "EDIT"), updateFAQ);
router.delete("/:id", protect, requirePermission("FAQS", "DELETE"), deleteFAQ);

export default router;
