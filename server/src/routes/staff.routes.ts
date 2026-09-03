import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getStaffList, createStaff, updateStaff, resetStaffPassword } from "../controllers/staff.controller";

const router = Router();

// Only ADMIN and MANAGER can access staff routes
router.use(protect, authorize(UserRole.ADMIN, UserRole.MANAGER));

router.get("/", getStaffList);
router.post("/", createStaff);
router.patch("/:id", updateStaff);
router.post("/:id/reset-password", resetStaffPassword);

export default router;
