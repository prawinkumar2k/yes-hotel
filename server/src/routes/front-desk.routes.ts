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

// Early check-in / late check-out by the hour.
// GET  /api/front-desk/bookings/:id/time-charge?kind=LATE_CHECK_OUT&hours=3[&amount=]  → price, GST, new time
// POST /api/front-desk/bookings/:id/time-charge  { kind, hours, amount?, reason?, force? } → posts it to the bill
router.get("/bookings/:id/time-charge", requirePropertyAccess, requirePermission("FRONT_DESK", "VIEW"), async (req, res) => {
  const { quoteTimeCharge, TimeChargeError } = await import("../services/time-charge.service");
  try {
    const { booking: _b, ...q } = await quoteTimeCharge({ bookingId: String(req.params.id), kind: String(req.query.kind) as any, hours: Number(req.query.hours), amount: req.query.amount as any });
    return res.json({ success: true, data: q });
  } catch (e: any) {
    if (e instanceof TimeChargeError) return res.status(e.status).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: e.message });
  }
});
router.post("/bookings/:id/time-charge", requirePropertyAccess, requirePermission("FRONT_DESK", "EDIT"), async (req, res) => {
  const { postTimeCharge, TimeChargeError } = await import("../services/time-charge.service");
  try {
    const { kind, hours, amount, reason, force } = req.body ?? {};
    const out = await postTimeCharge({ bookingId: String(req.params.id), kind, hours: Number(hours), amount, reason, force: force === true, actorId: String((req as any).user?.id), req });
    const what = kind === "LATE_CHECK_OUT" ? `Late check-out until ${out.toTime}` : `Early check-in from ${out.toTime}`;
    return res.json({ success: true, message: `${what} added` + (out.total > 0 ? ` — ₹${out.total.toLocaleString("en-IN")} on the bill` : " (no charge)"), data: out });
  } catch (e: any) {
    if (e instanceof TimeChargeError) return res.status(e.status).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/front-desk/bookings/:id/checkout-tariff { ratePerNight, reason? } — tariff typed at
// express / early check-out, for the nights actually stayed.
router.post("/bookings/:id/checkout-tariff", requirePropertyAccess, requirePermission("FRONT_DESK", "EDIT"), async (req, res) => {
  const { PermissionService } = await import("../services/PermissionService");
  if (!(await PermissionService.can((req as any).user, "CAP.EDIT_TARIFF"))) return res.status(403).json({ success: false, message: "Tariffs are set by the front desk" });
  const { applyCheckoutTariff, CheckoutTariffError } = await import("../services/checkout-tariff.service");
  try {
    const { ratePerNight, reason } = req.body ?? {};
    if (ratePerNight === undefined || ratePerNight === null || ratePerNight === "") return res.status(400).json({ success: false, message: "Enter the tariff per night" });
    const out = await applyCheckoutTariff({ bookingId: String(req.params.id), ratePerNight: Number(ratePerNight), reason, actorId: String((req as any).user?.id), req });
    return res.json({ success: true, message: `Tariff ₹${out.rate.toLocaleString("en-IN")} × ${out.nights} night${out.nights > 1 ? "s" : ""} applied` + (out.earlyDeparture?.nightsCredited?.length ? ` (${out.earlyDeparture.nightsCredited.length} unused night(s) credited)` : ""), data: out });
  } catch (e: any) {
    if (e instanceof CheckoutTariffError) return res.status(e.status).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
