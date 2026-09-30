import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { getPosOrders, createPosOrder, updateOrderStatus } from "../controllers/pos.controller";

const router = Router();
const POS_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST", "RESTAURANT", "CASHIER"];

router.get("/orders", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "VIEW"), getPosOrders);
router.post("/orders", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "CREATE"), createPosOrder);
router.patch("/orders/:id/status", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "EDIT"), updateOrderStatus);

export default router;
