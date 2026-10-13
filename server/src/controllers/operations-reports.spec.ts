import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { AdvancePayment } from "../models/AdvancePayment";
import { Payment } from "../models/Payment";
import { getCheckInReport, getCheckOutReport, getDayUseSalesReport, getAdvanceOpsReport } from "./operations-reports.controller";
import { businessDayRange } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const DAY = "2033-03-15";
const at = (h: number) => new Date(businessDayRange(DAY).start.getTime() + h * 3600_000);
const ids = { bookings: [] as any[], advances: [] as any[], payments: [] as any[] };

function call(handler: any, query: any) {
  const req: any = { query, propertyId: P, user: { id: String(oid()), role: "MANAGER" } };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => res);
}

async function booking(extra: Record<string, unknown>) {
  const b = await Booking.create({
    propertyId: P, bookingReference: `OPS-${oid()}`, source: "WALK_IN",
    guestDetails: { firstName: "Ops", lastName: "Guest", email: "ops@test.local", phone: "9000000009" },
    roomCategory: oid(), adults: 2, taxAmount: 0, ...extra,
  } as any);
  ids.bookings.push(b._id);
  return b;
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  // in-house, checked in on DAY
  await booking({ checkInDate: businessDayRange(DAY).start, checkOutDate: businessDayRange("2033-03-17").start, status: BookingStatus.CHECKED_IN, checkedInAt: at(14), totalAmount: 10500, taxAmount: 500, ratePerNight: 5000 });
  // checked out on DAY, paid by UPI
  const out = await booking({ checkInDate: businessDayRange("2033-03-13").start, checkOutDate: businessDayRange(DAY).start, status: BookingStatus.CHECKED_OUT, checkedInAt: at(-40), checkedOutAt: at(10), totalAmount: 8400, taxAmount: 400 });
  ids.payments.push((await Payment.create({ propertyId: P, booking: out._id, amount: 8400, currency: "INR", method: "UPI", status: "COMPLETED", transactionId: `TXN-OPS-${oid()}` } as any))._id);
  // hourly day-use on DAY
  await booking({ stayType: "HOURLY", hours: 3, checkInDate: at(11), checkOutDate: at(14), status: BookingStatus.CHECKED_OUT, checkedInAt: at(11), checkedOutAt: at(14), totalAmount: 1575, taxAmount: 75, cgstAmount: 37.5, sgstAmount: 37.5 });
  // future arrival with a partial advance received on DAY
  const arr = await booking({ checkInDate: businessDayRange("2033-03-18").start, checkOutDate: businessDayRange("2033-03-19").start, status: BookingStatus.CONFIRMED, totalAmount: 6000 });
  ids.advances.push((await AdvancePayment.create({ propertyId: P, advanceNumber: `ADV-OPS-${oid()}`, booking: arr._id, guest: oid(), amount: 2000, totalAdjusted: 0, totalRefunded: 0, remainingBalance: 2000, method: "CASH", status: "RECEIVED", receivedAt: at(9), receivedBy: oid() } as any))._id);
});

afterAll(async () => {
  await Payment.deleteMany({ _id: { $in: ids.payments } });
  await AdvancePayment.deleteMany({ _id: { $in: ids.advances } });
  await Booking.deleteMany({ _id: { $in: ids.bookings } });
  await mongoose.connection.close();
});

describe("operations reports", () => {
  it("check-ins: by check-in time", async () => {
    const r = await call(getCheckInReport, { from: DAY, to: DAY });
    expect(r.statusCode).toBe(200);
    expect(r.body.data.rows.map((x: any) => x.totalAmount).sort()).toEqual([10500, 1575].sort());
  });

  it("check-outs: bill and mode of payment", async () => {
    const r = await call(getCheckOutReport, { from: DAY, to: DAY });
    const row = r.body.data.rows.find((x: any) => x.billAmount === 8400);
    expect(row.paymentModes).toContain("UPI");
    expect(row.received).toBe(8400);
  });

  it("day-use sales: hourly stays with tax split and a day-wise summary", async () => {
    const r = await call(getDayUseSalesReport, { from: DAY, to: DAY });
    expect(r.body.data.totals).toMatchObject({ stays: 1, hours: 3, taxable: 1500, cgst: 37.5, sgst: 37.5, total: 1575 });
    expect(r.body.data.byDay).toEqual([expect.objectContaining({ date: DAY, stays: 1, total: 1575 })]);
  });

  it("advances: received in the period, and arrivals with the balance still due", async () => {
    const r = await call(getAdvanceOpsReport, { from: DAY, to: "2033-03-20" });
    expect(r.body.data.totals.received).toMatchObject({ count: 1, amount: 2000, balance: 2000 });
    const exp = r.body.data.expected.find((x: any) => x.bookingValue === 6000);
    expect(exp).toMatchObject({ advanceReceived: 2000, balanceDue: 4000 });
  });
});
