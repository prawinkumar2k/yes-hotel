import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} from "../controllers/procurement.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/purchase-orders", protect, authorize(...ADMIN_ROLES), getPurchaseOrders);
router.post("/purchase-orders", protect, authorize(...ADMIN_ROLES), createPurchaseOrder);
router.patch("/purchase-orders/:id/status", protect, authorize(...ADMIN_ROLES), updatePurchaseOrderStatus);

export default router;
