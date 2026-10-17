/**
 * The one-time correction of a settled ₹1,510 bill posted without GST: it becomes room ₹1,438.10
 * + CGST ₹35.95 + SGST ₹35.95 = ₹1,510, nothing due, same invoice number; a second run does nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { createServer } from "../../index";
import { fixInclusiveBill } from "./fix-inclusive-bill";
import { computeFolioTotals } from "../services/folio-ledger";
import { addDays, todayBusinessDate } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const ref = `FIX-${tag}`;
const bookingId = oid();
const folioId = oid();
const db = () => mongoose.connection.db!;

beforeAll(async () => {
  createServer(); // connects to the test database
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  const d = todayBusinessDate();
  await db().collection("bookings").insertOne({ _id: bookingId, bookingReference: ref, status: "CHECKED_OUT", checkInDate: new Date(`${d}T00:00:00+05:30`), checkOutDate: new Date(`${addDays(d, 1)}T00:00:00+05:30`), guestDetails: { firstName: "Fix", lastName: tag, email: "", phone: "1" }, totalAmount: 1510, taxAmount: 0, adults: 1 });
  await db().collection("folios").insertOne({ _id: folioId, booking: bookingId, status: "SETTLED", invoiceNumber: `INV/TEST/${tag}`, balance: 0 });
  await db().collection("foliolines").insertMany([
    { folio: folioId, booking: bookingId, lineType: "ROOM_CHARGE", direction: "DEBIT", description: "Room Tariff", amount: 1510, date: new Date(), postedBy: "x" },
    { folio: folioId, booking: bookingId, lineType: "ADVANCE_ADJUSTMENT", direction: "CREDIT", description: "Payment Received", amount: 1510, date: new Date(), postedBy: "x" },
  ]);
});

afterAll(async () => {
  await db().collection("foliolines").deleteMany({ folio: folioId });
  await db().collection("folios").deleteMany({ _id: folioId });
  await db().collection("bookings").deleteMany({ _id: bookingId });
  await db().collection("auditlogs").deleteMany({ "metadata.ref": ref });
});

describe("GST-inclusive bill correction", () => {
  it("dry run changes nothing", async () => {
    const out: any = await fixInclusiveBill(ref, { apply: false, runId: `t-${tag}` });
    expect(out).toMatchObject({ result: "dry run", room: 1438.1, cgst: 35.95, sgst: 35.95, total: 1510 });
    expect(await db().collection("foliolines").countDocuments({ folio: folioId })).toBe(2);
  });

  it("splits ₹1,510 into room + CGST + SGST; nothing due; invoice number kept", async () => {
    const out: any = await fixInclusiveBill(ref, { apply: true, runId: `t-${tag}` });
    expect(out.result).toBe("corrected");
    const t = computeFolioTotals((await db().collection("foliolines").find({ folio: folioId }).toArray()) as any);
    expect(t.totalCharges).toBe(1438.1);
    expect(t.cgst).toBe(35.95);
    expect(t.sgst).toBe(35.95);
    expect(t.balance).toBe(0);
    const f: any = await db().collection("folios").findOne({ _id: folioId });
    expect(f).toMatchObject({ invoiceNumber: `INV/TEST/${tag}`, status: "SETTLED", totalTax: 71.9 });
    const b: any = await db().collection("bookings").findOne({ _id: bookingId });
    expect(b).toMatchObject({ pricesIncludeTax: true, totalAmount: 1510, taxAmount: 71.9 });
  });

  it("a second run does nothing", async () => {
    expect((await fixInclusiveBill(ref, { apply: true, runId: `t2-${tag}` })).result).toMatch(/already has GST/);
  });
});
