import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getPosOrders, createPosOrder, updateOrderStatus } from "../controllers/pos.controller";

const router = Router();

router.get("/orders", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "VIEW"), getPosOrders);
router.post("/orders", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "CREATE"), createPosOrder);
// Per-transition action is checked in the controller: kitchen steps EDIT, BILLED = SETTLE, CANCELLED = VOID.
router.patch("/orders/:id/status", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "VIEW"), updateOrderStatus);

export default router;
