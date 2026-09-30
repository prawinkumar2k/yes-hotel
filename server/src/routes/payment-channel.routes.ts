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
import { protect, authorize } from "../middleware/auth.middleware";

const router = Router();

// Only ADMIN, SUPER_ADMIN or authorized MANAGER can manage payment channels
router.use(protect, authorize("ADMIN", "MANAGER"));

router.get("/", getPaymentChannels);
router.get("/:id", getPaymentChannel);
router.post("/", createPaymentChannel);
router.patch("/:id", updatePaymentChannel);
router.delete("/:id", deletePaymentChannel);

export default router;
