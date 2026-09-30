import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getRoomRack,
  manualReleaseRoom,
  updateRoomSellStatus,
  assignRoomToBooking,
  getRoomAvailability,
} from "../controllers/room-rack.controller";

const router = Router();

// All routes require authentication
router.use(protect);

// GET /api/room-rack — full room rack (RECEPTIONIST+; MAINTENANCE needs read access for the Housekeeping Board)
router.get("/", requirePropertyAccess, requirePermission("ROOM_RACK", "VIEW"), getRoomRack);

// GET /api/room-rack/availability — enhanced availability query
router.get("/availability", requirePropertyAccess, requirePermission("ROOM_RACK", "VIEW"), getRoomAvailability);

// POST /api/room-rack/:id/manual-release — only MANAGER/ADMIN can authorize release
router.post("/:id/manual-release", requirePropertyAccess, requirePermission("ROOM_RACK", "CREATE"), manualReleaseRoom);

// POST /api/room-rack/:id/sell-status — MANAGER/ADMIN block/unblock rooms
router.post("/:id/sell-status", requirePropertyAccess, requirePermission("ROOM_RACK", "CREATE"), updateRoomSellStatus);

// POST /api/room-rack/:id/assign-booking
router.post("/:id/assign-booking", requirePropertyAccess, requirePermission("ROOM_RACK", "CREATE"), assignRoomToBooking);

export default router;
