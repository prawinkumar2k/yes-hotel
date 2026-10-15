import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect } from "../middleware/auth.middleware";
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

// POST /api/front-desk/bookings/:id/move-room — move a guest (in-house or arriving) to another room.
// Body: { roomId, rateMode: "KEEP" | "NEW", newRatePerNight?, reason? }
router.post("/bookings/:id/move-room", requirePropertyAccess, requirePermission("FRONT_DESK", "EDIT"), async (req, res) => {
  try {
    const { roomId, rateMode, newRatePerNight, reason } = req.body ?? {};
    if (!/^[a-f0-9]{24}$/i.test(String(req.params.id)) || !/^[a-f0-9]{24}$/i.test(String(roomId))) return res.status(400).json({ success: false, message: "Choose the room to move to" });
    if (rateMode && !["KEEP", "NEW"].includes(rateMode)) return res.status(400).json({ success: false, message: "rateMode must be KEEP or NEW" });
    if (newRatePerNight !== undefined && newRatePerNight !== null && newRatePerNight !== "" && !(Number(newRatePerNight) > 0)) return res.status(400).json({ success: false, message: "Enter a valid nightly rate" });
    const { moveBookingToRoom, RoomMoveError } = await import("../services/room-move.service");
    try {
      const out = await moveBookingToRoom({ bookingId: String(req.params.id), roomId: String(roomId), rateMode, newRatePerNight: newRatePerNight ? Number(newRatePerNight) : undefined, reason, req });
      const diff = out.rateDifference + out.taxDifference.cgst + out.taxDifference.sgst;
      return res.json({ success: true, message: `Moved to room ${out.roomNumber}` + (diff ? `; bill ${diff > 0 ? "increased" : "reduced"} by ₹${Math.abs(diff).toLocaleString("en-IN")}` : ""), data: out });
    } catch (e: any) {
      if (e instanceof RoomMoveError) return res.status(e.status).json({ success: false, message: e.message });
      throw e;
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
