import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { getVendors, createVendor, updateVendor } from "../controllers/vendor.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/", protect, requirePropertyAccess, requirePermission("VENDORS", "VIEW"), getVendors);
router.post("/", protect, requirePropertyAccess, requirePermission("VENDORS", "CREATE"), createVendor);
router.put("/:id", protect, requirePropertyAccess, requirePermission("VENDORS", "EDIT"), updateVendor);

export default router;
