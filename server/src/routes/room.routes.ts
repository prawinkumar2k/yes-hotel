import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
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
router.get("/", protect, requirePropertyAccess, requirePermission("ROOMS", "VIEW"), getRooms);
router.patch("/:id/status", protect, requirePropertyAccess, requirePermission("ROOMS", "EDIT"), updateRoomStatus);

export default router;
