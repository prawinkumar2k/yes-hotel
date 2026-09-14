import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getFrontDeskSummary,
  getTodayArrivals,
  getTodayDepartures,
} from "../controllers/front-desk.controller";

const router = Router();

router.use(protect);

// GET /api/front-desk/summary — the full daily operational snapshot
router.get(
  "/summary",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  getFrontDeskSummary
);

// GET /api/front-desk/arrivals — today's arrivals with search
router.get(
  "/arrivals",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  getTodayArrivals
);

// GET /api/front-desk/departures — today's departures with folio balance
router.get(
  "/departures",
  authorize("RECEPTIONIST", "MANAGER", "ADMIN"),
  getTodayDepartures
);

export default router;
