import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { getComplaints, createComplaint, updateComplaintStatus, getMyComplaints, createMyComplaint } from "../controllers/complaint.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Customer facing routes
router.get("/my", protect, getMyComplaints);
router.post("/my", protect, createMyComplaint);

// Staff-only: complaints carry guest PII (name/email/phone via the
// getComplaints populate) and route to HOUSEKEEPING/MAINTENANCE/FRONT_DESK/
// F_AND_B departments for triage. Previously this router only called
// `protect` (authenticated, any role) with no `authorize` check at all — a
// plain CUSTOMER account could list every guest's complaints and resolve
// or close any of them. Confirmed live during this audit: a freshly
// registered customer successfully PATCHed another guest's complaint to
// RESOLVED.
router.use(protect);

router.get("/", requirePermission("GUEST_COMPLAINTS", "VIEW"), getComplaints);
router.post("/", requirePermission("GUEST_COMPLAINTS", "CREATE"), createComplaint);
router.patch("/:id/status", requirePermission("GUEST_COMPLAINTS", "EDIT"), updateComplaintStatus);

export default router;
