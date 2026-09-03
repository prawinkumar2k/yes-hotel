import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getGuests, getGuestById, updateGuest, toggleGuestBlock } from "../controllers/guest.controller";

const router = Router();

const STAFF_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST];

router.get("/", protect, authorize(...STAFF_ROLES), getGuests);
router.get("/:id", protect, authorize(...STAFF_ROLES), getGuestById);
router.patch("/:id", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), updateGuest);
router.patch("/:id/block", protect, authorize(UserRole.ADMIN, UserRole.MANAGER), toggleGuestBlock);

export default router;
