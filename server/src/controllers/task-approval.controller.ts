import { Request, Response } from "express";
import { z } from "zod";
import {
  TaskApproval,
  ApprovalCategory,
  ApprovalPriority,
  ApprovalStatus,
  ConfidentialLevel,
} from "../models/TaskApproval";
import { createAuditLog } from "../services/audit.service";
import { PermissionService } from "../services/PermissionService";
import { isFullAccessRole } from "../config/permissions";

// ─── Validation Schemas ─────────────────────────────────────────────────────

const createApprovalSchema = z.object({
  category: z.nativeEnum(ApprovalCategory),
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(1000),
  amount: z.number().positive().optional(),
  recipientAccount: z.string().optional(),
  bankName: z.string().optional(),
  priority: z.nativeEnum(ApprovalPriority).optional(),
  confidentialLevel: z.nativeEnum(ConfidentialLevel).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

const actionSchema = z.object({
  actionNote: z.string().optional(),
});

// ─── Allowed approvers (config/permissions.ts) ───────────────────────────────
// SUPER_ADMIN_ONLY items: full-access roles only. EXECUTIVE / MANAGER tiers: CAP.APPROVAL_TIER_*.

function seesSuperAdminOnly(actor: any): boolean {
  return isFullAccessRole(actor?.role);
}

async function canApprove(actor: any, confidentialLevel: ConfidentialLevel): Promise<boolean> {
  if (confidentialLevel === ConfidentialLevel.SUPER_ADMIN_ONLY) return seesSuperAdminOnly(actor);
  if (confidentialLevel === ConfidentialLevel.EXECUTIVE) return PermissionService.can(actor, "CAP.APPROVAL_TIER_EXECUTIVE");
  return PermissionService.can(actor, "CAP.APPROVAL_TIER_MANAGER");
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/task-approvals
 * Returns all approvals — filtered by confidential level based on the actor's role.
 */
export const getTaskApprovals = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { status, category } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Restrict SUPER_ADMIN_ONLY items to SUPER_ADMIN/ADMIN
    if (!seesSuperAdminOnly(actor)) {
      filter.confidentialLevel = { $ne: ConfidentialLevel.SUPER_ADMIN_ONLY };
    }

    const approvals = await TaskApproval.find(filter)
      .populate("requestedBy", "firstName lastName email role")
      .populate("actionBy", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ success: true, data: approvals });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/task-approvals
 * Submit a new approval request.
 */
export const createTaskApproval = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const body = createApprovalSchema.parse(req.body);

    const approval = await TaskApproval.create({
      ...body,
      requestedBy: actor._id || actor.id,
      requestedByName: `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() || actor.email,
      status: ApprovalStatus.PENDING,
    });

    await createAuditLog({
      req,
      action: "task_approval.created",
      resourceType: "TaskApproval",
      resourceId: approval._id.toString(),
      metadata: { category: body.category, title: body.title, priority: body.priority },
    });

    return res.status(201).json({ success: true, data: approval });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/task-approvals/:id/approve
 */
export const approveTaskApproval = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { id } = req.params;
    const { actionNote } = actionSchema.parse(req.body);

    const approval = await TaskApproval.findById(id);
    if (!approval) return res.status(404).json({ success: false, message: "Approval not found" });
    if (approval.status !== ApprovalStatus.PENDING) {
      return res.status(400).json({ success: false, message: `Approval is already ${approval.status}` });
    }
    if (!(await canApprove(actor, approval.confidentialLevel as ConfidentialLevel))) {
      return res.status(403).json({ success: false, message: "You do not have authority to approve this request" });
    }

    approval.status = ApprovalStatus.APPROVED;
    approval.actionBy = actor._id || actor.id;
    approval.actionNote = actionNote;
    approval.actionAt = new Date();
    await approval.save();

    await createAuditLog({
      req,
      action: "task_approval.approved",
      resourceType: "TaskApproval",
      resourceId: id,
      metadata: { title: approval.title, category: approval.category, actionNote },
    });

    return res.json({ success: true, message: "Approval granted", data: approval });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/task-approvals/:id/reject
 */
export const rejectTaskApproval = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const { id } = req.params;
    const { actionNote } = actionSchema.parse(req.body);

    const approval = await TaskApproval.findById(id);
    if (!approval) return res.status(404).json({ success: false, message: "Approval not found" });
    if (approval.status !== ApprovalStatus.PENDING) {
      return res.status(400).json({ success: false, message: `Approval is already ${approval.status}` });
    }
    if (!(await canApprove(actor, approval.confidentialLevel as ConfidentialLevel))) {
      return res.status(403).json({ success: false, message: "You do not have authority to reject this request" });
    }

    approval.status = ApprovalStatus.REJECTED;
    approval.actionBy = actor._id || actor.id;
    approval.actionNote = actionNote;
    approval.actionAt = new Date();
    await approval.save();

    await createAuditLog({
      req,
      action: "task_approval.rejected",
      resourceType: "TaskApproval",
      resourceId: id,
      metadata: { title: approval.title, category: approval.category, actionNote },
    });

    return res.json({ success: true, message: "Request rejected", data: approval });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/task-approvals/stats
 * Summary counts for dashboard widgets.
 */
export const getApprovalStats = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    const confidentialFilter = seesSuperAdminOnly(actor)
      ? {}
      : { confidentialLevel: { $ne: ConfidentialLevel.SUPER_ADMIN_ONLY } };

    const [pending, approved, rejected] = await Promise.all([
      TaskApproval.countDocuments({ status: ApprovalStatus.PENDING, ...confidentialFilter }),
      TaskApproval.countDocuments({ status: ApprovalStatus.APPROVED, ...confidentialFilter }),
      TaskApproval.countDocuments({ status: ApprovalStatus.REJECTED, ...confidentialFilter }),
    ]);

    return res.json({ success: true, data: { pending, approved, rejected, total: pending + approved + rejected } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
