import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getBanquetBookings, createBanquetBooking, updateBanquetStatus } from "../controllers/banquet.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/", protect, authorize(...ADMIN_ROLES), getBanquetBookings);
router.post("/", protect, authorize(...ADMIN_ROLES), createBanquetBooking);
router.patch("/:id/status", protect, authorize(...ADMIN_ROLES), updateBanquetStatus);

export default router;
