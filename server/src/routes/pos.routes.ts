import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getPosOrders, createPosOrder, updateOrderStatus } from "../controllers/pos.controller";

const router = Router();
const POS_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "STAFF"];

router.get("/orders", protect, authorize(...POS_ROLES), getPosOrders);
router.post("/orders", protect, authorize(...POS_ROLES), createPosOrder);
router.patch("/orders/:id/status", protect, authorize(...POS_ROLES), updateOrderStatus);

export default router;
