import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getSettings, updateSettings } from "../controllers/settings.controller";

const router = Router();

// Public setting access
router.get("/public", getSettings);

// Admin routes
router.use(protect, authorize(UserRole.ADMIN, UserRole.MANAGER));
router.get("/", getSettings);
router.patch("/", updateSettings);

export default router;
