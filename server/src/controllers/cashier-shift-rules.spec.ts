import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { User, UserRole } from "../models/User";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { openShift, initiateHandover, confirmHandover, closeShift, acceptShiftVariance, recordPaidOut } from "./cashier-shift.controller";
import { resolveCount, varianceOutcome, modeOf } from "../services/cashier-shift.service";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const DRAWER = `TEST-DRAWER-${oid()}`;
const users: Record<string, any> = {};

function call(handler: any, who: any, body: any = {}, params: any = {}) {
  const req: any = { body, params, propertyId: P, user: { id: String(who._id), role: who.role }, headers: {}, ip: "127.0.0.1" };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => res);
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  await CashierShift.syncIndexes();
  for (const [k, role] of [["a", UserRole.CASHIER], ["b", UserRole.CASHIER], ["c", UserRole.CASHIER], ["m", UserRole.MANAGER]] as const) {
    users[k] = await User.create({ firstName: "Shift", lastName: k, email: `shift-${k}-${oid()}@test.local`, passwordHash: "x", role, isActive: true } as any);
  }
});

afterAll(async () => {
  const ids = Object.values(users).map((u) => u._id);
  await FolioLine.deleteMany({ postedBy: { $in: ids.map(String) } });
  await CashierShift.deleteMany({ cashier: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.connection.close();
});

describe("cashier shift rules", () => {
  it("unit: denominations must match the stated count; variance outcome; payment mode", () => {
    expect(resolveCount(1500, { n500: 3 } as any).total).toBe(1500);
    expect(() => resolveCount(1600, { n500: 3 } as any)).toThrow(/add up to/);
    expect(varianceOutcome(0, undefined, 100).status).toBe(CashierShiftStatus.RECONCILED);
    expect(() => varianceOutcome(-50, "", 100)).toThrow(/reason/);
    expect(varianceOutcome(-50, "short change", 100)).toMatchObject({ status: CashierShiftStatus.RECONCILED, acceptanceRequired: false });
    expect(varianceOutcome(-500, "missing note", 100)).toMatchObject({ status: CashierShiftStatus.CLOSED, acceptanceRequired: true });
    expect(modeOf("UPI", "CASH", "Cash payment")).toBe("UPI");
    expect(modeOf(undefined, undefined, "Checkout Payment (CASH)")).toBe("CASH");
  });

  it("allows exactly one active shift per drawer under concurrent opens", async () => {
    const [r1, r2] = await Promise.all([
      call(openShift, users.a, { drawerId: DRAWER, openingFloat: 1000 }),
      call(openShift, users.b, { drawerId: DRAWER, openingFloat: 1000 }),
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([201, 409]);
    expect(await CashierShift.countDocuments({ drawerId: DRAWER, status: { $in: [CashierShiftStatus.OPEN, CashierShiftStatus.HANDOVER_PENDING] } })).toBe(1);
  });

  it("freezes the drawer at handover: later postings do not move the handed-over count", async () => {
    const holder = (await CashierShift.findOne({ drawerId: DRAWER, status: CashierShiftStatus.OPEN }))!;
    const owner = String(holder.cashier) === String(users.a._id) ? users.a : users.b;
    const incoming = users.c;
    const before = await (FolioLine as any).create({ folio: oid(), booking: oid(), lineType: FolioLineType.PAYMENT, direction: FolioLineDirection.CREDIT, description: "Checkout Payment (CASH)", amount: 500, date: new Date(), postedBy: String(owner._id), postedAt: new Date() } as any);
    expect(before).toBeTruthy();

    const bad = await call(initiateHandover, owner, { targetCashierId: String(incoming._id), countedCash: 1400 }, { id: String(holder._id) });
    expect(bad.statusCode).toBe(400); // ₹100 short with no reason

    const ok = await call(initiateHandover, owner, { targetCashierId: String(incoming._id), countedCash: 1500 }, { id: String(holder._id) });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.data.expectedCash).toBe(1500);

    await (FolioLine as any).create({ folio: oid(), booking: oid(), lineType: FolioLineType.PAYMENT, direction: FolioLineDirection.CREDIT, description: "Late (CASH)", amount: 999, date: new Date(), postedBy: String(owner._id), postedAt: new Date(Date.now() + 1000) } as any);

    const wrong = await call(confirmHandover, users.m, {}, { id: String(holder._id) });
    expect(wrong.statusCode).toBe(403);
    const conf = await call(confirmHandover, incoming, {}, { id: String(holder._id) });
    expect(conf.statusCode).toBe(200);
    const closed = await CashierShift.findById(holder._id).lean();
    expect(closed).toMatchObject({ status: "RECONCILED", expectedCash: 1500, actualCashCounted: 1500 });
    expect(conf.body.data.newShift.openingFloat).toBe(1500);
  });

  it("paid-out cannot exceed the drawer; variance above threshold needs a manager who is not the cashier", async () => {
    const shift = (await CashierShift.findOne({ cashier: users.c._id, status: CashierShiftStatus.OPEN }))!;
    const tooMuch = await call(recordPaidOut, users.c, { amount: 5000, reason: "bank drop" }, { id: String(shift._id) });
    expect(tooMuch.statusCode).toBe(400);
    // Named categories need no reason; "Others" does.
    // Items sold to guests are counter sales (income), never paid-outs.
    expect((await call(recordPaidOut, users.c, { amount: 20, category: "WATER_BOTTLE" }, { id: String(shift._id) })).statusCode).toBe(400);
    expect((await call(recordPaidOut, users.c, { amount: 20, category: "PETTY_CASH" }, { id: String(shift._id) })).statusCode).toBe(200);
    expect((await call(recordPaidOut, users.c, { amount: 20, category: "OTHER" }, { id: String(shift._id) })).statusCode).toBe(400);
    expect((await call(recordPaidOut, users.c, { amount: 30, category: "OTHER", reason: "auto fare for guest" }, { id: String(shift._id) })).statusCode).toBe(200);

    const noReason = await call(closeShift, users.c, { actualCashCounted: 950 }, { id: String(shift._id) });
    expect(noReason.statusCode).toBe(400);
    const closed = await call(closeShift, users.c, { actualCashCounted: 950, varianceReason: "₹500 note missing" }, { id: String(shift._id) });
    expect(closed.statusCode).toBe(200);
    expect(closed.body.data).toMatchObject({ status: "CLOSED", varianceAcceptanceRequired: true, cashVariance: -500 });

    // A role without the override capability still cannot accept (single-login rule: the
    // Reception login may accept its own shift; see reception-workflow.integration.spec).
    const cashier = await call(acceptShiftVariance, users.a, { notes: "fine" }, { id: String(shift._id) });
    expect(cashier.statusCode).toBe(403);
    const mgr = await call(acceptShiftVariance, users.m, { notes: "checked CCTV, recorded as loss" }, { id: String(shift._id) });
    expect(mgr.statusCode).toBe(200);
    expect((await CashierShift.findById(shift._id).lean())!.status).toBe("RECONCILED");
  });
});
