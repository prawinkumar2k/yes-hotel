/**
 * Customer self-service (/api/customer) and the staff side of guest change requests (/api/change-requests).
 *
 *   POST /api/customer/bookings/link                 add a stay to my account (booking number + mobile)
 *   GET  /api/customer/bookings/:id/balance          what I still owe
 *   POST /api/customer/bookings/:id/pay/order        start an online payment of the balance (Razorpay order)
 *   POST /api/customer/payments/verify               Razorpay success callback (signature + order amount checked)
 *   POST /api/customer/bookings/:id/pay/demo         dev only, when Razorpay isn't configured
 *   POST /api/customer/bookings/:id/change-request   ask Reception to change dates / guests
 *   GET  /api/customer/change-requests               my requests
 *   POST /api/customer/change-requests/:id/withdraw
 *
 *   GET  /api/change-requests?status=                Reception (BOOKINGS VIEW)
 *   GET  /api/change-requests/counts
 *   POST /api/change-requests/:id/approve|decline    Reception (BOOKINGS EDIT); the booking itself is
 *                                                    changed with the normal booking tools.
 */
import { Router, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { protect } from "../middleware/auth.middleware";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { Booking, BookingStatus } from "../models/Booking";
import { UserRole } from "../models/User";
import { BookingChangeRequest, ChangeRequestStatus } from "../models/BookingChangeRequest";
import { createAuditLog } from "../services/audit.service";
import {
  CustomerRuleError,
  amountDueForBooking,
  findBookingByProof,
  linkStayToCustomer,
  recordBalancePayment,
} from "../services/customer.service";
import { addDays, todayBusinessDate, toBusinessDate } from "../../../shared/dates";
import "../models/User";
import "../models/RoomCategory";

const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });

const customerOnly = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user?.role !== UserRole.CUSTOMER) return fail(res, 403, "Guest accounts only");
  next();
};

/** The signed-in customer's own booking, or null. */
async function myBooking(req: Request) {
  const id = String(req.params.id ?? "");
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  return Booking.findOne({ _id: id, customer: (req as any).user.id });
}

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

const demoAllowed = () => process.env.NODE_ENV !== "production" && !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

// ─────────────────────────────────────────────────────────── customer
export const customerRouter = Router();
customerRouter.use(protect, customerOnly);

const proofSchema = z.object({
  bookingReference: z.string().trim().min(3, "Enter the booking number").max(40),
  mobile: z.string().trim().min(10, "Enter the mobile number used for the booking").max(20),
});

customerRouter.post("/bookings/link", async (req: Request, res: Response) => {
  try {
    const parsed = proofSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Validation error");
    const booking = await findBookingByProof(parsed.data.bookingReference, parsed.data.mobile);
    if (!booking) {
      await createAuditLog({ req, action: "customer.link_booking_failed", resourceType: "Booking", metadata: { bookingReference: parsed.data.bookingReference } });
      return fail(res, 404, "Booking number and mobile number don't match our records");
    }
    const me = String((req as any).user.id);
    if (booking.customer && String(booking.customer) !== me) {
      return fail(res, 409, "This booking is already linked to another account. Please contact Reception.");
    }
    const linked = await linkStayToCustomer(booking, me);
    await createAuditLog({ req, action: "customer.link_booking", resourceType: "Booking", resourceId: String(booking._id), metadata: { bookingReference: booking.bookingReference, linkedBookings: linked.length } });
    return res.json({ success: true, message: linked.length > 1 ? `${linked.length} rooms added to your account` : "Booking added to your account", data: { bookingId: String(booking._id), linked } });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

customerRouter.get("/bookings/:id/balance", async (req: Request, res: Response) => {
  try {
    const booking = await myBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");
    const due = await amountDueForBooking(booking);
    return res.json({
      success: true,
      data: { ...due, currency: "INR", canPayOnline: due.amountDue > 0, gateway: getRazorpay() ? "RAZORPAY" : demoAllowed() ? "DEMO" : "UNAVAILABLE" },
    });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

const amountSchema = z.object({ amount: z.number().positive().optional() });

/** The amount to collect: the requested part-payment, or the full balance. */
async function payableAmount(booking: any, requested?: number) {
  const due = await amountDueForBooking(booking);
  if (due.amountDue <= 0) throw new CustomerRuleError("Nothing is due on this booking", 409);
  const amount = requested == null ? due.amountDue : Math.round(requested * 100) / 100;
  if (amount < 1) throw new CustomerRuleError("The minimum online payment is ₹1");
  if (amount > due.amountDue) throw new CustomerRuleError(`You can pay up to ₹${due.amountDue.toFixed(2)}`);
  return amount;
}

customerRouter.post("/bookings/:id/pay/order", async (req: Request, res: Response) => {
  try {
    const parsed = amountSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, "Enter a valid amount");
    const booking = await myBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");
    const amount = await payableAmount(booking, parsed.data.amount);
    const rz = getRazorpay();
    if (!rz) {
      if (demoAllowed()) return res.json({ success: true, data: { demo: true, amount, currency: "INR" } });
      return fail(res, 503, "Online payment is not available right now. Please pay at Reception.");
    }
    const order = await rz.client.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `BAL-${booking.bookingReference}`.slice(0, 40),
      notes: { bookingId: String(booking._id), purpose: "BALANCE" },
    });
    await createAuditLog({ req, action: "customer.balance_order_created", resourceType: "Booking", resourceId: String(booking._id), metadata: { orderId: order.id, amount } });
    return res.json({ success: true, data: { orderId: order.id, amount, currency: "INR", keyId: rz.keyId, bookingReference: booking.bookingReference } });
  } catch (e: any) {
    if (e instanceof CustomerRuleError) return fail(res, e.status, e.message);
    return fail(res, 500, e.message);
  }
});

const verifySchema = z.object({
  bookingId: z.string().regex(/^[a-f0-9]{24}$/i),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

customerRouter.post("/payments/verify", async (req: Request, res: Response) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Missing payment verification fields");
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
    const rz = getRazorpay();
    if (!rz) return fail(res, 503, "Payment gateway not configured");
    const expected = crypto.createHmac("sha256", rz.keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const ok = expected.length === razorpay_signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!ok) return fail(res, 400, "Payment signature verification failed");
    const booking = await Booking.findOne({ _id: bookingId, customer: (req as any).user.id });
    if (!booking) return fail(res, 404, "Booking not found");
    // The amount comes from the gateway's order, never from the browser.
    const order = await rz.client.orders.fetch(razorpay_order_id);
    if (order?.notes?.purpose !== "BALANCE" || String(order?.notes?.bookingId) !== String(booking._id)) {
      return fail(res, 400, "This payment is not for this booking");
    }
    const amount = Math.round(Number(order.amount_paid || order.amount)) / 100;
    const out = await recordBalancePayment({ booking, amount, gatewayPaymentId: razorpay_payment_id, gatewayOrderId: razorpay_order_id, signature: razorpay_signature, method: "RAZORPAY", req });
    await createAuditLog({ req, action: "customer.balance_paid", resourceType: "Booking", resourceId: String(booking._id), metadata: { amount, razorpayPaymentId: razorpay_payment_id, duplicate: out.duplicate } });
    return res.json({ success: true, message: out.duplicate ? "Payment already recorded" : "Payment received — thank you", data: { paymentId: String((out.payment as any)?._id ?? ""), amount } });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

customerRouter.post("/bookings/:id/pay/demo", async (req: Request, res: Response) => {
  try {
    if (!demoAllowed()) return fail(res, 403, "Demo payment is only available in development without Razorpay keys");
    const parsed = amountSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, "Enter a valid amount");
    const booking = await myBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");
    const amount = await payableAmount(booking, parsed.data.amount);
    const demoId = `demo_${crypto.randomBytes(8).toString("hex")}`;
    const out = await recordBalancePayment({ booking, amount, gatewayPaymentId: demoId, gatewayOrderId: demoId, method: "RAZORPAY", req });
    await createAuditLog({ req, action: "customer.balance_paid_demo", resourceType: "Booking", resourceId: String(booking._id), metadata: { amount, demoId } });
    return res.json({ success: true, message: "Demo payment recorded", data: { paymentId: String((out.payment as any)?._id ?? ""), amount } });
  } catch (e: any) {
    if (e instanceof CustomerRuleError) return fail(res, e.status, e.message);
    return fail(res, 500, e.message);
  }
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const changeSchema = z.object({
  checkInDate: dateStr.optional(),
  checkOutDate: dateStr.optional(),
  adults: z.number().int().min(1).max(10).optional(),
  children: z.number().int().min(0).max(10).optional(),
  note: z.string().trim().max(1000).optional(),
});

customerRouter.post("/bookings/:id/change-request", async (req: Request, res: Response) => {
  try {
    const parsed = changeSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message ?? "Validation error");
    const booking: any = await myBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");
    const inHouse = booking.status === BookingStatus.CHECKED_IN;
    if (![BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].includes(booking.status)) {
      return fail(res, 409, "This booking can no longer be changed");
    }
    const cur = {
      checkInDate: toBusinessDate(booking.checkInDate),
      checkOutDate: toBusinessDate(booking.checkOutDate),
      adults: booking.adults ?? 1,
      children: booking.children ?? 0,
    };
    const d = parsed.data;
    const next = {
      checkInDate: d.checkInDate ?? cur.checkInDate,
      checkOutDate: d.checkOutDate ?? cur.checkOutDate,
      adults: d.adults ?? cur.adults,
      children: d.children ?? cur.children,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== cur[k]);
    if (!changed.length) return fail(res, 400, "Nothing to change — pick new dates or guest numbers");
    if (inHouse && next.checkInDate !== cur.checkInDate) return fail(res, 400, "You are already checked in; only the check-out date or guests can change");
    const today = todayBusinessDate();
    if (!inHouse && next.checkInDate < today) return fail(res, 400, "Check-in can't be in the past");
    if (next.checkOutDate <= next.checkInDate) return fail(res, 400, "Check-out must be after check-in");
    if (next.checkOutDate > addDays(today, 365)) return fail(res, 400, "Dates can be at most a year ahead");

    const requested: Record<string, any> = {};
    for (const k of changed) requested[k] = k.endsWith("Date") ? new Date(`${next[k]}T00:00:00+05:30`) : next[k];
    try {
      const cr = await BookingChangeRequest.create({
        propertyId: booking.propertyId,
        booking: booking._id,
        customer: (req as any).user.id,
        current: { checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, adults: cur.adults, children: cur.children },
        requested,
        note: d.note,
      });
      await createAuditLog({ req, action: "customer.change_requested", resourceType: "Booking", resourceId: String(booking._id), metadata: { requestId: String(cr._id), requested: next } });
      return res.status(201).json({ success: true, message: "Request sent to Reception. We'll confirm the change and any difference in price.", data: cr });
    } catch (e: any) {
      if (e?.code === 11000) return fail(res, 409, "You already have a change request waiting for this booking");
      throw e;
    }
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

customerRouter.get("/change-requests", async (req: Request, res: Response) => {
  try {
    const filter: Record<string, any> = { customer: (req as any).user.id };
    if (req.query.bookingId && /^[a-f0-9]{24}$/i.test(String(req.query.bookingId))) filter.booking = String(req.query.bookingId);
    const rows = await BookingChangeRequest.find(filter).sort({ createdAt: -1 }).limit(100).populate("booking", "bookingReference status").lean();
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

customerRouter.post("/change-requests/:id/withdraw", async (req: Request, res: Response) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) return fail(res, 404, "Request not found");
    const cr = await BookingChangeRequest.findOneAndUpdate(
      { _id: req.params.id, customer: (req as any).user.id, status: ChangeRequestStatus.PENDING },
      { $set: { status: ChangeRequestStatus.WITHDRAWN, handledAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!cr) return fail(res, 409, "Only a request that is still waiting can be withdrawn");
    await createAuditLog({ req, action: "customer.change_withdrawn", resourceType: "Booking", resourceId: String(cr.booking), metadata: { requestId: String(cr._id) } });
    return res.json({ success: true, message: "Request withdrawn", data: cr });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

// ─────────────────────────────────────────────────────────── staff
export const changeRequestRouter = Router();
changeRequestRouter.use(protect, requirePropertyAccess);

const scopeOf = (req: Request) =>
  (req as any).propertyId ? { $or: [{ propertyId: (req as any).propertyId }, { propertyId: { $exists: false } }] } : {};

changeRequestRouter.get("/", requirePermission("BOOKINGS", "VIEW"), async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status ?? "PENDING");
    const filter: Record<string, any> = { ...scopeOf(req) };
    if (status !== "ALL") filter.status = status;
    const rows = await BookingChangeRequest.find(filter)
      .sort({ createdAt: status === "PENDING" ? 1 : -1 })
      .limit(200)
      .populate({ path: "booking", select: "bookingReference status guestDetails roomCategory room totalAmount checkInDate checkOutDate adults children", populate: { path: "roomCategory", select: "name" } })
      .populate("customer", "firstName lastName email phone")
      .populate("handledBy", "firstName lastName")
      .lean();
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

changeRequestRouter.get("/counts", requirePermission("BOOKINGS", "VIEW"), async (req: Request, res: Response) => {
  try {
    const pending = await BookingChangeRequest.countDocuments({ ...scopeOf(req), status: ChangeRequestStatus.PENDING });
    return res.json({ success: true, data: { pending } });
  } catch (e: any) {
    return fail(res, 500, e.message);
  }
});

const decideSchema = z.object({ note: z.string().trim().max(1000).optional() });

for (const [action, status] of [["approve", ChangeRequestStatus.APPROVED], ["decline", ChangeRequestStatus.DECLINED]] as const) {
  changeRequestRouter.post(`/:id/${action}`, requirePermission("BOOKINGS", "EDIT"), async (req: Request, res: Response) => {
    try {
      const parsed = decideSchema.safeParse(req.body ?? {});
      if (!parsed.success) return fail(res, 400, "Note is too long");
      if (status === ChangeRequestStatus.DECLINED && !parsed.data.note) return fail(res, 400, "Give the guest a reason for declining");
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) return fail(res, 404, "Request not found");
      const cr = await BookingChangeRequest.findOneAndUpdate(
        { _id: req.params.id, status: ChangeRequestStatus.PENDING, ...scopeOf(req) },
        { $set: { status, handledBy: (req as any).user.id, handledAt: new Date(), responseNote: parsed.data.note } },
        { returnDocument: "after" },
      );
      if (!cr) return fail(res, 409, "This request has already been handled or withdrawn");
      await createAuditLog({ req, action: `booking.change_request_${action}d`, resourceType: "Booking", resourceId: String(cr.booking), metadata: { requestId: String(cr._id), note: parsed.data.note } });
      return res.json({ success: true, message: status === ChangeRequestStatus.APPROVED ? "Marked approved — make sure the booking has been updated" : "Request declined", data: cr });
    } catch (e: any) {
      return fail(res, 500, e.message);
    }
  });
}

