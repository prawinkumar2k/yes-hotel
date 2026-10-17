/**
 * Early departure: the guest leaves before the booked check-out date. Room charges that were posted
 * up front for nights that will not be stayed are credited back (REVERSAL lines that name the nights
 * they cover), with the GST on them; the booking's check-out date and totals follow, and the
 * room-type availability for those nights is released. Idempotent: nights already credited are
 * never credited twice.
 *
 * Nights stayed: from check-in up to (not including) today — at least one night.
 */
import mongoose from "mongoose";
import { Booking, BookingStatus } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType } from "../models/FolioLine";
import { addDays, toBusinessDate, todayBusinessDate } from "../../../shared/dates";
import { computeRoomTax, loadGstRules } from "./tax.service";
import { postCharge } from "./folio.service";
import { releaseInventoryDays } from "./booking-safety.service";
import { createAuditLog } from "./audit.service";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function nightsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

export async function applyEarlyDeparture(bookingId: string, opts: { req?: any; today?: string } = {}) {
  const booking: any = await Booking.findById(bookingId);
  if (!booking || booking.status !== BookingStatus.CHECKED_IN) return null;
  const folio: any = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN });
  if (!folio) return null;

  const today = opts.today ?? todayBusinessDate();
  const stayIn = toBusinessDate(booking.checkInDate);
  const bookedOut = toBusinessDate(booking.checkOutDate);
  const newOut = today > stayIn ? today : addDays(stayIn, 1);
  if (newOut >= bookedOut) return null; // not early

  const unused = new Set(nightsBetween(newOut, bookedOut));
  const lines: any[] = await FolioLine.find({ folio: folio._id }).lean();
  const reversals = lines.filter((l) => l.lineType === FolioLineType.REVERSAL);
  // Nights already credited by an earlier early-departure adjustment.
  const credited = new Set(reversals.filter((l) => l.coversNights?.length && String(l.description).startsWith("Early departure")).flatMap((l) => l.coversNights));
  const fullyVoided = new Set(reversals.filter((l) => !l.coversNights?.length && l.reversedLineId).map((l) => String(l.reversedLineId)));
  // Part-credits of a line for given nights (e.g. a room move to a cheaper room), per night.
  const reductionFor = (lineId: string, night: string) =>
    reversals
      .filter((r) => String(r.reversedLineId) === lineId && r.coversNights?.includes(night) && !String(r.description).startsWith("Early departure"))
      .reduce((t, r) => t + r.amount / r.coversNights.length, 0);
  const rate = Number(booking.ratePerNight) || 0;

  const credits: { line: any; nights: string[]; amount: number; perNight: number }[] = [];
  for (const l of lines) {
    if (l.lineType !== FolioLineType.ROOM_CHARGE || fullyVoided.has(String(l._id)) || !(l.amount > 0)) continue;
    let covers: string[] = l.coversNights?.length ? l.coversNights : [];
    if (!covers.length) {
      // A stay-total line posted at check-in: it covers as many nights as its amount buys at the rate.
      const n = rate > 0 ? Math.max(1, Math.round(l.amount / rate)) : nightsBetween(stayIn, bookedOut).length;
      covers = nightsBetween(stayIn, addDays(stayIn, n));
    }
    const perNight = l.amount / covers.length;
    const nights = covers.filter((d) => unused.has(d) && !credited.has(d));
    const amount = r2(nights.reduce((t, d) => t + Math.max(0, perNight - reductionFor(String(l._id), d)), 0));
    if (nights.length && amount > 0) credits.push({ line: l, nights, perNight, amount });
  }

  const roomCredit = r2(credits.reduce((t, c) => t + c.amount, 0));
  const actor = opts.req?.user?.id ? String(opts.req.user.id) : "SYSTEM";
  const nightsCredited = [...new Set(credits.flatMap((c) => c.nights))].sort();
  let taxCredit = { cgst: 0, sgst: 0 };

  if (roomCredit > 0) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const c of credits) {
          await postCharge(
            {
              folioId: String(folio._id),
              bookingId: String(booking._id),
              lineType: FolioLineType.REVERSAL,
              description: `Early departure — ${c.nights.length} unused night${c.nights.length > 1 ? "s" : ""} (${c.nights[0]}${c.nights.length > 1 ? ` to ${c.nights[c.nights.length - 1]}` : ""})`,
              amount: c.amount,
              date: new Date(),
              postedBy: actor,
              reversedLineId: String(c.line._id),
              coversNights: c.nights,
            } as any,
            { req: opts.req, session },
          );
        }
        // GST on the credited nights, at the same per-night value it was charged at.
        const perNight = roomCredit / nightsCredited.length;
        const tax = computeRoomTax(await loadGstRules(), { checkIn: nightsCredited[0], checkOut: addDays(nightsCredited[nightsCredited.length - 1], 1), nightlyValue: perNight });
        // Credited against a room-tariff GST line that has not been reversed yet (a line is reversed once).
        const reversedIds = new Set(reversals.map((r) => String(r.reversedLineId)));
        const roomTaxLine = (type: string) =>
          lines
            .filter((l) => l.lineType === type && l.amount > 0 && !reversedIds.has(String(l._id)) && !/KOT|Restaurant|POS|late check-out|early check-in|cancellation/i.test(String(l.description ?? "")))
            .sort((a, b) => b.amount - a.amount)[0];
        const cgstLine = roomTaxLine(FolioLineType.TAX_CGST);
        const sgstLine = roomTaxLine(FolioLineType.TAX_SGST);
        for (const [taxLine, amount, label] of [[cgstLine, tax.cgst, "CGST"], [sgstLine, tax.sgst, "SGST"]] as const) {
          if (!taxLine || !(amount > 0)) continue;
          await postCharge(
            {
              folioId: String(folio._id),
              bookingId: String(booking._id),
              lineType: FolioLineType.REVERSAL,
              description: `${label} on early departure credit`,
              amount: r2(amount),
              date: new Date(),
              postedBy: "SYSTEM_TAX",
              reversedLineId: String(taxLine._id),
              coversNights: nightsCredited,
            } as any,
            { req: opts.req, session },
          );
        }
        taxCredit = { cgst: cgstLine ? r2(tax.cgst) : 0, sgst: sgstLine ? r2(tax.sgst) : 0 };

        const totalTaxCredit = r2(taxCredit.cgst + taxCredit.sgst);
        await Booking.updateOne(
          { _id: booking._id },
          {
            $set: {
              totalAmount: r2(Math.max(0, (booking.totalAmount || 0) - roomCredit - totalTaxCredit)),
              taxAmount: r2(Math.max(0, (booking.taxAmount || 0) - totalTaxCredit)),
              cgstAmount: r2(Math.max(0, (booking.cgstAmount || 0) - taxCredit.cgst)),
              sgstAmount: r2(Math.max(0, (booking.sgstAmount || 0) - taxCredit.sgst)),
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  // The stay now ends today (or after the first night): dates and room-type availability follow.
  const originalOut = booking.checkOutDate;
  await Booking.updateOne({ _id: booking._id }, { $set: { checkOutDate: new Date(`${newOut}T00:00:00+05:30`) } });
  const categoryId = String(booking.roomCategory?._id ?? booking.roomCategory);
  await releaseInventoryDays({ roomCategoryId: categoryId, checkInDate: new Date(`${newOut}T00:00:00+05:30`), checkOutDate: originalOut }).catch(() => undefined);

  await createAuditLog({
    req: opts.req,
    action: "booking.early_departure",
    resourceType: "Booking",
    resourceId: String(booking._id),
    metadata: { bookingReference: booking.bookingReference, bookedCheckOut: bookedOut, newCheckOut: newOut, nightsCredited, roomCredit, taxCredit },
  });
  return { newCheckOut: newOut, nightsCredited, roomCredit, taxCredit };
}
