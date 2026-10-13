import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getPosOrders, createPosOrder, updateOrderStatus, settlePosOrder, quotePosOrder } from "../controllers/pos.controller";

const router = Router();

router.get("/orders", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "VIEW"), getPosOrders);
router.post("/orders", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "CREATE"), createPosOrder);
// Read-only cart pricing (same calculation as createPosOrder)
router.post("/orders/quote", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "VIEW"), quotePosOrder);
// Per-transition action is checked in the controller: kitchen steps EDIT, BILLED = SETTLE, CANCELLED = VOID.
// CASHIER (and MANAGER) settle: room folio, cash, card or UPI.
router.post("/orders/:id/settle", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "SETTLE"), settlePosOrder);
router.patch("/orders/:id/status", protect, requirePropertyAccess, requirePermission("RESTAURANT_POS", "VIEW"), updateOrderStatus);

export default router;
