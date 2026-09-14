import { Router } from "express";
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

// GET /api/room-rack — full room rack (RECEPTIONIST+)
router.get("/", authorize("RECEPTIONIST", "HOUSEKEEPING", "MANAGER", "ADMIN"), getRoomRack);

// GET /api/room-rack/availability — enhanced availability query
router.get("/availability", authorize("RECEPTIONIST", "MANAGER", "ADMIN"), getRoomAvailability);

// POST /api/room-rack/:id/manual-release — only MANAGER/ADMIN can authorize release
router.post("/:id/manual-release", authorize("MANAGER", "ADMIN"), manualReleaseRoom);

// POST /api/room-rack/:id/sell-status — MANAGER/ADMIN block/unblock rooms
router.post("/:id/sell-status", authorize("MANAGER", "ADMIN"), updateRoomSellStatus);

// POST /api/room-rack/:id/assign-booking
router.post("/:id/assign-booking", authorize("RECEPTIONIST", "MANAGER", "ADMIN"), assignRoomToBooking);

export default router;
