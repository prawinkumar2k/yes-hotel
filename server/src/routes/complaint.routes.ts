import { Router } from "express";
import { getComplaints, createComplaint, updateComplaintStatus } from "../controllers/complaint.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

// Staff-only: complaints carry guest PII (name/email/phone via the
// getComplaints populate) and route to HOUSEKEEPING/MAINTENANCE/FRONT_DESK/
// F_AND_B departments for triage. Previously this router only called
// `protect` (authenticated, any role) with no `authorize` check at all — a
// plain CUSTOMER account could list every guest's complaints and resolve
// or close any of them. Confirmed live during this audit: a freshly
// registered customer successfully PATCHed another guest's complaint to
// RESOLVED.
router.use(
  protect,
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE)
);

router.get("/", getComplaints);
router.post("/", createComplaint);
router.patch("/:id/status", updateComplaintStatus);

export default router;
