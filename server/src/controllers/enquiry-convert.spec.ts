import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { BookingEnquiry, BookingEnquiryStatus } from "../models/BookingEnquiry";
import { Booking, BookingStatus } from "../models/Booking";
import { BookingInventoryDay } from "../models/BookingInventoryDay";
import { RoomCategory } from "../models/RoomCategory";
import { Room } from "../models/Room";
import { Guest } from "../models/Guest";
import { convertEnquiryToBooking, updateBookingEnquiryStatus, addFollowUp, isFollowUpOverdue, overdueFollowUpFilter } from "./bookingEnquiry.controller";
import { businessDayRange } from "../../../shared/dates";

const oid = () => new mongoose.Types.ObjectId();
const P = oid();
const tag = String(oid()).slice(-6);
let categoryId = "";
const roomIds: any[] = [];
const enquiryIds: any[] = [];

function call(handler: any, body: any, params: any) {
  const req: any = { body, params, propertyId: P, user: { id: String(oid()), role: "ADMIN" }, headers: {}, ip: "127.0.0.1" };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((d: any) => ((res.body = d), res));
  return handler(req, res).then(() => res);
}

async function enquiry(extra: Record<string, unknown> = {}) {
  const e = await BookingEnquiry.create({
    enquiryNumber: `ENQ-T-${tag}-${enquiryIds.length}`,
    guestName: "Convert Test",
    phone: "9000000001",
    email: `enq-${tag}@test.local`,
    checkIn: businessDayRange("2031-03-10").start,
    checkOut: businessDayRange("2031-03-12").start,
    nights: 2,
    adults: 2,
    children: 0,
    rooms: 2,
    roomType: "To be assigned",
    enquiryType: "INDIVIDUAL",
    source: "PHONE",
    propertyId: P,
    ...extra,
  } as any);
  enquiryIds.push(e._id);
  return e;
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  const c = await RoomCategory.create({ slug: `test-cat-${tag}`, name: `Test Cat ${tag}`, description: "test", basePrice: 4000, isActive: true } as any);
  categoryId = String(c._id);
  for (const n of [1, 2]) {
    const r = await Room.create({ propertyId: P, roomNumber: `T${tag}${n}`, category: c._id, floor: "9" } as any);
    roomIds.push(r._id);
  }
});

afterAll(async () => {
  const bookings = await Booking.find({ roomCategory: categoryId }).select("_id").lean();
  await Booking.deleteMany({ _id: { $in: bookings.map((b) => b._id) } });
  await BookingInventoryDay.deleteMany({ roomCategory: categoryId });
  await BookingEnquiry.deleteMany({ _id: { $in: enquiryIds } });
  await Guest.deleteMany({ email: `enq-${tag}@test.local` });
  await Room.deleteMany({ _id: { $in: roomIds } });
  await RoomCategory.deleteMany({ _id: categoryId });
  await mongoose.connection.close();
});

describe("enquiry conversion", () => {
  it("requires a room category", async () => {
    const e = await enquiry({ rooms: 1 });
    const res = await call(convertEnquiryToBooking, {}, { id: String(e._id) });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/room category/i);
  });

  it("creates one priced, taxed booking per room, claims inventory, and cannot convert twice", async () => {
    const e = await enquiry();
    const res = await call(convertEnquiryToBooking, { roomCategoryId: categoryId }, { id: String(e._id) });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.bookings).toHaveLength(2);

    const bookings = await Booking.find({ _id: { $in: res.body.data.bookings.map((b: any) => b._id) } }).lean();
    for (const b of bookings) {
      expect(b.status).toBe(BookingStatus.CONFIRMED);
      expect(b.ratePerNight).toBe(4000);
      expect(b.taxAmount).toBe(400); // ₹8,000 for 2 nights, ≤ ₹7,500/night → 5%
      expect(b.totalAmount).toBe(8400);
      expect(String(b.groupId)).toBe(String(bookings[0].groupId));
    }
    const days = await BookingInventoryDay.find({ roomCategory: categoryId }).lean();
    expect(days.map((d) => d.reservedCount)).toEqual([2, 2]);
    expect((await BookingEnquiry.findById(e._id))!.status).toBe(BookingEnquiryStatus.CONVERTED);

    const again = await call(convertEnquiryToBooking, { roomCategoryId: categoryId }, { id: String(e._id) });
    expect(again.statusCode).toBe(409);
  });

  it("refuses when the category is sold out, leaving nothing behind", async () => {
    const e = await enquiry({ rooms: 1 });
    const before = await Booking.countDocuments({ roomCategory: categoryId });
    const res = await call(convertEnquiryToBooking, { roomCategoryId: categoryId }, { id: String(e._id) });
    expect(res.statusCode).toBe(409);
    expect(await Booking.countDocuments({ roomCategory: categoryId })).toBe(before);
    expect((await BookingEnquiry.findById(e._id))!.status).not.toBe(BookingEnquiryStatus.CONVERTED);
  });

  it("uses the quotation as the agreed pre-tax charge", async () => {
    const e = await enquiry({ rooms: 1, checkIn: businessDayRange("2031-04-10").start, checkOut: businessDayRange("2031-04-11").start, nights: 1, quotationAmount: 9000 });
    const res = await call(convertEnquiryToBooking, { roomCategoryId: categoryId }, { id: String(e._id) });
    expect(res.statusCode).toBe(201);
    const b = await Booking.findById(res.body.data.booking._id).lean();
    expect(b).toMatchObject({ ratePerNight: 9000, taxAmount: 1620, totalAmount: 10620 }); // > ₹7,500 → 18%
  });

  it("status: CONVERTED only via convert; LOST needs a reason; follow-ups do not reopen closed enquiries", async () => {
    const e = await enquiry({ rooms: 1 });
    expect((await call(updateBookingEnquiryStatus, { status: "CONVERTED" }, { id: String(e._id) })).statusCode).toBe(400);
    expect((await call(updateBookingEnquiryStatus, { status: "LOST" }, { id: String(e._id) })).statusCode).toBe(400);
    expect((await call(updateBookingEnquiryStatus, { status: "LOST", lostReason: "booked elsewhere" }, { id: String(e._id) })).statusCode).toBe(200);
    const fu = await call(addFollowUp, { notes: "called back", method: "PHONE" }, { id: String(e._id) });
    expect(fu.statusCode).toBe(200);
    expect((await BookingEnquiry.findById(e._id))!.status).toBe(BookingEnquiryStatus.LOST);
  });

  it("overdue follow-up: past next date or an untouched NEW lead older than 24h; closed or due-today are not overdue", async () => {
    const day = 24 * 3600 * 1000;
    expect(isFollowUpOverdue({ status: "FOLLOW_UP", nextFollowUpDate: new Date(Date.now() - 2 * day) })).toBe(true);
    expect(isFollowUpOverdue({ status: "FOLLOW_UP", nextFollowUpDate: new Date() })).toBe(false);
    expect(isFollowUpOverdue({ status: "LOST", nextFollowUpDate: new Date(Date.now() - 2 * day) })).toBe(false);
    expect(isFollowUpOverdue({ status: "NEW", createdAt: new Date(Date.now() - 2 * day), followUps: [] })).toBe(true);
    expect(isFollowUpOverdue({ status: "NEW", createdAt: new Date(Date.now() - 2 * day), followUps: [{}] })).toBe(false);
    const e = await enquiry({ rooms: 1, status: "FOLLOW_UP", nextFollowUpDate: new Date(Date.now() - 3 * day) });
    expect(await BookingEnquiry.exists({ _id: e._id, ...overdueFollowUpFilter() })).toBeTruthy();
  });
});
