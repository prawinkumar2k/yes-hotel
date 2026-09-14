import { Router } from "express";
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
router.post("/:folioId/charges", protect, authorize(...STAFF_ROLES), postFolioCharge);
router.post("/:folioId/reconcile", protect, authorize(...STAFF_ROLES), reconcileFolio);
router.post("/:folioId/finalize", protect, authorize(...STAFF_ROLES), finalizeFolioHandler);
router.post("/:folioId/settle", protect, authorize(...STAFF_ROLES), settleFolioHandler);

export default router;
