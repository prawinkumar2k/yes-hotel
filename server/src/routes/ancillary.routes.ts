import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getAncillaryServices, createAncillaryService } from "../controllers/ancillary.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/", protect, authorize(...ADMIN_ROLES), getAncillaryServices);
router.post("/", protect, authorize(...ADMIN_ROLES), createAncillaryService);

export default router;
