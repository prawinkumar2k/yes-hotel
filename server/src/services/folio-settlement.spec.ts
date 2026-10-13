import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { Payment } from "../models/Payment";
import { postCharge, recordFolioPayment, reverseFolioLine, settleFolio, FolioNotBalancedError } from "./folio.service";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const booking = oid();
let folioId = "";

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const f = await Folio.create({ propertyId: P, booking, guest: booking, room: oid(), checkInDate: new Date(), checkOutDate: new Date(), status: FolioStatus.OPEN });
  folioId = String(f._id);
});

afterAll(async () => {
  await FolioLine.deleteMany({ booking });
  await Payment.deleteMany({ booking });
  await Folio.deleteMany({ booking });
  await mongoose.connection.close();
});

describe("folio settlement", () => {
  it("every payment line is backed by a Payment record created with it", async () => {
    await postCharge({ folioId, bookingId: String(booking), lineType: FolioLineType.MINIBAR, description: "Minibar", amount: 1000, date: new Date(), postedBy: "test" }, {});
    const { payment, line } = await recordFolioPayment({ folioId, bookingId: String(booking), amount: 600, method: "UPI", description: "Part payment", postedBy: "test", propertyId: P }, {});
    expect(String(line.paymentId)).toBe(String(payment._id));
    expect(payment.currency).toBe("INR");
    expect(payment.transactionId).toMatch(/^TXN-\d{8}-\d{6}$/);
  });

  it("refuses to settle while a balance remains", async () => {
    await expect(settleFolio(folioId, { closedBy: String(oid()) })).rejects.toBeInstanceOf(FolioNotBalancedError);
  });

  it("voids a line by reversal (never deletes) and only once", async () => {
    const minibar = await FolioLine.findOne({ folio: folioId, lineType: FolioLineType.MINIBAR });
    await reverseFolioLine(folioId, String(minibar!._id), "posted in error", { postedBy: "test" });
    expect(await FolioLine.exists({ _id: minibar!._id })).toBeTruthy();
    await expect(reverseFolioLine(folioId, String(minibar!._id), "again", { postedBy: "test" })).rejects.toThrow(/already been reversed/);
    expect((await Folio.findById(folioId))!.balance).toBe(-600); // guest now holds a 600 credit
  });

  it("settles at exactly zero with a gapless FY invoice number", async () => {
    await postCharge({ folioId, bookingId: String(booking), lineType: FolioLineType.REFUND, description: "Refund", amount: 600, date: new Date(), postedBy: "test" }, {});
    await settleFolio(folioId, { closedBy: String(oid()) });
    const fresh = await Folio.findById(folioId).lean();
    expect(fresh!.status).toBe(FolioStatus.SETTLED);
    expect(fresh!.balance).toBe(0);
    expect((fresh as any).invoiceNumber).toMatch(/^[A-Z0-9-]+\/\d{4}-\d{2}\/\d{6}$/);
  });

  it("a settled folio is immutable", async () => {
    await expect(postCharge({ folioId, bookingId: String(booking), lineType: FolioLineType.MINIBAR, description: "Late", amount: 10, date: new Date(), postedBy: "test" }, {})).rejects.toThrow(/SETTLED/);
  });
});
