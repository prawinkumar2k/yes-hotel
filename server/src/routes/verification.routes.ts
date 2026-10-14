import { Router, Request, Response } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { VerificationRequest, VerificationStatus } from "../models/VerificationRequest";
import { reviewVerification, resubmitVerification, sendVerificationError, TYPE_LABEL } from "../services/verification.service";
import "../models/User";
import "../models/Booking";
import "../models/Room";

const router = Router();
router.use(protect, requirePropertyAccess);

/**
 * GET /api/verifications?status=PENDING|APPROVED|REJECTED|RESUBMITTED|ALL&type=&queue=HOUSEKEEPING|FRONT_DESK|CASHIER&returned=true&search=
 *   returned=true → rejected tasks still waiting for their correction (the "returned" lists).
 */
router.get("/", requirePermission("VERIFICATIONS", "VIEW"), async (req: Request, res: Response) => {
  try {
    const filter: Record<string, any> = {};
    const scope = (req as any).propertyId ? { $or: [{ propertyId: (req as any).propertyId }, { propertyId: { $exists: false } }] } : {};
    const status = String(req.query.status ?? "ALL");
    if (req.query.returned === "true") {
      filter.status = VerificationStatus.REJECTED;
      filter.resubmittedAs = { $exists: false };
    } else if (status === "RESUBMITTED") filter.resubmissionOf = { $exists: true };
    else if (status !== "ALL") filter.status = status;
    if (req.query.type) filter.type = String(req.query.type);
    if (req.query.queue) filter.returnQueue = String(req.query.queue);
    const and: any[] = [scope, filter];
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const rx = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      and.push({ $or: [{ summary: rx }, { submittedNote: rx }, { reviewNote: rx }, { "details.bookingReference": rx }, { "details.guest": rx }, { "details.room": rx }] });
    }
    const rows = await VerificationRequest.find({ $and: and })
      .populate("submittedBy", "firstName lastName email role")
      .populate("reviewedBy", "firstName lastName email role")
      .populate("history.by", "firstName lastName role")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return res.json({ success: true, data: rows.map((r: any) => ({ ...r, typeLabel: TYPE_LABEL[r.type as keyof typeof TYPE_LABEL] })) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/verifications/counts — pending total, returned per queue (for navigation badges). */
router.get("/counts", requirePermission("VERIFICATIONS", "VIEW"), async (req: Request, res: Response) => {
  try {
    const scope = (req as any).propertyId ? { $or: [{ propertyId: (req as any).propertyId }, { propertyId: { $exists: false } }] } : {};
    const [pending, returned] = await Promise.all([
      VerificationRequest.countDocuments({ ...scope, status: VerificationStatus.PENDING }),
      VerificationRequest.aggregate([
        { $match: { ...scope, status: VerificationStatus.REJECTED, resubmittedAs: { $exists: false } } as any },
        { $group: { _id: "$returnQueue", n: { $sum: 1 } } },
      ]),
    ]);
    const returnedByQueue: Record<string, number> = { HOUSEKEEPING: 0, FRONT_DESK: 0, CASHIER: 0 };
    for (const r of returned) returnedByQueue[r._id] = r.n;
    return res.json({ success: true, data: { pending, returned: returnedByQueue } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:id/approve", requirePermission("VERIFICATIONS", "APPROVE"), async (req: Request, res: Response) => {
  try {
    const data = await reviewVerification(String(req.params.id), "APPROVE", req.body?.note, req);
    return res.json({ success: true, message: "Verified.", data });
  } catch (error: any) {
    if (!sendVerificationError(res, error)) return res.status(error?.name === "IllegalHousekeepingTransitionError" ? 409 : 500).json({ success: false, message: error.message });
  }
});

router.post("/:id/reject", requirePermission("VERIFICATIONS", "REJECT"), async (req: Request, res: Response) => {
  try {
    const data = await reviewVerification(String(req.params.id), "REJECT", req.body?.reason ?? req.body?.note, req);
    return res.json({ success: true, message: "Rejected and returned for correction.", data });
  } catch (error: any) {
    if (!sendVerificationError(res, error)) return res.status(error?.name === "IllegalHousekeepingTransitionError" ? 409 : 500).json({ success: false, message: error.message });
  }
});

router.post("/:id/resubmit", requirePermission("VERIFICATIONS", "VIEW"), async (req: Request, res: Response) => {
  try {
    const data = await resubmitVerification(String(req.params.id), String(req.body?.note ?? ""), req);
    return res.status(201).json({ success: true, message: "Resubmitted for verification.", data });
  } catch (error: any) {
    if (!sendVerificationError(res, error)) return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
