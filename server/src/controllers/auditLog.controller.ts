import { Request, Response } from "express";
import { AuditLog } from "../models/AuditLog";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      actorId,
      actorType,
      action,
      resourceType,
      resourceId,
      dateFrom,
      dateTo,
    } = req.query;
    const p = Math.max(1, parseInt(page as string) || 1);
    const l = Math.max(1, parseInt(limit as string) || 20);

    const filter: any = {};
    if (actorId) filter.actorId = actorId;
    if (actorType) filter.actorType = actorType;
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (resourceId) filter.resourceId = resourceId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { logs, total, totalPages: Math.ceil(total / l), page: p },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
