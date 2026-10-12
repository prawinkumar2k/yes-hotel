import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
import { getAncillaryServices, createAncillaryService } from "../controllers/ancillary.controller";

const router = Router();

router.get("/", protect, requirePropertyAccess, requirePermission("FRONT_DESK", "VIEW"), getAncillaryServices);
router.post("/", protect, requirePropertyAccess, requirePermission("FRONT_DESK", "EDIT"), createAncillaryService);

export default router;
