import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getSalesReport,
  getRoomStayReport,
  getGstReport,
  getAdvanceReport,
} from "../controllers/reports.controller";

const router = Router();
const MANAGER_ROLES = ["ADMIN", "MANAGER"];

router.get("/sales", protect, authorize(...MANAGER_ROLES), getSalesReport);
router.get("/room-stay", protect, authorize(...MANAGER_ROLES), getRoomStayReport);
router.get("/gst", protect, authorize(...MANAGER_ROLES), getGstReport);
router.get("/advances", protect, authorize(...MANAGER_ROLES), getAdvanceReport);

export default router;
