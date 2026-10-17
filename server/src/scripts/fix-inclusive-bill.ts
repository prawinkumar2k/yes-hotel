/**
 * One-time correction (approved by the hotel owner) of a bill posted before "room prices include
 * GST" was in place: the room was billed at the full price with no CGST / SGST lines. The total
 * the guest paid stays exactly the same; the bill is split into the room value and its GST:
 *   ₹1,510 room → ₹1,438.10 room + CGST ₹35.95 + SGST ₹35.95 = ₹1,510.
 * The original line is reversed (kept for the audit trail), the invoice number is unchanged.
 * A settled bill accepts no postings through the app, so the lines are written here directly.
 * Runs once per --run-id; only the bookings named in --refs; skips a bill that already has GST.
 *
 *   npx tsx server/src/scripts/fix-inclusive-bill.ts --run-id=<id> --refs=WALKIN-1017-001           dry run
 *   npx tsx server/src/scripts/fix-inclusive-bill.ts --run-id=<id> --refs=WALKIN-1017-001 --apply   apply
 */
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ROOM_TAX = (l: any) => !/KOT|Restaurant|POS|late check-out|early check-in|cancellation/i.test(String(l.description ?? ""));

export async function fixInclusiveBill(ref: string, opts: { apply: boolean; runId: string }) {
  const { Booking } = await import("../models/Booking");
  const { Folio } = await import("../models/Folio");
  const { FolioLine, FolioLineType, LINE_TYPE_DIRECTION } = await import("../models/FolioLine");
  const { computeRoomTax, loadGstRules } = await import("../services/tax.service");
  const { computeFolioTotals } = await import("../services/folio-ledger");
  const { nights: countNights, addDays, toBusinessDate } = await import("../../../shared/dates");

  const booking: any = await Booking.findOne({ bookingReference: ref });
  if (!booking) return { ref, result: "not found" };
  const folio: any = await Folio.findOne({ booking: booking._id });
  if (!folio) return { ref, result: "no bill" };
  const lines: any[] = await FolioLine.find({ folio: folio._id }).lean();
  const reversed = new Set(lines.filter((l) => l.reversedLineId).map((l) => String(l.reversedLineId)));
  const roomTax = lines.filter((l) => (l.lineType === FolioLineType.TAX_CGST || l.lineType === FolioLineType.TAX_SGST) && ROOM_TAX(l) && !reversed.has(String(l._id)));
  if (roomTax.length) return { ref, result: "already has GST — nothing to do" };
  const roomLines = lines.filter((l) => l.lineType === FolioLineType.ROOM_CHARGE && !reversed.has(String(l._id)) && l.amount > 0);
  if (!roomLines.length) return { ref, result: "no room charge" };

  const gross = r2(roomLines.reduce((t, l) => t + l.amount, 0));
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const n = Math.max(1, countNights(checkIn, checkOut));
  const tax = computeRoomTax(await loadGstRules(), { checkIn, checkOut, nightlyValue: gross / n, inclusive: true });
  const before = computeFolioTotals(lines as any);
  const plan = { ref, invoice: folio.invoiceNumber, folioStatus: folio.status, roomBilled: gross, nights: n, room: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, total: r2(tax.taxable + tax.tax), balanceBefore: before.balance };
  if (!opts.apply) return { ...plan, result: "dry run" };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const at = roomLines[0].date ?? new Date();
      const common = { folio: folio._id, booking: booking._id, date: at, postedAt: new Date(), postedBy: "SYSTEM_CORRECTION", quantity: 1, notes: `Room price includes GST — bill corrected (${opts.runId})` };
      const docs: any[] = roomLines.map((l) => ({ ...common, lineType: FolioLineType.REVERSAL, direction: LINE_TYPE_DIRECTION[FolioLineType.REVERSAL], description: `Reversal of: ${l.description} (price includes GST)`, amount: l.amount, reversedLineId: l._id }));
      const nightsList = Array.from({ length: n }, (_, i) => addDays(toBusinessDate(checkIn), i));
      const pct = (tax.lines[0]?.rate ?? 0) / 2;
      docs.push({ ...common, lineType: FolioLineType.ROOM_CHARGE, direction: LINE_TYPE_DIRECTION[FolioLineType.ROOM_CHARGE], description: `Room Tariff (${n} night${n > 1 ? "s" : ""} @ ₹${r2(gross / n).toLocaleString("en-IN")} incl. GST)`, amount: tax.taxable, coversNights: nightsList });
      docs.push({ ...common, lineType: FolioLineType.TAX_CGST, direction: LINE_TYPE_DIRECTION[FolioLineType.TAX_CGST], description: `CGST (${pct}%) on Room Tariff`, amount: tax.cgst });
      docs.push({ ...common, lineType: FolioLineType.TAX_SGST, direction: LINE_TYPE_DIRECTION[FolioLineType.TAX_SGST], description: `SGST (${pct}%) on Room Tariff`, amount: tax.sgst });
      await FolioLine.insertMany(docs, { session });
      const after = computeFolioTotals((await FolioLine.find({ folio: folio._id }).session(session).lean()) as any);
      if (Math.abs(after.balance - before.balance) > 0.05) throw new Error(`Balance would change (${before.balance} → ${after.balance}); nothing written`);
      await Folio.updateOne({ _id: folio._id }, { $set: { totalCharges: after.totalCharges, totalTax: after.totalTax, cgst: after.cgst, sgst: after.sgst, totalDiscounts: after.totalDiscounts, balance: after.balance } }, { session });
      await Booking.updateOne({ _id: booking._id }, { $set: { pricesIncludeTax: true, totalAmount: r2(tax.taxable + tax.tax), taxAmount: tax.tax, cgstAmount: tax.cgst, sgstAmount: tax.sgst } }, { session });
      await mongoose.connection.db!.collection("auditlogs").insertOne({ action: "folio.gst_inclusive_correction", resourceType: "Folio", resourceId: String(folio._id), metadata: { ...plan, runId: opts.runId }, createdAt: new Date() }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { ...plan, result: "corrected" };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  const runId = String(args["run-id"] || "");
  const refs = String(args.refs || "").split(",").map((s) => s.trim()).filter(Boolean);
  const apply = "apply" in args;
  if (!/^[a-z0-9-]{6,60}$/.test(runId) || !refs.length) throw new Error("--run-id=<id> and --refs=<booking refs> are required");
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const done = await db.collection("migrations").findOne({ _id: `fix-inclusive-bill:${runId}` as any });
  if (done) {
    console.log(`Already ran (${runId}) — nothing to do.`);
    return;
  }
  console.log(`Database ${db.databaseName} — ${apply ? "APPLY" : "DRY RUN"}`);
  const out = [];
  for (const ref of refs) out.push(await fixInclusiveBill(ref, { apply, runId }));
  console.table(out);
  if (apply) await db.collection("migrations").insertOne({ _id: `fix-inclusive-bill:${runId}` as any, at: new Date(), out });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .then(() => mongoose.disconnect())
    .catch(async (e) => {
      console.error(e);
      await mongoose.disconnect();
      process.exit(1);
    });
}
