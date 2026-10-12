import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissionAuth";
import { getContentKeys, getContentByKey, createContent, updateContent, deleteContent } from "../controllers/content.controller";

const router = Router();

// Public
router.get("/", getContentKeys);
router.get("/:key", getContentByKey);

// Admin only
router.post("/", protect, requirePermission("CONTENT_MANAGEMENT", "CREATE"), createContent);
router.patch("/:id", protect, requirePermission("CONTENT_MANAGEMENT", "EDIT"), updateContent);
router.delete("/:id", protect, requirePermission("CONTENT_MANAGEMENT", "DELETE"), deleteContent);

export default router;
