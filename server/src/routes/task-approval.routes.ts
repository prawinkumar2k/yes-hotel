import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getTaskApprovals,
  createTaskApproval,
  approveTaskApproval,
  rejectTaskApproval,
  getApprovalStats,
} from "../controllers/task-approval.controller";

const router = Router();

// All routes require authentication
router.use(protect);

// Any logged-in staff can create an approval request
router.post("/", requirePropertyAccess, requirePermission("TASK_APPROVALS", "CREATE"), createTaskApproval
);

// Reading approvals — filtered server-side by confidential level
router.get("/", requirePropertyAccess, requirePermission("TASK_APPROVALS", "VIEW"), getTaskApprovals
);

router.get("/stats", requirePropertyAccess, requirePermission("TASK_APPROVALS", "VIEW"), getApprovalStats
);

// Approve / Reject — also RBAC-enforced at controller level
router.post("/:id/approve", requirePropertyAccess, requirePermission("TASK_APPROVALS", "CREATE"), approveTaskApproval
);

router.post("/:id/reject", requirePropertyAccess, requirePermission("TASK_APPROVALS", "CREATE"), rejectTaskApproval
);

export default router;
