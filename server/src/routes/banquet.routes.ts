import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getBanquetBookings, createBanquetBooking, updateBanquetStatus } from "../controllers/banquet.controller";

const router = Router();

router.get("/", protect, requirePropertyAccess, requirePermission("BANQUETS", "VIEW"), getBanquetBookings);
router.post("/", protect, requirePropertyAccess, requirePermission("BANQUETS", "CREATE"), createBanquetBooking);
router.patch("/:id/status", protect, requirePropertyAccess, requirePermission("BANQUETS", "EDIT"), updateBanquetStatus);

export default router;
