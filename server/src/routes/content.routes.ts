import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getContentKeys, getContentByKey, createContent, updateContent, deleteContent } from "../controllers/content.controller";

const router = Router();

// Public
router.get("/", getContentKeys);
router.get("/:key", getContentByKey);

// Admin only
const ADMIN_ROLES = [UserRole.ADMIN];
router.post("/", protect, authorize(...ADMIN_ROLES), createContent);
router.patch("/:id", protect, authorize(...ADMIN_ROLES), updateContent);
router.delete("/:id", protect, authorize(...ADMIN_ROLES), deleteContent);

export default router;
