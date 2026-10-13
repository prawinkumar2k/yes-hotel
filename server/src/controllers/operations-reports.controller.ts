/**
 * Front-office operations reports (read-only), each for a range of business days (IST):
 *
 *   GET /api/reports/ops/check-ins      guests checked in (by check-in time)
 *   GET /api/reports/ops/check-outs     guests checked out (by check-out time), with bill & payment modes
 *   GET /api/reports/ops/day-use-sales  day-use / hourly stays and their sales
 *   GET /api/reports/ops/advances       advances received, plus arrivals and the advance expected
 *
 * Query: from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive; default today).
 */
import { Request, Response } from "express";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio } from "../models/Folio";
import { Payment } from "../models/Payment";
import { AdvancePayment } from "../models/AdvancePayment";
// Models referenced by populate() must be registered.
import "../models/Room";
import "../models/RoomCategory";
import "../models/User";
import "../models/Guest";
import { addDays, businessDayRange, nights as countNights, todayBusinessDate, toBusinessDate } from "../../../shared/dates";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function range(req: Request, defaultDays = 0) {
  const today = todayBusinessDate();
  const from = typeof req.query.from === "string" && YMD.test(req.query.from) ? req.query.from : today;
  const toRaw = typeof req.query.to === "string" && YMD.test(req.query.to) ? req.query.to : addDays(from, defaultDays);
  const to = toRaw < from ? from : toRaw;
  return { from, to, $gte: businessDayRange(from).start, $lt: businessDayRange(to).end };
}

const scopeOf = (req: Request) => ((req as any).propertyId ? { propertyId: (req as any).propertyId } : {});
const staffName = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "");
const guestName = (b: any) => `${b.guestDetails?.firstName ?? ""} ${b.guestDetails?.lastName ?? ""}`.replace(/\s+\.$/, "").trim();

/** Money received per booking, by mode: completed payments and advances. */
async function receiptsByBooking(bookingIds: unknown[]) {
  const [payments, advances] = await Promise.all([
    Payment.find({ booking: { $in: bookingIds as any[] }, status: "COMPLETED" } as any).select("booking method amount").lean(),
    AdvancePayment.find({ booking: { $in: bookingIds as any[] } } as any).select("booking method amount totalRefunded").lean(),
  ]);
  const out = new Map<string, { paid: number; advance: number; modes: Map<string, number> }>();
  const slot = (id: unknown) => {
    const k = String(id);
    if (!out.has(k)) out.set(k, { paid: 0, advance: 0, modes: new Map() });
    return out.get(k)!;
  };
  for (const p of payments as any[]) {
    const s = slot(p.booking);
    s.paid += p.amount || 0;
    s.modes.set(p.method, (s.modes.get(p.method) ?? 0) + (p.amount || 0));
  }
  for (const a of advances as any[]) {
    const s = slot(a.booking);
    const net = (a.amount || 0) - (a.totalRefunded || 0);
    s.advance += net;
    s.modes.set(a.method, (s.modes.get(a.method) ?? 0) + net);
  }
  return out;
}
const modesText = (m?: Map<string, number>) =>
  m && m.size ? [...m.entries()].filter(([, v]) => v > 0).map(([k, v]) => `${k} ₹${r2(v).toLocaleString("en-IN")}`).join(", ") : "";

function sendError(res: Response, error: any) {
  return res.status(500).json({ success: false, message: error.message });
}

// ── Check-in report ──────────────────────────────────────────────────────────
export const getCheckInReport = async (req: Request, res: Response) => {
  try {
    const rg = range(req);
    const bookings = await Booking.find({ ...scopeOf(req), checkedInAt: { $gte: rg.$gte, $lt: rg.$lt } } as any)
      .populate("assignedRoom", "roomNumber")
      .populate("roomCategory", "name")
      .populate("checkedInBy", "firstName lastName email")
      .sort({ checkedInAt: 1 })
      .lean();
    const money = await receiptsByBooking(bookings.map((b) => b._id));
    const rows = bookings.map((b: any) => {
      const m = money.get(String(b._id));
      return {
        checkedInAt: b.checkedInAt,
        bookingReference: b.bookingReference,
        billNumber: b.billNumber ?? "",
        guest: guestName(b),
        phone: b.guestDetails?.phone ?? "",
        room: b.assignedRoom?.roomNumber ?? "",
        category: b.roomCategory?.name ?? "",
        stayType: b.stayType === "HOURLY" ? `Hourly (${b.hours ?? 1}h)` : "Nightly",
        arrival: toBusinessDate(b.checkInDate),
        departure: toBusinessDate(b.checkOutDate),
        nights: b.stayType === "HOURLY" ? 0 : Math.max(1, countNights(b.checkInDate, b.checkOutDate)),
        pax: (b.adults ?? 0) + (b.children ?? 0),
        source: b.source,
        ratePerNight: b.ratePerNight ?? 0,
        totalAmount: b.totalAmount ?? 0,
        advance: r2(m?.advance ?? 0),
        status: b.status,
        checkedInBy: staffName(b.checkedInBy),
      };
    });
    const totals = {
      checkIns: rows.length,
      rooms: new Set(rows.map((r) => r.room).filter(Boolean)).size,
      pax: rows.reduce((t, r) => t + r.pax, 0),
      totalAmount: r2(rows.reduce((t, r) => t + r.totalAmount, 0)),
      advance: r2(rows.reduce((t, r) => t + r.advance, 0)),
    };
    return res.json({ success: true, data: { from: rg.from, to: rg.to, rows, totals } });
  } catch (error: any) {
    return sendError(res, error);
  }
};

// ── Check-out report ─────────────────────────────────────────────────────────
export const getCheckOutReport = async (req: Request, res: Response) => {
  try {
    const rg = range(req);
    const bookings = await Booking.find({ ...scopeOf(req), status: BookingStatus.CHECKED_OUT, checkedOutAt: { $gte: rg.$gte, $lt: rg.$lt } } as any)
      .populate("assignedRoom", "roomNumber")
      .populate("roomCategory", "name")
      .populate("checkedOutBy", "firstName lastName email")
      .sort({ checkedOutAt: 1 })
      .lean();
    const ids = bookings.map((b) => b._id);
    const [money, folios] = await Promise.all([
      receiptsByBooking(ids),
      Folio.find({ booking: { $in: ids } }).select("booking invoiceNumber totalCharges totalTax totalDiscounts totalRefunded balance status").lean(),
    ]);
    const folioOf = new Map(folios.map((f: any) => [String(f.booking), f]));
    const rows = bookings.map((b: any) => {
      const f: any = folioOf.get(String(b._id));
      const m = money.get(String(b._id));
      const billed = f ? r2((f.totalCharges || 0) + (f.totalTax || 0) - (f.totalDiscounts || 0)) : b.totalAmount ?? 0;
      return {
        checkedOutAt: b.checkedOutAt,
        bookingReference: b.bookingReference,
        invoiceNumber: f?.invoiceNumber ?? "",
        guest: guestName(b),
        room: b.assignedRoom?.roomNumber ?? "",
        category: b.roomCategory?.name ?? "",
        arrival: toBusinessDate(b.checkedInAt ?? b.checkInDate),
        nights: b.stayType === "HOURLY" ? 0 : Math.max(1, countNights(b.checkedInAt ?? b.checkInDate, b.checkedOutAt)),
        billAmount: billed,
        tax: r2(f?.totalTax ?? b.taxAmount ?? 0),
        received: r2((m?.paid ?? 0) + (m?.advance ?? 0)),
        refunded: r2(f?.totalRefunded ?? 0),
        balance: r2(f?.balance ?? 0),
        paymentModes: modesText(m?.modes),
        checkedOutBy: staffName(b.checkedOutBy),
      };
    });
    const totals = {
      checkOuts: rows.length,
      billAmount: r2(rows.reduce((t, r) => t + r.billAmount, 0)),
      tax: r2(rows.reduce((t, r) => t + r.tax, 0)),
      received: r2(rows.reduce((t, r) => t + r.received, 0)),
      refunded: r2(rows.reduce((t, r) => t + r.refunded, 0)),
      balance: r2(rows.reduce((t, r) => t + r.balance, 0)),
    };
    return res.json({ success: true, data: { from: rg.from, to: rg.to, rows, totals } });
  } catch (error: any) {
    return sendError(res, error);
  }
};

// ── Day-use / hourly sales report ────────────────────────────────────────────
export const getDayUseSalesReport = async (req: Request, res: Response) => {
  try {
    const rg = range(req);
    const bookings = await Booking.find({
      ...scopeOf(req),
      stayType: "HOURLY",
      checkInDate: { $gte: rg.$gte, $lt: rg.$lt },
      status: { $nin: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
    } as any)
      .populate("assignedRoom", "roomNumber")
      .populate("roomCategory", "name")
      .sort({ checkInDate: 1 })
      .lean();
    const money = await receiptsByBooking(bookings.map((b) => b._id));
    const rows = bookings.map((b: any) => {
      const m = money.get(String(b._id));
      const total = b.totalAmount ?? 0;
      const tax = b.taxAmount ?? 0;
      return {
        date: toBusinessDate(b.checkInDate),
        timeIn: b.checkedInAt ?? b.checkInDate,
        timeOut: b.checkedOutAt ?? b.checkOutDate,
        hours: b.hours ?? 1,
        bookingReference: b.bookingReference,
        guest: guestName(b),
        room: b.assignedRoom?.roomNumber ?? "",
        category: b.roomCategory?.name ?? "",
        taxable: r2(total - tax),
        cgst: r2(b.cgstAmount ?? tax / 2),
        sgst: r2(b.sgstAmount ?? tax / 2),
        total: r2(total),
        received: r2((m?.paid ?? 0) + (m?.advance ?? 0)),
        paymentModes: modesText(m?.modes),
        status: b.status,
      };
    });
    const byDay = new Map<string, { date: string; stays: number; hours: number; taxable: number; tax: number; total: number }>();
    for (const r of rows) {
      const d = byDay.get(r.date) ?? { date: r.date, stays: 0, hours: 0, taxable: 0, tax: 0, total: 0 };
      d.stays += 1;
      d.hours += r.hours;
      d.taxable = r2(d.taxable + r.taxable);
      d.tax = r2(d.tax + r.cgst + r.sgst);
      d.total = r2(d.total + r.total);
      byDay.set(r.date, d);
    }
    const totals = {
      stays: rows.length,
      hours: rows.reduce((t, r) => t + r.hours, 0),
      taxable: r2(rows.reduce((t, r) => t + r.taxable, 0)),
      cgst: r2(rows.reduce((t, r) => t + r.cgst, 0)),
      sgst: r2(rows.reduce((t, r) => t + r.sgst, 0)),
      total: r2(rows.reduce((t, r) => t + r.total, 0)),
      received: r2(rows.reduce((t, r) => t + r.received, 0)),
    };
    return res.json({ success: true, data: { from: rg.from, to: rg.to, rows, byDay: [...byDay.values()], totals } });
  } catch (error: any) {
    return sendError(res, error);
  }
};

// ── Advance report: received + expected ──────────────────────────────────────
export const getAdvanceOpsReport = async (req: Request, res: Response) => {
  try {
    const rg = range(req);
    const scope = scopeOf(req);
    const received = await AdvancePayment.find({ ...scope, receivedAt: { $gte: rg.$gte, $lt: rg.$lt } } as any)
      .populate("guest", "fullName phone")
      .populate({ path: "booking", select: "bookingReference checkInDate checkOutDate assignedRoom", populate: { path: "assignedRoom", select: "roomNumber" } })
      .populate("receivedBy", "firstName lastName email")
      .sort({ receivedAt: 1 })
      .lean();
    const receivedRows = received.map((a: any) => ({
      receivedAt: a.receivedAt,
      advanceNumber: a.advanceNumber,
      guest: a.guest?.fullName ?? "",
      phone: a.guest?.phone ?? "",
      bookingReference: a.booking?.bookingReference ?? "Unallocated",
      room: a.booking?.assignedRoom?.roomNumber ?? "",
      arrival: a.booking?.checkInDate ? toBusinessDate(a.booking.checkInDate) : "",
      method: a.method,
      reference: a.referenceNumber ?? "",
      amount: r2(a.amount || 0),
      adjusted: r2(a.totalAdjusted || 0),
      refunded: r2(a.totalRefunded || 0),
      balance: r2(a.remainingBalance || 0),
      status: a.status,
      receivedBy: staffName(a.receivedBy),
    }));

    // Expected: reservations arriving in the range, the advance taken so far and what is still due.
    const arrivals = await Booking.find({
      ...scope,
      checkInDate: { $gte: rg.$gte, $lt: rg.$lt },
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    } as any)
      .populate("assignedRoom", "roomNumber")
      .populate("roomCategory", "name")
      .sort({ checkInDate: 1 })
      .lean();
    const money = await receiptsByBooking(arrivals.map((b) => b._id));
    const expectedRows = arrivals.map((b: any) => {
      const m = money.get(String(b._id));
      const got = r2((m?.advance ?? 0) + (m?.paid ?? 0));
      return {
        arrival: toBusinessDate(b.checkInDate),
        departure: toBusinessDate(b.checkOutDate),
        bookingReference: b.bookingReference,
        guest: guestName(b),
        phone: b.guestDetails?.phone ?? "",
        room: b.assignedRoom?.roomNumber ?? "To assign",
        category: b.roomCategory?.name ?? "",
        source: b.source,
        bookingValue: r2(b.totalAmount ?? 0),
        advanceReceived: got,
        balanceDue: r2(Math.max(0, (b.totalAmount ?? 0) - got)),
        status: b.status,
      };
    });

    const totals = {
      received: {
        count: receivedRows.length,
        amount: r2(receivedRows.reduce((t, r) => t + r.amount, 0)),
        adjusted: r2(receivedRows.reduce((t, r) => t + r.adjusted, 0)),
        refunded: r2(receivedRows.reduce((t, r) => t + r.refunded, 0)),
        balance: r2(receivedRows.reduce((t, r) => t + r.balance, 0)),
      },
      expected: {
        arrivals: expectedRows.length,
        bookingValue: r2(expectedRows.reduce((t, r) => t + r.bookingValue, 0)),
        advanceReceived: r2(expectedRows.reduce((t, r) => t + r.advanceReceived, 0)),
        balanceDue: r2(expectedRows.reduce((t, r) => t + r.balanceDue, 0)),
        withoutAdvance: expectedRows.filter((r) => r.advanceReceived <= 0).length,
      },
    };
    return res.json({ success: true, data: { from: rg.from, to: rg.to, received: receivedRows, expected: expectedRows, totals } });
  } catch (error: any) {
    return sendError(res, error);
  }
};
