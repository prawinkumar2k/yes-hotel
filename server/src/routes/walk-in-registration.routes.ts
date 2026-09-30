/**
 * Walk-in Guest Registration Routes
 *
 * Base: /api/front-desk/registration (registered in server/index.ts)
 *
 * All routes require authentication. RECEPTIONIST, MANAGER, and ADMIN
 * roles can perform registrations.
 */
import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  searchGuest,
  getAvailableRoomsForRegistration,
  calculateRegistrationRate,
  walkInArrivalRegistration,
  walkInCheckIn,
  printRegistrationCard,
  getRegistrationReport,
} from "../controllers/walk-in-registration.controller";

const router = Router();

// All registration routes require authentication
router.use(protect);

const DESK_ROLES = ["RECEPTIONIST", "MANAGER", "ADMIN"] as const;

/**
 * GET /api/front-desk/registration/guest-search?q=<query>
 * Search existing guests by phone, email, name, or ID number.
 * Returns Guest CRM matches + recent Booking records.
 */
router.get("/guest-search", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "VIEW"), searchGuest);

/**
 * GET /api/front-desk/registration/available-rooms
 * ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&categoryId=&adults=
 * Returns rooms that are CLEAN/READY, SELLABLE, VACANT and have no
 * overlapping confirmed/checked-in booking.
 */
router.get("/available-rooms", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "VIEW"), getAvailableRoomsForRegistration);

/**
 * POST /api/front-desk/registration/calculate-rate
 * Body: { roomId, checkIn, checkOut, extraBeds, extraBedCharge, discountAmount }
 * Server calculates the final rate — frontend must display this value.
 */
router.post("/calculate-rate", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "CREATE"), calculateRegistrationRate);

/**
 * POST /api/front-desk/registration/walk-in
 * The main registration endpoint.
 * Creates Guest + Booking + AdvancePayment atomically.
 * Does NOT perform check-in — that is a separate step.
 */
router.post("/walk-in", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "CREATE"), walkInArrivalRegistration);

/**
 * POST /api/front-desk/registration/:bookingId/check-in
 * Atomically checks in the guest:
 * 1. Booking → CHECKED_IN
 * 2. Room → OCCUPIED
 * 3. Folio created
 * 4. Room tariff + extra bed posted
 */
router.post("/:bookingId/check-in", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "CREATE"), walkInCheckIn);

/**
 * GET /api/front-desk/registration/:bookingId/print
 * Returns print-ready HTML for the physical Guest Registration Card.
 * Follows the structure of the hotel's actual registration card.
 */
router.get("/:bookingId/print", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "VIEW"), printRegistrationCard);

/**
 * GET /api/front-desk/registration/report
 * Guest Registration Report — all walk-in registrations with filters.
 * ?from=&to=&roomId=&status=&page=&limit=
 */
router.get("/report", requirePropertyAccess, requirePermission("GUEST_REGISTRATION", "VIEW"), getRegistrationReport);

export default router;
