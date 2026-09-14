import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getCorporateAccounts, createCorporateAccount } from "../controllers/corporate-account.controller";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "MANAGER"];

router.get("/", protect, authorize(...ADMIN_ROLES), getCorporateAccounts);
router.post("/", protect, authorize(...ADMIN_ROLES), createCorporateAccount);

export default router;
