import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePermission, requirePermissionOrBookingOwner } from "../middleware/permissionAuth";
import {
  getFolioByBooking,
  postFolioCharge,
  reconcileFolio,
  finalizeFolioHandler,
  settleFolioHandler,
  updateBookingBill,
  deleteFolioLine,
} from "../controllers/folio.controller";

const router = Router();

router.use(protect);

// Staff read; a CUSTOMER may read (never seed or change) their own booking's folio.
router.get("/booking/:bookingId", requirePermissionOrBookingOwner("FOLIOS", "VIEW"), getFolioByBooking);

router.put("/booking/:bookingId/bill-edit", requirePermission("FOLIOS", "EDIT"), updateBookingBill);
router.post("/:folioId/charges", requirePermission("FOLIOS", "POST_CHARGE"), postFolioCharge);
router.delete("/:folioId/lines/:lineId", requirePermission("FOLIOS", "VOID_LINE"), deleteFolioLine);
router.post("/:folioId/reconcile", requirePermission("FOLIOS", "SETTLE"), reconcileFolio);
router.post("/:folioId/finalize", requirePermission("FOLIOS", "SETTLE"), finalizeFolioHandler);
router.post("/:folioId/settle", requirePermission("FOLIOS", "SETTLE"), settleFolioHandler);

export default router;
