import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getCorporateAccounts,
  createCorporateAccount,
  getCorporateAccountById,
  updateCorporateAccount,
  checkCorporateCreditAvailability,
} from "../controllers/corporate-account.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/", protect, authorize(...ADMIN_ROLES), getCorporateAccounts);
router.post("/", protect, authorize(...ADMIN_ROLES), createCorporateAccount);
router.get("/:id", protect, authorize(...ADMIN_ROLES), getCorporateAccountById);
router.put("/:id", protect, authorize(...ADMIN_ROLES), updateCorporateAccount);
router.post("/:id/check-credit", protect, authorize(...ADMIN_ROLES), checkCorporateCreditAvailability);

export default router;

