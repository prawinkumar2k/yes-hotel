import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getFolioByBooking,
  postFolioCharge,
  reconcileFolio,
  finalizeFolioHandler,
  settleFolioHandler,
} from "../controllers/folio.controller";

const router = Router();

const STAFF_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST"];

router.get("/booking/:bookingId", protect, getFolioByBooking);
router.post("/:folioId/charges", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CREATE"), postFolioCharge);
router.post("/:folioId/reconcile", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CREATE"), reconcileFolio);
router.post("/:folioId/finalize", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CREATE"), finalizeFolioHandler);
router.post("/:folioId/settle", protect, requirePropertyAccess, requirePermission("CASHIER_SHIFTS", "CREATE"), settleFolioHandler);

export default router;
