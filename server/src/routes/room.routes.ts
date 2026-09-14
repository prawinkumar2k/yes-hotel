import { Router } from "express";
import { getRoomCategories, getRoomCategoryBySlug, getRooms, updateRoomStatus } from "../controllers/room.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

// Public routes
router.get("/categories", getRoomCategories);
router.get("/categories/:slug", getRoomCategoryBySlug);

// Protected Admin/Manager routes for physical rooms. Read access also
// extends to HOUSEKEEPING and MAINTENANCE — both need the room list for
// pickers (e.g. filing a maintenance ticket against a specific room), and
// the admin sidebar already shows them pages (Housekeeping, Maintenance)
// that depend on it.
router.get("/", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE), getRooms);
router.patch("/:id/status", protect, authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST), updateRoomStatus);

export default router;
