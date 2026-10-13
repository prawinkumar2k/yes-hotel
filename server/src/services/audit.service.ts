import { Request } from "express";
import { AuditLog, AuditActorType } from "../models/AuditLog";

/**
 * Records a successful sensitive mutation. Fire-and-forget by design —
 * a logging failure must never fail or roll back the operation it's
 * recording, so errors are swallowed (and reported) rather than thrown.
 *
 * When there is no authenticated `req.user` (guest checkout is the main real
 * case), this does NOT silently skip — it records the event with
 * actorType GUEST and no actorId, rather than fabricating a fake user
 * account just to satisfy a required field.
 */
export async function createAuditLog(params: {
  // Omitted for events with no inbound HTTP request to attribute (e.g. a
  // payment-gateway webhook processed server-to-server) — those must set
  // actorType explicitly instead.
  req?: Request;
  action: string;
  resourceType: string;
  resourceId?: string | string[];
  metadata?: Record<string, any>;
  actorId?: string;
  actorRole?: string;
  actorType?: AuditActorType;
  propertyId?: string;
}) {
  try {
    const { req, action, resourceType, resourceId, metadata, actorId, actorRole, actorType, propertyId } = params;
    const user = req ? (req as any).user : undefined;
    const resolvedActorId = actorId ?? user?.id;
    const resolvedActorRole = actorRole ?? user?.role;
    const resolvedActorType =
      actorType ?? (resolvedActorId ? AuditActorType.USER : AuditActorType.GUEST);

    let resolvedPropertyId = propertyId || (req as any)?.property?._id;
    if (!resolvedPropertyId) {
      const { Property } = await import("../models/Property");
      const prop = await Property.findOne().lean();
      if (prop) resolvedPropertyId = prop._id;
      else {
        const mongoose = await import("mongoose");
        resolvedPropertyId = new mongoose.Types.ObjectId();
      }
    }

    await AuditLog.create({
      propertyId: resolvedPropertyId,
      actorType: resolvedActorType,
      actorId: resolvedActorId || undefined,
      actorRole: resolvedActorRole || (resolvedActorType === AuditActorType.SYSTEM ? "SYSTEM" : "GUEST"),
      action,
      resourceType,
      resourceId: Array.isArray(resourceId) ? resourceId[0] : resourceId,
      metadata,
      before: metadata?.before,
      after: metadata?.after,
      ipAddress: req?.ip,
      // NOTE: `req?.headers["user-agent"]` (without the second `?.`) looks
      // safe but isn't — optional chaining only guards the immediately
      // preceding property access, not a bracket access chained after it.
      // With req undefined, `req?.headers` evaluates to undefined, and
      // `undefined["user-agent"]` throws — which this function's own
      // try/catch then silently swallows. This was live: every req-less
      // audit call (every SYSTEM-actor webhook event: payment.completed via
      // webhook, payment.failed, refund confirmations) was silently failing
      // to write an audit log entry for the entire time req became optional.
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
