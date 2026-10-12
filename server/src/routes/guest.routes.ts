import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getGuests, getGuestById, createGuest, updateGuest, toggleGuestBlock, getMyGuestProfile } from "../controllers/guest.controller";

const router = Router();


// Customer route
router.get("/my/profile", protect, getMyGuestProfile);

router.get("/", protect, requirePropertyAccess, requirePermission("GUESTS", "VIEW"), getGuests);
router.post("/", protect, requirePropertyAccess, requirePermission("GUESTS", "CREATE"), createGuest);
router.get("/:id", protect, requirePropertyAccess, requirePermission("GUESTS", "VIEW"), getGuestById);
router.patch("/:id", protect, requirePropertyAccess, requirePermission("GUESTS", "EDIT"), updateGuest);
router.patch("/:id/block", protect, requirePropertyAccess, requirePermission("GUESTS", "EDIT"), toggleGuestBlock);

export default router;
