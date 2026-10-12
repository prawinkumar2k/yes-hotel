import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
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

router.get("/booking/:bookingId", protect, getFolioByBooking);
router.put("/booking/:bookingId/bill-edit", protect, updateBookingBill);
router.post("/:folioId/charges", protect, postFolioCharge);
router.delete("/:folioId/lines/:lineId", protect, deleteFolioLine);
router.post("/:folioId/reconcile", protect, reconcileFolio);
router.post("/:folioId/finalize", protect, finalizeFolioHandler);
router.post("/:folioId/settle", protect, settleFolioHandler);

export default router;
