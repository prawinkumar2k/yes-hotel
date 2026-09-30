import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
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

router.get("/templates", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "VIEW"), getInspectionTemplates);
router.post("/submit", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "CREATE"), submitInspectionResult);
router.post("/release", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "CREATE"), releaseRoom);
router.get("/room/:roomId", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "VIEW"), getRoomInspectionHistory);

export default router;
