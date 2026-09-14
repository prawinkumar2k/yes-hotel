import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getVendors, createVendor, updateVendor } from "../controllers/vendor.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/", protect, authorize(...ADMIN_ROLES), getVendors);
router.post("/", protect, authorize(...ADMIN_ROLES), createVendor);
router.put("/:id", protect, authorize(...ADMIN_ROLES), updateVendor);

export default router;
