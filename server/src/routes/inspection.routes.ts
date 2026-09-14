import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getInspectionTemplates,
  submitInspectionResult,
  releaseRoom,
  getRoomInspectionHistory,
} from "../controllers/inspection.controller";

const router = Router();
const INSPECTOR_ROLES = ["ADMIN", "MANAGER", "HOUSEKEEPING", "RECEPTIONIST"];
const RELEASE_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/templates", protect, authorize(...INSPECTOR_ROLES), getInspectionTemplates);
router.post("/submit", protect, authorize(...INSPECTOR_ROLES), submitInspectionResult);
router.post("/release", protect, authorize(...RELEASE_ROLES), releaseRoom);
router.get("/room/:roomId", protect, authorize(...INSPECTOR_ROLES), getRoomInspectionHistory);

export default router;
