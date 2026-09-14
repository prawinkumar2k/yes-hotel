import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import {
  getGroupBookings,
  getGroupBookingById,
  createGroupBooking,
  updateGroupStatus,
  recordGroupAdvance,
} from "../controllers/group-booking.controller";

const router = Router();

router.use(protect);
router.use(authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST));

router.get("/", getGroupBookings);
router.get("/:id", getGroupBookingById);
router.post("/", createGroupBooking);
router.patch("/:id/status", updateGroupStatus);
router.patch("/:id/advance", recordGroupAdvance);

export default router;
