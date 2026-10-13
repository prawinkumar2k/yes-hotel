import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { AdvancePayment, AdvancePaymentStatus } from "../models/AdvancePayment";
import { AdvanceAdjustment } from "../models/AdvanceAdjustment";
import { postCharge, reverseFolioLine } from "./folio.service";
import { applyAdvancesToFolio, reconcileAdvances, refundAdvance, advanceStatusFor, receiveAdvance } from "./advance.service";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const booking = oid();
const guest = oid();
const staff = String(oid());
let folioId = "";
const advIds: mongoose.Types.ObjectId[] = [];

async function advance(amount: number, n: string, minutesAgo: number) {
  const a = await AdvancePayment.create({
    propertyId: P, advanceNumber: `TST-${n}-${oid()}`, booking, guest, amount, totalAdjusted: 0, totalRefunded: 0,
    remainingBalance: amount, method: "CASH" as any, status: AdvancePaymentStatus.RECEIVED,
    receivedAt: new Date(Date.now() - minutesAgo * 60000), receivedBy: staff,
  });
  advIds.push(a._id as any);
  return a;
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const f = await Folio.create({ propertyId: P, booking, guest, room: oid(), checkInDate: new Date(), checkOutDate: new Date(), status: FolioStatus.OPEN });
  folioId = String(f._id);
  await postCharge({ folioId, bookingId: String(booking), lineType: FolioLineType.ROOM_CHARGE, description: "Stay", amount: 5000, date: new Date(), postedBy: staff }, {});
  await advance(3000, "A", 60);
  await advance(4000, "B", 30);
});

afterAll(async () => {
  await AdvanceAdjustment.deleteMany({ advancePayment: { $in: advIds } });
  await AdvancePayment.deleteMany({ _id: { $in: advIds } });
  await FolioLine.deleteMany({ booking });
  await Folio.deleteMany({ booking });
  await mongoose.connection.close();
});

describe("advances", () => {
  it("status follows the amounts", () => {
    expect(advanceStatusFor({ remainingBalance: 0, totalAdjusted: 10, totalRefunded: 0 })).toBe("FULLY_ADJUSTED");
    expect(advanceStatusFor({ remainingBalance: 0, totalAdjusted: 0, totalRefunded: 10 })).toBe("REFUNDED");
    expect(advanceStatusFor({ remainingBalance: 5, totalAdjusted: 5, totalRefunded: 5 })).toBe("PARTIALLY_REFUNDED");
  });

  it("applies advances oldest first, across several, capped at the amount due", async () => {
    const applied = await applyAdvancesToFolio({ bookingId: String(booking), guestId: String(guest), folioId, maxAmount: 99999, performedBy: staff }, {});
    expect(applied).toBe(5000);
    const [a, b] = await Promise.all(advIds.map((id) => AdvancePayment.findById(id).lean()));
    expect(a).toMatchObject({ remainingBalance: 0, totalAdjusted: 3000, status: "FULLY_ADJUSTED" });
    expect(b).toMatchObject({ remainingBalance: 2000, totalAdjusted: 2000, status: "PARTIALLY_ADJUSTED" });
    expect((await Folio.findById(folioId))!.balance).toBe(0);
  });

  it("reversing an advance line returns the money to the advance", async () => {
    const line = await FolioLine.findOne({ folio: folioId, advancePaymentId: advIds[1] });
    await reverseFolioLine(folioId, String(line!._id), "applied to the wrong stay", { postedBy: staff });
    const b = await AdvancePayment.findById(advIds[1]).lean();
    expect(b).toMatchObject({ remainingBalance: 4000, totalAdjusted: 0, status: "RECEIVED" });
    expect((await Folio.findById(folioId))!.balance).toBe(2000);
  });

  it("refund needs a reason, is transactional, and cannot overdraw", async () => {
    await expect(refundAdvance({ advancePaymentId: String(advIds[1]), amount: 100, performedBy: staff, reason: "" })).rejects.toThrow(/reason/);
    await refundAdvance({ advancePaymentId: String(advIds[1]), amount: 1000, performedBy: staff, reason: "guest asked" });
    await expect(refundAdvance({ advancePaymentId: String(advIds[1]), amount: 5000, performedBy: staff, reason: "too much" })).rejects.toThrow(/Insufficient/);
    expect(await AdvancePayment.findById(advIds[1]).lean()).toMatchObject({ remainingBalance: 3000, totalRefunded: 1000, status: "PARTIALLY_REFUNDED" });
  });

  it("reconciles: amount = applied + refunded + remaining, applied = folio lines", async () => {
    const r = await reconcileAdvances({ _id: { $in: advIds } });
    expect(r.count).toBe(2);
    expect(r.mismatches).toEqual([]);
    expect(r.totals).toMatchObject({ received: 7000, applied: 3000, refunded: 1000, remaining: 3000 });
  });

  it("issues unique advance numbers under concurrency, continuing the existing series", async () => {
    const made = await Promise.all([1, 2, 3, 4].map(() => receiveAdvance({ propertyId: String(P), guestId: String(guest), amount: 100, method: "CASH" as any, receivedBy: staff })));
    made.forEach((a) => advIds.push(a._id as any));
    const nums = made.map((a) => a.advanceNumber);
    expect(new Set(nums).size).toBe(4);
    const series = nums[0].slice(0, nums[0].lastIndexOf("-") + 1);
    const all = await AdvancePayment.find({ advanceNumber: { $regex: "^" + series } }).select("advanceNumber").lean();
    expect(new Set(all.map((a) => a.advanceNumber)).size).toBe(all.length);
  });
});
