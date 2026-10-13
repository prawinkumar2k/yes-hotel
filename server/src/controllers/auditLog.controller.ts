import { Request, Response } from "express";
import { AuditLog } from "../models/AuditLog";
import { businessDayRange } from "../../../shared/dates";

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** One filter for the list and the export. Dates are business days (IST), inclusive. */
export function buildAuditFilter(q: Record<string, unknown>) {
  const filter: any = {};
  const str = (k: string) => (typeof q[k] === "string" && (q[k] as string).trim() ? (q[k] as string).trim() : undefined);
  if (str("actorId")) filter.actorId = str("actorId");
  if (str("actorType")) filter.actorType = str("actorType");
  if (str("actorRole")) filter.actorRole = str("actorRole");
  if (str("resourceType")) filter.resourceType = str("resourceType");
  if (str("resourceId")) filter.resourceId = str("resourceId");
  if (str("ipAddress")) filter.ipAddress = str("ipAddress");
  // action: exact, or a prefix ending in "." / "*" (e.g. "folio." or "cashier_shift*")
  const action = str("action");
  if (action) filter.action = /[.*]$/.test(action) ? { $regex: `^${escapeRegex(action.replace(/\*$/, ""))}` } : action;
  const from = str("dateFrom");
  const to = str("dateTo");
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = YMD.test(from) ? businessDayRange(from).start : new Date(from);
    if (to) filter.createdAt.$lt = YMD.test(to) ? businessDayRange(to).end : new Date(to);
  }
  return filter;
}

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const p = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
    const l = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "20")) || 20));
    const filter = buildAuditFilter(req.query as any);

    const [logs, total, actions] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct("action"),
    ]);

    return res.status(200).json({
      success: true,
      data: { logs, total, totalPages: Math.ceil(total / l), page: p, actions: actions.sort() },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const csvCell = (v: unknown) => {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** GET /api/audit-logs/export — CSV of the filtered log (max 50,000 rows), newest first. */
export const exportAuditLogs = async (req: Request, res: Response) => {
  try {
    const filter = buildAuditFilter(req.query as any);
    const rows = await AuditLog.find(filter).populate("actorId", "firstName lastName email").sort({ createdAt: -1 }).limit(50_000).lean();
    const header = ["createdAt", "actorType", "actorRole", "actorEmail", "actorName", "action", "resourceType", "resourceId", "ipAddress", "userAgent", "before", "after", "metadata"];
    const lines = [header.join(",")];
    for (const r of rows as any[]) {
      const actor = r.actorId && typeof r.actorId === "object" ? r.actorId : undefined;
      lines.push(
        [
          new Date(r.createdAt).toISOString(),
          r.actorType,
          r.actorRole,
          actor?.email,
          actor ? `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() : "",
          r.action,
          r.resourceType,
          r.resourceId,
          r.ipAddress,
          r.userAgent,
          r.before,
          r.after,
          r.metadata,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send("﻿" + lines.join("\r\n"));
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
