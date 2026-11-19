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
import { stayExtraRates } from "./tariff.service";
import { splitAdvanceAcrossRooms } from "./advance-split";
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

export type LineInput = {
  roomCategoryId?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  mealPlan?: string;
  extraPersonsNoBed?: number;
  extraPersonsWithBed?: number;
  extraChildrenNoBed?: number;
  extraChildrenWithBed?: number;
  /** Per room per night, typed by the desk (GST inside when "prices include GST" is on). */
  ratePerNight?: number;
};

export type ReservationInput = {
  /** Several room types in one booking. When absent, the single room type given below is used. */
  lines?: LineInput[];
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
  /** Extra beds / persons / children, as in a walk-in: charged per night at the hotel's extra rates, on the first room. */
  extraPersonsNoBed?: number;
  extraPersonsWithBed?: number;
  extraChildrenNoBed?: number;
  extraChildrenWithBed?: number;
  /** Per room per night, as the hotel prices (GST inside when "prices include GST" is on). */
  ratePerNight?: number;
  advance?: { amount?: number; paymentChannelId?: string; method?: string; reference?: string };
  notes?: string;
  clientRequestId?: string;
};

type CleanLine = {
  roomCategoryId: string;
  rooms: number;
  adults: number;
  children: number;
  mealPlan: string;
  ratePerNight?: number;
  extras: { personsNoBed: number; personsWithBed: number; childrenNoBed: number; childrenWithBed: number };
};

type Clean = {
  guest: { name: string; phone: string; email: string; address: string; gstin: string };
  /** One entry per room type asked for (a booking may mix, e.g. 3 Deluxe + 2 Executive). */
  lines: CleanLine[];
  // Totals over all lines, and the first line's values (kept for single-room-type callers).
  rooms: number;
  adults: number;
  children: number;
  roomCategoryId: string;
  mealPlan: string;
  ratePerNight?: number;
  extras: CleanLine["extras"];
  checkIn: string;
  checkOut: string;
  arrivalTime?: string;
  departureTime?: string;
  advance: { amount: number; paymentChannelId?: string; method?: string; reference?: string };
  notes?: string;
};

function cleanLine(raw: LineInput, label: string): CleanLine {
  if (!raw.roomCategoryId || !mongoose.isValidObjectId(raw.roomCategoryId)) throw new ReservationError(`${label}Choose the room type`);
  const rooms = Number(raw.rooms);
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > MAX_ROOMS) throw new ReservationError(`${label}Rooms must be between 1 and ${MAX_ROOMS}`);
  const adults = Number(raw.adults);
  const children = Number(raw.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1) throw new ReservationError(`${label}Enter the number of adults`);
  if (!Number.isInteger(children) || children < 0) throw new ReservationError(`${label}Children must be 0 or more`);
  if (adults < rooms) throw new ReservationError(`${label}Every room needs at least one adult — reduce the rooms or add adults`);
  const mealPlan = String(raw.mealPlan || "EP").toUpperCase();
  if (!Object.values(MealPlan).includes(mealPlan as MealPlan)) throw new ReservationError(`${label}Choose a valid meal plan`);
  const extraCount = (name: string, v: unknown) => {
    const n = Number(v ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > 20) throw new ReservationError(`${label}${name} must be a whole number from 0 to 20`);
    return n;
  };
  const extras = {
    personsNoBed: extraCount("Extra persons (no bed)", raw.extraPersonsNoBed),
    personsWithBed: extraCount("Extra beds", raw.extraPersonsWithBed),
    childrenNoBed: extraCount("Children (no bed)", raw.extraChildrenNoBed),
    childrenWithBed: extraCount("Children (with bed)", raw.extraChildrenWithBed),
  };
  let ratePerNight: number | undefined;
  if (raw.ratePerNight !== undefined && raw.ratePerNight !== null && String(raw.ratePerNight) !== "") {
    ratePerNight = r2(Number(raw.ratePerNight));
    if (!(ratePerNight > 0)) throw new ReservationError(`${label}Enter a rate per night greater than zero`);
  }
  return { roomCategoryId: String(raw.roomCategoryId), rooms, adults, children, mealPlan, ratePerNight, extras };
}

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

  // Room lines: several room types in one booking, or (older callers) the single type given at the top level.
  const rawLines: LineInput[] = Array.isArray(input.lines) && input.lines.length ? input.lines : [input];
  if (rawLines.length > 20) throw new ReservationError("A booking can have at most 20 room lines");
  const lines = rawLines.map((l, i) => cleanLine(l, rawLines.length > 1 ? `Room line ${i + 1}: ` : ""));
  const rooms = lines.reduce((t, l) => t + l.rooms, 0);
  if (rooms > MAX_ROOMS) throw new ReservationError(`A booking can have at most ${MAX_ROOMS} rooms`);

  const checkIn = String(input.checkIn ?? "");
  const checkOut = String(input.checkOut ?? "");
  if (!YMD.test(checkIn) || !YMD.test(checkOut) || Number.isNaN(new Date(checkIn).getTime()) || Number.isNaN(new Date(checkOut).getTime())) throw new ReservationError("Choose the check-in and check-out dates");
  if (checkIn < todayBusinessDate()) throw new ReservationError("Check-in date cannot be in the past");
  if (checkOut <= checkIn) throw new ReservationError("Check-out must be after check-in");
  if (countNights(new Date(checkIn), new Date(checkOut)) > MAX_NIGHTS) throw new ReservationError(`A reservation can be at most ${MAX_NIGHTS} nights`);
  for (const [label, t] of [["Check-in time", input.arrivalTime], ["Check-out time", input.departureTime]] as const) {
    if (t && !HHMM.test(String(t))) throw new ReservationError(`${label} must look like 14:00`);
  }
  const amount = r2(Number(input.advance?.amount ?? 0));
  if (!(amount >= 0)) throw new ReservationError("Enter a valid advance amount");

  return {
    guest: { name, phone, email, address: String(g.address ?? "").trim(), gstin },
    lines,
    rooms,
    adults: lines.reduce((t, l) => t + l.adults, 0),
    children: lines.reduce((t, l) => t + l.children, 0),
    roomCategoryId: lines[0].roomCategoryId,
    mealPlan: lines[0].mealPlan,
    ratePerNight: lines[0].ratePerNight,
    extras: lines[0].extras,
    checkIn,
    checkOut,
    arrivalTime: input.arrivalTime ? String(input.arrivalTime) : undefined,
    departureTime: input.departureTime ? String(input.departureTime) : undefined,
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

async function price(c: Clean, categories: Map<string, any>) {
  const settings: any = (await HotelSettings.findOne().sort({ updatedAt: -1 }).select("mealPlanRates checkInTime checkOutTime taxInclusiveRates extraPersonRate extraBedRate childRateNoBed childRateWithBed").lean()) ?? {};
  const { rules, inclusive } = await loadRoomPricing();
  const ci = new Date(c.checkIn);
  const co = new Date(c.checkOut);
  const nights = countNights(ci, co);

  type PerRoom = { lineIndex: number; categoryId: string; subtotal: number; taxable: number; cgst: number; sgst: number; tax: number; total: number; advanceShare: number };
  const perRoom: PerRoom[] = [];
  const lines = c.lines.map((ln, lineIndex) => {
    const category = categories.get(ln.roomCategoryId);
    const defaultRate = Number(category.basePrice) || 0;
    const rate = ln.ratePerNight ?? defaultRate;
    if (!(rate > 0)) throw new ReservationError(`${category.name} has no rate set — enter the rate per night`);
    // The meal plan (EP/CP/MAP/AP) is only recorded; meal charges are added by hand, so nothing is charged for it here.
    const mealRate = Number(settings.mealPlanRates?.[ln.mealPlan] ?? DEFAULT_MEAL_RATES[ln.mealPlan] ?? 0);
    // Extra beds / persons / children (same rates and rule as a walk-in), charged per night and put on this line's first room.
    const x = stayExtraRates(settings, undefined, category);
    const extrasPerNight = ln.extras.personsNoBed * x.extraPersonRate + ln.extras.personsWithBed * x.extraBedRate + ln.extras.childrenNoBed * x.childRateNoBed + ln.extras.childrenWithBed * x.childRateWithBed;
    const extrasTotal = r2(extrasPerNight * nights);

    let lineTotal = 0;
    for (let i = 0; i < ln.rooms; i++) {
      const subtotal = r2(rate * nights + (i === 0 ? extrasTotal : 0));
      const t = computeRoomTax(rules, { checkIn: ci, checkOut: co, nightlyValue: subtotal / nights, inclusive });
      const row = { lineIndex, categoryId: ln.roomCategoryId, subtotal, taxable: r2(t.taxable), cgst: r2(t.cgst), sgst: r2(t.sgst), tax: r2(t.tax), total: r2(t.total), advanceShare: 0 };
      perRoom.push(row);
      lineTotal += row.total;
    }
    const capacityPerRoom = Number(category.capacity?.adults) || 0;
    const extraPersons = capacityPerRoom > 0 ? Math.max(0, ln.adults - capacityPerRoom * ln.rooms) : 0;
    return {
      index: lineIndex,
      categoryId: ln.roomCategoryId,
      categoryName: category.name as string,
      rooms: ln.rooms,
      adults: ln.adults,
      children: ln.children,
      mealPlan: ln.mealPlan,
      mealPlanRate: mealRate,
      ratePerNight: rate,
      defaultRate,
      belowDefault: rate < defaultRate,
      extras: { ...ln.extras, rates: x, perNight: r2(extrasPerNight), total: extrasTotal },
      total: r2(lineTotal),
      capacityWarning: extraPersons > 0 ? `${category.name}: ${ln.adults} adults is more than ${capacityPerRoom} per room for ${ln.rooms} room(s): ${extraPersons} extra person(s) — extra-person charges are added at check-in.` : undefined,
    };
  });

  const sum = (k: "taxable" | "cgst" | "sgst" | "tax" | "total") => r2(perRoom.reduce((a, r) => a + r[k], 0));
  const total = sum("total");
  const roundedTotal = Math.round(total);

  // The advance is shared across the rooms in proportion to what each room costs (exact to the paisa, never above a room's total).
  const shares = splitAdvanceAcrossRooms(Math.min(c.advance.amount, roundedTotal), perRoom.map((r) => r.total));
  perRoom.forEach((r, i) => { r.advanceShare = shares[i] ?? 0; });

  const first = lines[0];
  const firstRoom = perRoom[0];
  return {
    nights,
    rooms: perRoom.length,
    lines,
    ratePerNight: first.ratePerNight,
    defaultRate: first.defaultRate,
    belowDefault: lines.some((l) => l.belowDefault),
    pricesIncludeTax: inclusive,
    mealPlan: first.mealPlan,
    mealPlanRate: first.mealPlanRate,
    mealPlanTotal: 0,
    extras: { ...first.extras, perNight: r2(lines.reduce((t, l) => t + l.extras.perNight, 0)), total: r2(lines.reduce((t, l) => t + l.extras.total, 0)) },
    perRoom,
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    totalGst: sum("tax"),
    total,
    roundedTotal,
    roundOff: r2(roundedTotal - total),
    gstRate: firstRoom ? (firstRoom.taxable > 0 ? Math.round(((firstRoom.cgst + firstRoom.sgst) / firstRoom.taxable) * 1000) / 10 : 0) : 0,
    arrivalTime: c.arrivalTime ?? settings.checkInTime ?? "12:00",
    departureTime: c.departureTime ?? settings.checkOutTime ?? "11:00",
    capacityWarning: lines.map((l) => l.capacityWarning).filter(Boolean).join(" ") || undefined,
  };
}

/** Loads every room type used by the lines (each must exist and be active). */
async function loadCategories(c: Clean): Promise<Map<string, any>> {
  const ids = [...new Set(c.lines.map((l) => l.roomCategoryId))];
  const docs: any[] = await RoomCategory.find({ _id: { $in: ids } }).lean();
  const map = new Map<string, any>(docs.map((d) => [String(d._id), d]));
  for (const id of ids) {
    const cat = map.get(id);
    if (!cat || cat.isActive === false) throw new ReservationError("That room type is not available", 404);
  }
  return map;
}

/** Rooms wanted per room type, adding up lines that use the same type. */
function roomsPerCategory(c: Clean): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of c.lines) m.set(l.roomCategoryId, (m.get(l.roomCategoryId) ?? 0) + l.rooms);
  return m;
}

/** Live quote for the form: server-side price, GST, the advance share per room and how many rooms are free. Changes nothing. */
export async function quoteReservation(input: ReservationInput) {
  const c = clean({ ...input, advance: { ...input.advance, amount: input.advance?.amount ?? 0 } });
  const categories = await loadCategories(c);
  const pricing = await price(c, categories);
  const wanted = roomsPerCategory(c);
  const stock = new Map<string, { capacity: number; available: number }>();
  for (const id of wanted.keys()) stock.set(id, await freeRooms(id, new Date(c.checkIn), new Date(c.checkOut)));
  const lines = pricing.lines.map((l) => {
    const s = stock.get(l.categoryId)!;
    return { ...l, capacity: s.capacity, availableRooms: s.available, wantedOfType: wanted.get(l.categoryId)!, canBook: s.available >= wanted.get(l.categoryId)! };
  });
  const firstStock = stock.get(c.lines[0].roomCategoryId)!;
  return {
    ...pricing,
    lines,
    categoryName: [...new Set(lines.map((l) => l.categoryName))].join(", "),
    capacity: firstStock.capacity,
    availableRooms: lines.length === 1 ? firstStock.available : Math.min(...lines.map((l) => l.availableRooms)),
    canBook: lines.every((l) => l.canBook),
  };
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

  const categories = await loadCategories(c);
  const category: any = categories.get(c.roomCategoryId);
  const categoryNames = [...new Set(c.lines.map((l) => categories.get(l.roomCategoryId).name as string))].join(", ");
  const pricing = await price(c, categories);
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
  for (const [catId, wantedRooms] of roomsPerCategory(c)) {
    const stock = await freeRooms(catId, ci, co);
    if (stock.available < wantedRooms) {
      const nm = categories.get(catId).name;
      throw new ReservationError(`Only ${stock.available} ${nm} room${stock.available === 1 ? " is" : "s are"} free for those dates (you asked for ${wantedRooms}). Choose other dates or another room type.`, 409);
    }
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

  // One slot per room, in line order: which room type line it belongs to and its place within that line.
  const slots = c.lines.flatMap((ln, li) => Array.from({ length: ln.rooms }, (_, k) => ({ ln, li, k })));
  // Guests per room within a line: adults and children spread evenly, the remainder on the line's first rooms.
  const spread = (total: number, k: number, rooms: number) => Math.floor(total / rooms) + (k < total % rooms ? 1 : 0);

  let result: any;
  const session = await mongoose.startSession();
  try {
    const wanted = roomsPerCategory(c);
    const capacities = new Map<string, number>();
    for (const catId of wanted.keys()) capacities.set(catId, await prepareInventoryDays(catId, ci, co)); // creates the day records (outside the transaction)
    await session.withTransaction(async () => {
      for (const [catId, count] of wanted) await claimInventoryDays({ roomCategoryId: catId, checkInDate: ci, checkOutDate: co, capacity: capacities.get(catId)!, count, session });

      const created: any[] = [];
      for (let i = 0; i < slots.length; i++) {
        const { ln, li, k } = slots[i];
        const lp = pricing.lines[li];
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
            roomCategory: new mongoose.Types.ObjectId(ln.roomCategoryId),
            checkInDate: ci,
            checkOutDate: co,
            stayType: "NIGHTLY",
            arrivalTime: pricing.arrivalTime,
            departureTime: pricing.departureTime,
            mealPlan: ln.mealPlan as MealPlan,
            ...(k === 0 ? { extraPersonsNoBed: ln.extras.personsNoBed, extraPersonsWithBed: ln.extras.personsWithBed, extraChildrenNoBed: ln.extras.childrenNoBed, extraChildrenWithBed: ln.extras.childrenWithBed } : {}),
            ratePerNight: lp.ratePerNight,
            adults: spread(ln.adults, k, ln.rooms),
            children: spread(ln.children, k, ln.rooms),
            status: BookingStatus.CONFIRMED,
            totalAmount: pr.total,
            taxAmount: pr.tax,
            cgstAmount: pr.cgst,
            sgstAmount: pr.sgst,
            discountAmount: 0,
            pricesIncludeTax: pricing.pricesIncludeTax,
            paymentStatus: PaymentStatus.UNPAID,
            paidAmount: 0,
            // This room's share of the advance (the advance is split across the rooms by what each costs).
            advanceShare: c.advance.amount > 0 ? pr.advanceShare : undefined,
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
        categoryName: categoryNames,
        lines: pricing.lines.map((l) => ({ category: l.categoryName, rooms: l.rooms, ratePerNight: l.ratePerNight, total: l.total })),
        // The advance shared across the rooms (each room's bill draws at most its own share).
        advanceSplit: created.map((b, i) => ({ reference: b.bookingReference, category: pricing.lines[slots[i].li].categoryName, roomTotal: pricing.perRoom[i].total, share: pricing.perRoom[i].advanceShare })),
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
    metadata: { bookingNumber: result.bookingNumber, rooms: c.rooms, category: categoryNames, checkIn: c.checkIn, checkOut: c.checkOut, total: pricing.total, advance: c.advance.amount, guestMatch: result.guest },
  }).catch(() => undefined);
  if (result.advance) {
    await createAuditLog({ req: ctx.req, action: "advance.received", resourceType: "AdvancePayment", resourceId: result.advance.id, metadata: { advanceNumber: result.advance.number, bookingId: result.primaryBookingId, amount: result.advance.amount, method } }).catch(() => undefined);
  }
  for (const lp of pricing.lines.filter((l) => l.belowDefault)) {
    try {
      const { queueForVerification } = await import("./reception-verification");
      await queueForVerification({
        type: VerificationType.TARIFF_BELOW_DEFAULT,
        subjectKey: `advanceBooking:${result.primaryBookingId}:tariff:${lp.index}`,
        returnQueue: "FRONT_DESK",
        summary: `Advance booking tariff below default: ${lp.categoryName} ₹${lp.ratePerNight} (default ₹${lp.defaultRate}) × ${lp.rooms} room(s)`,
        amount: r2((lp.defaultRate - lp.ratePerNight) * lp.rooms * pricing.nights),
        bookingId: result.primaryBookingId,
        details: { rate: lp.ratePerNight, defaultRate: lp.defaultRate, rooms: lp.rooms, nights: pricing.nights },
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
  const cats: any[] = await RoomCategory.find({ _id: { $in: [...new Set(rows.map((b) => String(b.roomCategory)))] } }).select("name").lean();
  const catName = new Map<string, string>(cats.map((x) => [String(x._id), x.name]));
  // Rooms per room type, e.g. "Deluxe Room × 3, Executive Room × 2".
  const perType = new Map<string, { name: string; rooms: number; rate: number }>();
  for (const b of rows) {
    const id = String(b.roomCategory);
    const cur = perType.get(id) ?? { name: catName.get(id) ?? "Room", rooms: 0, rate: Number(b.ratePerNight) || 0 };
    cur.rooms += 1;
    perType.set(id, cur);
  }
  const category: any = { name: [...perType.values()].map((t) => (perType.size > 1 ? `${t.name} × ${t.rooms}` : t.name)).join(", ") };
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
    items: [...perType.values()].map((t) => ({ description: t.name, rooms: t.rooms, ratePerNight: t.rate })),
    amounts: { taxable, cgst, sgst, totalGst, total, roundedTotal, roundOff: r2(roundedTotal - total), gstRate: taxable > 0 ? Math.round(((cgst + sgst) / taxable) * 1000) / 10 : 0 },
    advance: {
      paid: advancePaid,
      receipts: advances.map((x) => ({ number: x.advanceNumber, amount: x.amount, method: x.method, receivedAt: x.receivedAt, status: x.status })),
    },
    balance: r2(roundedTotal - advancePaid),
  };
}
