import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
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

router.get("/", protect, requirePropertyAccess, requirePermission("CORPORATE_ACCOUNTS", "VIEW"), getCorporateAccounts);
router.post("/", protect, requirePropertyAccess, requirePermission("CORPORATE_ACCOUNTS", "CREATE"), createCorporateAccount);
router.get("/:id", protect, requirePropertyAccess, requirePermission("CORPORATE_ACCOUNTS", "VIEW"), getCorporateAccountById);
router.put("/:id", protect, requirePropertyAccess, requirePermission("CORPORATE_ACCOUNTS", "EDIT"), updateCorporateAccount);
router.post("/:id/check-credit", protect, requirePropertyAccess, requirePermission("CORPORATE_ACCOUNTS", "CREATE"), checkCorporateCreditAvailability);

export default router;

