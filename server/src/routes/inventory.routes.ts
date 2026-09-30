import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getInventoryItems,
  createInventoryItem,
  recordStockTransaction,
  getStockTransactions,
} from "../controllers/inventory.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER", "HOUSEKEEPING"];

router.get("/", protect, requirePropertyAccess, requirePermission("INVENTORY", "VIEW"), getInventoryItems);
router.post("/", protect, requirePropertyAccess, requirePermission("INVENTORY", "CREATE"), createInventoryItem);
router.post("/transaction", protect, requirePropertyAccess, requirePermission("INVENTORY", "CREATE"), recordStockTransaction);
router.get("/transactions", protect, requirePropertyAccess, requirePermission("INVENTORY", "VIEW"), getStockTransactions);

export default router;
