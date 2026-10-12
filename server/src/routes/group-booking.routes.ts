import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import {
  getGroupBookings,
  getGroupBookingById,
  createGroupBooking,
  updateGroupStatus,
  recordGroupAdvance,
} from "../controllers/group-booking.controller";

const router = Router();

router.use(protect);

router.get("/", requirePermission("GROUP_BOOKINGS", "VIEW"), getGroupBookings);
router.get("/:id", requirePermission("GROUP_BOOKINGS", "VIEW"), getGroupBookingById);
router.post("/", requirePermission("GROUP_BOOKINGS", "CREATE"), createGroupBooking);
router.patch("/:id/status", requirePermission("GROUP_BOOKINGS", "EDIT"), updateGroupStatus);
// Recording an advance is a money-desk mutation (MANAGER / RECEPTIONIST / CASHIER).
router.patch("/:id/advance", requirePermission("ADVANCES", "CREATE"), recordGroupAdvance);

export default router;
