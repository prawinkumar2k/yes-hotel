import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getGuests, getGuestById, createGuest, updateGuest, toggleGuestBlock, getMyGuestProfile } from "../controllers/guest.controller";

const router = Router();

const STAFF_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST];

// Customer route
router.get("/my/profile", protect, getMyGuestProfile);

router.get("/", protect, requirePropertyAccess, requirePermission("GUESTS", "VIEW"), getGuests);
router.post("/", protect, requirePropertyAccess, requirePermission("GUESTS", "CREATE"), createGuest);
router.get("/:id", protect, requirePropertyAccess, requirePermission("GUESTS", "VIEW"), getGuestById);
router.patch("/:id", protect, requirePropertyAccess, requirePermission("GUESTS", "EDIT"), updateGuest);
router.patch("/:id/block", protect, requirePropertyAccess, requirePermission("GUESTS", "EDIT"), toggleGuestBlock);

export default router;
