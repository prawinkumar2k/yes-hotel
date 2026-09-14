import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getInventoryItems,
  createInventoryItem,
  recordStockTransaction,
  getStockTransactions,
} from "../controllers/inventory.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER", "HOUSEKEEPING"];

router.get("/", protect, authorize(...ADMIN_ROLES), getInventoryItems);
router.post("/", protect, authorize(...ADMIN_ROLES), createInventoryItem);
router.post("/transaction", protect, authorize(...ADMIN_ROLES), recordStockTransaction);
router.get("/transactions", protect, authorize(...ADMIN_ROLES), getStockTransactions);

export default router;
