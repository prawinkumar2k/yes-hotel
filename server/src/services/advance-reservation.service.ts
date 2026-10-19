/**
 * Advance booking: a guest pays an advance now to reserve rooms for a later stay (e.g. 10 rooms,
 * 20 adults, arriving 31 Oct). The desk does not know room numbers yet, so the rooms are held by
 * room TYPE (the same inventory hold website bookings use) and given a number when the guests
 * arrive and are checked in from Front Desk → Arrivals.
 *
 * One reservation = one confirmed booking per room (shared groupId, like a group walk-in). The
 * advance sits on the first room's booking and belongs to the whole group; at billing every room
 * can draw from it. Rooms, bookings and the advance are saved together or not at all, repeated
 * submits are recognised, and everything is priced by the server (GST per the hotel's rules).
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import type { Request } from "express";
import { Booking, BookingStatus, BookingSource, BookingType, MealPlan, PaymentStatus, RegistrationStatus, SignatureStatus } from "../models/Booking";
import { RoomCategory } from "../models/RoomCategory";
import { Room } from "../models/Room";
import { Property } from "../models/Property";
import { HotelSettings } from "../models/HotelSettings";
import { AdvancePayment } from "../models/AdvancePayment";
import { BookingIdempotency, BookingIdempotencyStatus } from "../models/BookingIdempotency";
import { VerificationType } from "../models/VerificationRequest";
import { SELLABLE_ROOM_FILTER } from "./maintenance.service";
import { BookingConflictError, buildStayDates, claimInventoryDays, prepareInventoryDays } from "./booking-safety.service";
import { computeRoomTax, loadRoomPricing } from "./tax.service";
import { receiveAdvance, resolveAdvanceMethod } from "./advance.service";
import { resolveGuest } from "./guest-match.service";
import { createAuditLog } from "./audit.service";
import { generateBookingReference } from "../utils/booking-reference";
import { resolvePaymentChannel } from "../utils/payment-channel.resolver";
import { nights as countNights, toBusinessDate, todayBusinessDate } from "../../../shared/dates";
import { HOTEL, hotelAddressOneLine } from "../../../shared/hotel-info";

export class ReservationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MEAL_RATES: Record<string, number> = { EP: 0, CP: 500, MAP: 1000, AP: 1500 };
const ACTIVE = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN];
const MAX_ROOMS = 100;
const MAX_NIGHTS = 90;

export type ReservationInput = {
  guest: { name?: string; phone?: string; email?: string; address?: string; gstin?: string };
  roomCategoryId?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string;
  arrivalTime?: string; // HH:MM
  departureTime?: string;
  mealPlan?: string;
  /** Per room per night, as the hotel prices (GST inside when "prices include GST" is on). */
  ratePerNight?: number;
  advance?: { amount?: number; paymentChannelId?: string; method?: string; reference?: string };
  notes?: string;
  clientRequestId?: string;
};

type Clean = {
  guest: { name: string; phone: string; email: string; address: string; gstin: string };
  roomCategoryId: string;
  rooms: number;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  arrivalTime?: string;
  departureTime?: string;
  mealPlan: string;
  ratePerNight?: number;
  advance: { amount: number; paymentChannelId?: string; method?: string; reference?: string };
  notes?: string;
};

function clean(input: ReservationInput): Clean {
  const g = input.guest ?? {};
  const name = String(g.name ?? "").trim();
  const phone = String(g.phone ?? "").trim();
  if (name.length < 2) throw new ReservationError("Enter the guest's name");
  if (phone.replace(/\D/g, "").length < 7) throw new ReservationError("Enter the guest's mobile number");
  const email = String(g.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ReservationError("Enter a valid email, or leave it empty");
  const gstin = String(g.gstin ?? "").trim().toUpperCase();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new ReservationError("The customer's GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5 (or leave it empty)");

  if (!input.roomCategoryId || !mongoose.isValidObjectId(input.roomCategoryId)) throw new ReservationError("Choose the room type");
  const rooms = Number(input.rooms);
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > MAX_ROOMS) throw new ReservationError(`Rooms must be between 1 and ${MAX_ROOMS}`);
  const adults = Number(input.adults);
  const children = Number(input.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1) throw new ReservationError("Enter the number of adults");
  if (!Number.isInteger(children) || children < 0) throw new ReservationError("Children must be 0 or more");
  if (adults < rooms) throw new ReservationError("Every room needs at least one adult — reduce the rooms or add adults");

  const checkIn = String(input.checkIn ?? "");
  const checkOut = String(input.checkOut ?? "");
  if (!YMD.test(checkIn) || !YMD.test(checkOut) || Number.isNaN(new Date(checkIn).getTime()) || Number.isNaN(new Date(checkOut).getTime())) throw new ReservationError("Choose the check-in and check-out dates");
  if (checkIn < todayBusinessDate()) throw new ReservationError("Check-in date cannot be in the past");
  if (checkOut <= checkIn) throw new ReservationError("Check-out must be after check-in");
  if (countNights(new Date(checkIn), new Date(checkOut)) > MAX_NIGHTS) throw new ReservationError(`A reservation can be at most ${MAX_NIGHTS} nights`);
  for (const [label, t] of [["Check-in time", input.arrivalTime], ["Check-out time", input.departureTime]] as const) {
    if (t && !HHMM.test(String(t))) throw new ReservationError(`${label} must look like 14:00`);
  }
  const mealPlan = String(input.mealPlan || "EP").toUpperCase();
  if (!Object.values(MealPlan).includes(mealPlan as MealPlan)) throw new ReservationError("Choose a valid meal plan");

  let ratePerNight: number | undefined;
  if (input.ratePerNight !== undefined && input.ratePerNight !== null && String(input.ratePerNight) !== "") {
    ratePerNight = r2(Number(input.ratePerNight));
    if (!(ratePerNight > 0)) throw new ReservationError("Enter a rate per night greater than zero");
  }
  const amount = r2(Number(input.advance?.amount ?? 0));
  if (!(amount >= 0)) throw new ReservationError("Enter a valid advance amount");

  return {
    guest: { name, phone, email, address: String(g.address ?? "").trim(), gstin },
    roomCategoryId: String(input.roomCategoryId),
    rooms, adults, children, checkIn, checkOut,
    arrivalTime: input.arrivalTime ? String(input.arrivalTime) : undefined,
    departureTime: input.departureTime ? String(input.departureTime) : undefined,
    mealPlan,
    ratePerNight,
    advance: { amount, paymentChannelId: input.advance?.paymentChannelId ? String(input.advance.paymentChannelId) : undefined, method: input.advance?.method ? String(input.advance.method).toUpperCase() : undefined, reference: input.advance?.reference ? String(input.advance.reference).trim() : undefined },
    notes: input.notes ? String(input.notes).trim().slice(0, 500) : undefined,
  };
}

/** Rooms of the type still free on EVERY night of the stay (counted from active bookings, per night). */
export async function freeRooms(roomCategoryId: string, checkIn: Date, checkOut: Date, session?: mongoose.ClientSession) {
  const capacity = await Room.countDocuments({ category: roomCategoryId, ...SELLABLE_ROOM_FILTER }).session(session ?? null);
  const overlapping: any[] = await Booking.find({ roomCategory: roomCategoryId, status: { $in: ACTIVE }, checkInDate: { $lt: checkOut }, checkOutDate: { $gt: checkIn } })
    .select("checkInDate checkOutDate")
    .session(session ?? null)
    .lean();
  let busiest = 0;
  for (const night of buildStayDates(checkIn, checkOut)) {
    // A booking occupies the night if it checks in on/before it and out after it (business dates).
    const day = toBusinessDate(night);
    const taken = overlapping.filter((b) => toBusinessDate(b.checkInDate) <= day && toBusinessDate(b.checkOutDate) > day).length;
    busiest = Math.max(busiest, taken);
  }
  return { capacity, available: Math.max(0, capacity - busiest) };
}

export type ReservationPricing = Awaited<ReturnType<typeof price>>;

async function price(c: Clean, category: any) {
  const settings: any = (await HotelSettings.findOne().sort({ updatedAt: -1 }).select("mealPlanRates checkInTime checkOutTime taxInclusiveRates").lean()) ?? {};
  const { rules, inclusive } = await loadRoomPricing();
  const ci = new Date(c.checkIn);
  const co = new Date(c.checkOut);
  const nights = countNights(ci, co);
  const defaultRate = Number(category.basePrice) || 0;
  const rate = c.ratePerNight ?? defaultRate;
  if (!(rate > 0)) throw new ReservationError("This room type has no rate set — enter the rate per night");
  const mealRate = Number(settings.mealPlanRates?.[c.mealPlan] ?? DEFAULT_MEAL_RATES[c.mealPlan] ?? 0);
  const mealPlanTotal = r2(mealRate * (c.adults + c.children) * nights);

  const perRoom = Array.from({ length: c.rooms }, (_, i) => {
    const subtotal = r2(rate * nights + (i === 0 ? mealPlanTotal : 0));
    const t = computeRoomTax(rules, { checkIn: ci, checkOut: co, nightlyValue: subtotal / nights, inclusive });
    return { subtotal, taxable: r2(t.taxable), cgst: r2(t.cgst), sgst: r2(t.sgst), tax: r2(t.tax), total: r2(t.total) };
  });
  const sum = (k: "taxable" | "cgst" | "sgst" | "tax" | "total") => r2(perRoom.reduce((a, r) => a + r[k], 0));
  const total = sum("total");
  const roundedTotal = Math.round(total);
  const capacityPerRoom = Number(category.capacity?.adults) || 0;
  const extraPersons = capacityPerRoom > 0 ? Math.max(0, c.adults - capacityPerRoom * c.rooms) : 0;
  return {
    nights,
    rooms: c.rooms,
    ratePerNight: rate,
    defaultRate,
    belowDefault: rate < defaultRate,
    pricesIncludeTax: inclusive,
    mealPlan: c.mealPlan,
    mealPlanRate: mealRate,
    mealPlanTotal,
    perRoom,
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    totalGst: sum("tax"),
    total,
    roundedTotal,
    roundOff: r2(roundedTotal - total),
    gstRate: perRoom[0] ? (perRoom[0].taxable > 0 ? Math.round(((perRoom[0].cgst + perRoom[0].sgst) / perRoom[0].taxable) * 1000) / 10 : 0) : 0,
    arrivalTime: c.arrivalTime ?? settings.checkInTime ?? "12:00",
    departureTime: c.departureTime ?? settings.checkOutTime ?? "11:00",
    capacityWarning: extraPersons > 0 ? `${c.adults} adults is more than ${capacityPerRoom} per room for ${c.rooms} room(s): ${extraPersons} extra person(s) — extra-person charges are added at check-in.` : undefined,
  };
}

/** Live quote for the form: server-side price, GST and how many rooms are free. Changes nothing. */
export async function quoteReservation(input: ReservationInput) {
  const c = clean({ ...input, advance: { ...input.advance, amount: input.advance?.amount ?? 0 } });
  const category: any = await RoomCategory.findById(c.roomCategoryId).lean();
  if (!category || category.isActive === false) throw new ReservationError("That room type is not available", 404);
  const pricing = await price(c, category);
  const stock = await freeRooms(c.roomCategoryId, new Date(c.checkIn), new Date(c.checkOut));
  return { ...pricing, categoryName: category.name, capacity: stock.capacity, availableRooms: stock.available, canBook: stock.available >= c.rooms };
}

function splitName(name: string) {
  const parts = name.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || "." };
}

export async function createAdvanceReservation(input: ReservationInput, ctx: { req: Request; actorId: string }) {
  const c = clean(input);
  const requestId = String(input.clientRequestId ?? "").trim();
  if (requestId.length < 8 || requestId.length > 80) throw new ReservationError("Missing request id — reload the page and try again");

  // Duplicate-submission guard: the same request id returns the same reservation, never a second one.
  // (Checked first: after a successful booking the rooms are no longer free, and a repeat must still get the original answer.)
  const key = `advres:${ctx.actorId}:${requestId}`;
  const hash = crypto.createHash("sha256").update(JSON.stringify(c)).digest("hex");
  const prior: any = await BookingIdempotency.findOne({ key }).lean();
  if (prior) {
    if (prior.requestHash !== hash) throw new ReservationError("This request was already used for different details — reload the page and try again", 409);
    if (prior.status === BookingIdempotencyStatus.SUCCEEDED && prior.responseData) return { ...prior.responseData, duplicate: true };
    if (prior.status === BookingIdempotencyStatus.IN_PROGRESS && Date.now() - new Date(prior.createdAt).getTime() < 120_000) {
      throw new ReservationError("This reservation is already being saved — please wait a moment", 409);
    }
    await BookingIdempotency.deleteOne({ key }); // failed or stale: allow a clean retry
  }

  const category: any = await RoomCategory.findById(c.roomCategoryId).lean();
  if (!category || category.isActive === false) throw new ReservationError("That room type is not available", 404);
  const pricing = await price(c, category);
  if (c.advance.amount > pricing.roundedTotal + 0.01) {
    throw new ReservationError(`The advance ₹${c.advance.amount.toLocaleString("en-IN")} is more than the booking total ₹${pricing.roundedTotal.toLocaleString("en-IN")}`);
  }
  let method: string | undefined;
  if (c.advance.amount > 0) {
    try {
      method = await resolveAdvanceMethod(c.advance.method, c.advance.paymentChannelId);
    } catch (e: any) {
      throw new ReservationError(e.message);
    }
  }
  const ci = new Date(c.checkIn);
  const co = new Date(c.checkOut);
  const stock = await freeRooms(c.roomCategoryId, ci, co);
  if (stock.available < c.rooms) {
    throw new ReservationError(`Only ${stock.available} ${category.name} room${stock.available === 1 ? " is" : "s are"} free for those dates (you asked for ${c.rooms}). Choose other dates or another room type.`, 409);
  }

  try {
    await BookingIdempotency.create({ key, requestHash: hash, status: BookingIdempotencyStatus.IN_PROGRESS });
  } catch (e: any) {
    if (e?.code === 11000) throw new ReservationError("This reservation is already being saved — please wait a moment", 409);
    throw e;
  }

  const found = await resolveGuest({ name: c.guest.name, phone: c.guest.phone, email: c.guest.email || undefined });
  const guestDoc = found.guest;
  const propertyId = (ctx.req as any).propertyId || (ctx.req as any).user?.propertyId || (await Property.findOne({ isActive: { $ne: false } }).select("_id").lean())?._id;
  const channelId = c.advance.amount > 0 ? await resolvePaymentChannel(method!, c.advance.paymentChannelId) : undefined;
  const channelCode = c.advance.paymentChannelId ? ((await (await import("../models/PaymentChannel")).PaymentChannel.findById(c.advance.paymentChannelId).select("code").lean()) as any)?.code : undefined;
  const groupId = new mongoose.Types.ObjectId();
  const { firstName, lastName } = splitName(c.guest.name);
  const email = c.guest.email ? c.guest.email.toLowerCase() : "";

  // Guests per room: adults and children spread evenly, the remainder on the first rooms.
  const spread = (total: number, i: number) => Math.floor(total / c.rooms) + (i < total % c.rooms ? 1 : 0);

  let result: any;
  const session = await mongoose.startSession();
  try {
    const capacity = await prepareInventoryDays(c.roomCategoryId, ci, co); // creates the day records (outside the transaction)
    await session.withTransaction(async () => {
      await claimInventoryDays({ roomCategoryId: c.roomCategoryId, checkInDate: ci, checkOutDate: co, capacity, count: c.rooms, session });

      const created: any[] = [];
      for (let i = 0; i < c.rooms; i++) {
        const bookingReference = await generateBookingReference("RES", session);
        const pr = pricing.perRoom[i];
        const [b] = await Booking.create(
          [{
            propertyId,
            groupId,
            bookingReference,
            guestDetails: {
              firstName, lastName, email, phone: c.guest.phone,
              address: c.guest.address || undefined,
              gstin: c.guest.gstin || undefined,
            },
            roomCategory: category._id,
            checkInDate: ci,
            checkOutDate: co,
            stayType: "NIGHTLY",
            arrivalTime: pricing.arrivalTime,
            departureTime: pricing.departureTime,
            mealPlan: c.mealPlan as MealPlan,
            ratePerNight: pricing.ratePerNight,
            adults: spread(c.adults, i),
            children: spread(c.children, i),
            status: BookingStatus.CONFIRMED,
            totalAmount: pr.total,
            taxAmount: pr.tax,
            cgstAmount: pr.cgst,
            sgstAmount: pr.sgst,
            discountAmount: 0,
            pricesIncludeTax: pricing.pricesIncludeTax,
            paymentStatus: PaymentStatus.UNPAID,
            paidAmount: 0,
            billingInstruction: channelCode || undefined,
            specialRequests: i === 0 ? c.notes : undefined,
            source: BookingSource.ADMIN,
            bookingType: c.rooms > 1 ? BookingType.GROUP : BookingType.INDIVIDUAL,
            registrationStatus: RegistrationStatus.DRAFT,
            signatureStatus: SignatureStatus.NOT_COLLECTED,
          }],
          { session },
        );
        created.push(b);
      }

      let advance: any = null;
      if (c.advance.amount > 0) {
        advance = await receiveAdvance(
          {
            bookingId: String(created[0]._id),
            guestId: String(guestDoc._id),
            amount: c.advance.amount,
            method: method as any,
            paymentChannelId: channelId ? String(channelId) : undefined,
            referenceNumber: c.advance.reference,
            purpose: `Advance booking — ${created[0].bookingReference}${c.rooms > 1 ? ` (${c.rooms} rooms)` : ""}`,
            receivedBy: ctx.actorId,
            notes: c.notes,
          },
          { req: ctx.req, session },
        );
        await Booking.updateOne(
          { _id: created[0]._id },
          { $set: { paidAmount: c.advance.amount, paymentStatus: c.advance.amount >= pricing.roundedTotal - 0.01 ? PaymentStatus.PAID : PaymentStatus.PARTIAL } },
          { session },
        );
      }

      result = {
        groupId: String(groupId),
        primaryBookingId: String(created[0]._id),
        bookingNumber: created[0].bookingReference,
        bookings: created.map((b) => ({ id: String(b._id), reference: b.bookingReference })),
        rooms: c.rooms,
        categoryName: category.name,
        checkIn: c.checkIn,
        checkOut: c.checkOut,
        total: pricing.total,
        roundedTotal: pricing.roundedTotal,
        advance: advance ? { id: String(advance._id), number: advance.advanceNumber, amount: advance.amount, method } : null,
        balance: r2(pricing.roundedTotal - c.advance.amount),
        guest: found.created ? "new guest" : `existing guest (matched by ${found.matchedBy})`,
      };
      await BookingIdempotency.updateOne({ key }, { $set: { status: BookingIdempotencyStatus.SUCCEEDED, bookingId: created[0]._id, bookingReference: created[0].bookingReference, responseData: result } }, { session });
    });
  } catch (error: any) {
    await BookingIdempotency.deleteOne({ key }).catch(() => undefined); // nothing was saved: allow a corrected retry
    if (error instanceof BookingConflictError) throw new ReservationError("Those rooms were just taken by another booking. Check availability again.", 409);
    throw error;
  } finally {
    await session.endSession();
  }

  // After commit: audit trail, and a tariff below the room type's rate goes to Reception for verification.
  await createAuditLog({
    req: ctx.req,
    action: "advance_booking.created",
    resourceType: "Booking",
    resourceId: result.primaryBookingId,
    metadata: { bookingNumber: result.bookingNumber, rooms: c.rooms, category: category.name, checkIn: c.checkIn, checkOut: c.checkOut, total: pricing.total, advance: c.advance.amount, guestMatch: result.guest },
  }).catch(() => undefined);
  if (result.advance) {
    await createAuditLog({ req: ctx.req, action: "advance.received", resourceType: "AdvancePayment", resourceId: result.advance.id, metadata: { advanceNumber: result.advance.number, bookingId: result.primaryBookingId, amount: result.advance.amount, method } }).catch(() => undefined);
  }
  if (pricing.belowDefault) {
    try {
      const { queueForVerification } = await import("./reception-verification");
      await queueForVerification({
        type: VerificationType.TARIFF_BELOW_DEFAULT,
        subjectKey: `advanceBooking:${result.primaryBookingId}:tariff`,
        returnQueue: "FRONT_DESK",
        summary: `Advance booking tariff below default: ${category.name} ₹${pricing.ratePerNight} (default ₹${pricing.defaultRate}) × ${c.rooms} room(s)`,
        amount: r2((pricing.defaultRate - pricing.ratePerNight) * c.rooms * pricing.nights),
        bookingId: result.primaryBookingId,
        details: { rate: pricing.ratePerNight, defaultRate: pricing.defaultRate, rooms: c.rooms, nights: pricing.nights },
        req: ctx.req,
      });
    } catch { /* verification must never undo a saved reservation */ }
  }
  return result;
}

// ── Booking Confirmation document ───────────────────────────────────────────

/** Everything the printed "Booking Confirmation" shows, computed from the saved bookings and advances. */
export async function getReservationConfirmation(bookingId: string) {
  if (!mongoose.isValidObjectId(bookingId)) throw new ReservationError("Booking not found", 404);
  const first: any = await Booking.findById(bookingId).lean();
  if (!first) throw new ReservationError("Booking not found", 404);
  const all: any[] = first.groupId ? await Booking.find({ groupId: first.groupId }).sort({ bookingReference: 1 }).lean() : [first];
  const live = all.filter((b) => b.status !== BookingStatus.CANCELLED);
  const rows = live.length ? live : all;
  const primary = rows[0];
  const category: any = await RoomCategory.findById(primary.roomCategory).select("name").lean();
  const settings: any = (await HotelSettings.findOne().sort({ updatedAt: -1 }).lean()) ?? {};

  const sum = (k: string) => r2(rows.reduce((a, b) => a + (Number(b[k]) || 0), 0));
  const total = sum("totalAmount");
  const totalGst = sum("taxAmount");
  const cgst = sum("cgstAmount");
  const sgst = sum("sgstAmount");
  const taxable = r2(total - totalGst);
  const roundedTotal = Math.round(total);
  const nights = countNights(primary.checkInDate, primary.checkOutDate);

  const advances: any[] = await AdvancePayment.find({ booking: { $in: all.map((b) => b._id) } }).sort({ receivedAt: 1 }).lean();
  const advancePaid = r2(advances.reduce((a, x) => a + (Number(x.amount) || 0) - (Number(x.totalRefunded) || 0), 0));
  const adults = rows.reduce((a, b) => a + (Number(b.adults) || 0), 0);
  const children = rows.reduce((a, b) => a + (Number(b.children) || 0), 0);
  const guest = primary.guestDetails ?? {};

  return {
    hotel: {
      name: settings.hotelName || HOTEL.name,
      address: settings.address || hotelAddressOneLine(),
      phone: settings.phone || HOTEL.phones[0],
      email: settings.email || "",
      gstin: settings.gstNumber || HOTEL.gstin,
    },
    booking: {
      number: primary.bookingReference,
      rooms: rows.length,
      roomReferences: rows.map((b) => b.bookingReference),
      bookingDate: toBusinessDate(primary.createdAt ?? new Date()),
      arrivalDate: toBusinessDate(primary.checkInDate),
      departureDate: toBusinessDate(primary.checkOutDate),
      arrivalTime: primary.arrivalTime || settings.checkInTime || "12:00",
      departureTime: primary.departureTime || settings.checkOutTime || "11:00",
      nights,
      status: primary.status,
      cancelled: rows.every((b) => b.status === BookingStatus.CANCELLED),
    },
    customer: {
      name: `${guest.firstName ?? ""} ${guest.lastName && guest.lastName !== "." ? guest.lastName : ""}`.trim(),
      address: guest.address || "",
      phone: guest.phone || "",
      email: guest.email && !/@yes-?hotels\.local$/i.test(guest.email) ? guest.email : "",
      gstin: guest.gstin || "",
    },
    item: {
      description: `${category?.name ?? "Room"} - ${primary.mealPlan || "EP"}`,
      adults,
      children,
      rooms: rows.length,
      ratePerNight: primary.ratePerNight ?? 0,
      pricesIncludeTax: primary.pricesIncludeTax === true,
      sac: "996311",
      unitPrice: r2(taxable / Math.max(1, rows.length * nights)),
    },
    amounts: { taxable, cgst, sgst, totalGst, total, roundedTotal, roundOff: r2(roundedTotal - total), gstRate: taxable > 0 ? Math.round(((cgst + sgst) / taxable) * 1000) / 10 : 0 },
    advance: {
      paid: advancePaid,
      receipts: advances.map((x) => ({ number: x.advanceNumber, amount: x.amount, method: x.method, receivedAt: x.receivedAt, status: x.status })),
    },
    balance: r2(roundedTotal - advancePaid),
  };
}
