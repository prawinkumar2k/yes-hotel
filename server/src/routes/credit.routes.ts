import { Router, Request, Response } from "express";
import { protect } from "../middleware/auth.middleware";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { CreditEntry } from "../models/CreditEntry";
import { collectCredit, CreditError } from "../services/credit.service";

const router = Router();
router.use(protect);

const actorId = (req: Request) => String((req as any).user?._id ?? (req as any).user?.id ?? "");
const fail = (res: Response, e: any) => res.status(e instanceof CreditError ? e.status : 500).json({ success: false, message: e.message });

// GET /api/credits?status=OPEN|SETTLED|ALL — who owes the hotel what (the Credits page)
router.get("/", requirePropertyAccess, requirePermission("ADVANCES", "VIEW"), async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status ?? "OPEN").toUpperCase();
    const propertyId = (req as any).propertyId ?? (req as any).user?.propertyId;
    const filter: Record<string, unknown> = {};
    if (propertyId) filter.propertyId = propertyId;
    if (status === "OPEN" || status === "SETTLED") filter.status = status;
    const entries = await CreditEntry.find(filter).sort({ createdAt: -1 }).limit(500).populate("booking", "bookingReference").lean();
    const outstanding = entries.reduce((t, e: any) => t + (e.status === "OPEN" ? e.amount - e.collectedTotal : 0), 0);
    res.json({ success: true, data: { entries, outstanding: Math.round(outstanding * 100) / 100 } });
  } catch (e: any) { fail(res, e); }
});

// POST /api/credits/:id/collect { amount, method, reference } — the guest pays (part of) the credit
router.post("/:id/collect", requirePropertyAccess, requirePermission("ADVANCES", "ADJUST"), async (req: Request, res: Response) => {
  try {
    const out = await collectCredit(String(req.params.id), { ...(req.body ?? {}), by: actorId(req), propertyId: (req as any).propertyId });
    res.json({ success: true, message: `₹${Number(req.body?.amount).toLocaleString("en-IN")} collected`, data: out.entry });
  } catch (e: any) { fail(res, e); }
});

export default router;
