import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } from "../controllers/menu.controller";

const router = Router();

// Read access: anyone who can operate POS (matches pos.routes.ts POS_ROLES),
// plus HOUSEKEEPING/MAINTENANCE are deliberately excluded — the menu is a
// restaurant/front-desk concern, not theirs.
const MENU_READ_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST];
// Write access: menu pricing/catalog changes are a management decision.
const MENU_WRITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

router.get("/", protect, requirePropertyAccess, requirePermission("MENU_MANAGEMENT", "VIEW"), getMenuItems);
router.post("/", protect, requirePropertyAccess, requirePermission("MENU_MANAGEMENT", "CREATE"), createMenuItem);
router.patch("/:id", protect, requirePropertyAccess, requirePermission("MENU_MANAGEMENT", "EDIT"), updateMenuItem);
router.delete("/:id", protect, requirePropertyAccess, requirePermission("MENU_MANAGEMENT", "DELETE"), deleteMenuItem);

export default router;
