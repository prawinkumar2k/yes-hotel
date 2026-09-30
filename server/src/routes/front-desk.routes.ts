import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getFrontDeskSummary,
  getTodayArrivals,
  getTodayDepartures,
} from "../controllers/front-desk.controller";

const router = Router();

router.use(protect);

// GET /api/front-desk/summary — the full daily operational snapshot
router.get("/summary", requirePropertyAccess, requirePermission("FRONT_DESK", "VIEW"), getFrontDeskSummary
);

// GET /api/front-desk/arrivals — today's arrivals with search
router.get("/arrivals", requirePropertyAccess, requirePermission("FRONT_DESK", "VIEW"), getTodayArrivals
);

// GET /api/front-desk/departures — today's departures with folio balance
router.get("/departures", requirePropertyAccess, requirePermission("FRONT_DESK", "VIEW"), getTodayDepartures
);

export default router;
