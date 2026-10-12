import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getRefunds, initiateRefund } from "../controllers/refund.controller";

const router = Router();

router.get("/", protect, requirePropertyAccess, requirePermission("REFUNDS", "VIEW"), getRefunds);
router.post("/initiate", protect, requirePropertyAccess, requirePermission("REFUNDS", "CREATE"), initiateRefund);

export default router;
