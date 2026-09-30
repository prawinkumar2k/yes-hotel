import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} from "../controllers/procurement.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/purchase-orders", protect, requirePropertyAccess, requirePermission("PROCUREMENT", "VIEW"), getPurchaseOrders);
router.post("/purchase-orders", protect, requirePropertyAccess, requirePermission("PROCUREMENT", "CREATE"), createPurchaseOrder);
router.patch("/purchase-orders/:id/status", protect, requirePropertyAccess, requirePermission("PROCUREMENT", "EDIT"), updatePurchaseOrderStatus);

export default router;
