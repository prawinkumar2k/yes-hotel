import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getStaffList, createStaff, updateStaff, resetStaffPassword } from "../controllers/staff.controller";

const router = Router();

// Only ADMIN and MANAGER can access staff routes
router.use(protect);

router.get("/", requirePermission("STAFF", "VIEW"), getStaffList);
router.post("/", requirePermission("STAFF", "CREATE"), createStaff);
router.patch("/:id", requirePermission("STAFF", "EDIT"), updateStaff);
router.post("/:id/reset-password", requirePermission("STAFF", "EDIT"), resetStaffPassword);

export default router;
