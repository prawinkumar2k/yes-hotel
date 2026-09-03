import { Router } from "express";
import { getRoomCategories, getRoomCategoryBySlug, getRooms, updateRoomStatus } from "../controllers/room.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

// Public routes
router.get("/categories", getRoomCategories);
router.get("/categories/:slug", getRoomCategoryBySlug);

// Protected Admin/Manager routes for physical rooms
router.get("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST), getRooms);
router.patch("/:id/status", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST), updateRoomStatus);

export default router;
