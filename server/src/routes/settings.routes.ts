import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getSettings, updateSettings } from "../controllers/settings.controller";

const router = Router();

// Public setting access
router.get("/public", getSettings);

// Admin routes
router.use(protect);
router.get("/", requirePermission("SETTINGS", "VIEW"), getSettings);
router.patch("/", requirePermission("SETTINGS", "EDIT"), updateSettings);

export default router;
