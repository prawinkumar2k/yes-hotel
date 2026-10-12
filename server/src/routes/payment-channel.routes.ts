import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import {
  getPaymentChannels,
  getPaymentChannel,
  createPaymentChannel,
  updatePaymentChannel,
  deletePaymentChannel
} from "../controllers/payment-channel.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Only ADMIN, SUPER_ADMIN or authorized MANAGER can manage payment channels
router.use(protect);

router.get("/", requirePermission("PAYMENT_CHANNELS", "VIEW"), getPaymentChannels);
router.get("/:id", requirePermission("PAYMENT_CHANNELS", "VIEW"), getPaymentChannel);
router.post("/", requirePermission("PAYMENT_CHANNELS", "CREATE"), createPaymentChannel);
router.patch("/:id", requirePermission("PAYMENT_CHANNELS", "EDIT"), updatePaymentChannel);
router.delete("/:id", requirePermission("PAYMENT_CHANNELS", "DELETE"), deletePaymentChannel);

export default router;
