import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import { getAncillaryServices, createAncillaryService } from "../controllers/ancillary.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/", protect, requirePropertyAccess, requirePermission("FRONT_DESK", "VIEW"), getAncillaryServices);
router.post("/", protect, requirePropertyAccess, requirePermission("FRONT_DESK", "CREATE"), createAncillaryService);

export default router;
