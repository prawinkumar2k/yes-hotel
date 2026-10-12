// READ-ONLY report: folio credit lines that have no backing financial record.
//
//  A. "Advance Payment Received" lines (ADVANCE_ADJUSTMENT) with neither a valid
//     advancePaymentId nor a valid paymentId: fabricated by the old folio-read seeding.
//  B. PAYMENT lines with no matching Payment document.
//
// Writes docs/repair/folio-unbacked-credits.md. Changes nothing.
//   node scripts/repair/folio-unbacked-credits-report.mjs
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const ist = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "");

const paymentIds = new Set((await db.collection("payments").find({}, { projection: { _id: 1 } }).toArray()).map((p) => String(p._id)));
const advanceIds = new Set((await db.collection("advancepayments").find({}, { projection: { _id: 1 } }).toArray()).map((a) => String(a._id)));
const backed = (l) => (l.paymentId && paymentIds.has(String(l.paymentId))) || (l.advancePaymentId && advanceIds.has(String(l.advancePaymentId)));

const lines = await db.collection("foliolines").find({ direction: "CREDIT" }).toArray();
const bookings = new Map((await db.collection("bookings").find({}).toArray()).map((b) => [String(b._id), b]));
const folios = new Map((await db.collection("folios").find({}).toArray()).map((f) => [String(f._id), f]));
const paymentsByBooking = new Map();
for (const p of await db.collection("payments").find({}).toArray()) {
  const k = String(p.booking);
  paymentsByBooking.set(k, (paymentsByBooking.get(k) || 0) + (p.amount || 0) - (p.refundedAmount || 0));
}

const fabricated = lines.filter((l) => l.lineType === "ADVANCE_ADJUSTMENT" && /^Advance Payment Received/.test(l.description || "") && !backed(l));
const unbackedPayments = lines.filter((l) => l.lineType === "PAYMENT" && !(l.paymentId && paymentIds.has(String(l.paymentId))));

function groupByBooking(rows) {
  const g = new Map();
  for (const l of rows) {
    const k = String(l.booking);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(l);
  }
  return [...g.entries()].map(([bookingId, ls]) => {
    const b = bookings.get(bookingId) || {};
    const f = folios.get(String(ls[0].folio)) || {};
    const total = ls.reduce((s, l) => s + (l.amount || 0), 0);
    return {
      ref: b.bookingReference || bookingId,
      status: b.status || "?",
      folioStatus: f.status || "?",
      count: ls.length,
      total,
      balance: f.balance ?? 0,
      balanceWithout: (f.balance ?? 0) + total,
      paidAmount: b.paidAmount || 0,
      realPayments: paymentsByBooking.get(bookingId) || 0,
      created: ls.map((l) => ist(l.createdAt)).sort()[0],
      lines: ls,
    };
  }).sort((a, b) => b.total - a.total);
}

const A = groupByBooking(fabricated);
const B = groupByBooking(unbackedPayments);
const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);

const out = [];
out.push("# Folio credit lines without a backing record (dry-run report)", "");
out.push(`Generated ${ist(new Date())} IST from \`${db.databaseName}\`. **Read-only: nothing was changed.**`, "");
out.push("## A. Fabricated “Advance Payment Received” lines", "");
out.push("ADVANCE_ADJUSTMENT credit lines with no valid `advancePaymentId` and no valid `paymentId`. They were created by the old `GET /api/folios/booking/:id` seeding from `booking.paidAmount`.", "");
out.push(`**${fabricated.length} lines on ${A.length} bookings, ${inr(sum(A, "total"))} of credit with no record behind it.**`, "");
out.push("“Balance if reversed” is the folio balance after a void entry cancels these credits. “Real payments” is the net of Payment documents for the booking: if it is also non-zero, the fabricated line double-counts money that was actually received.", "");
out.push("| Booking | Booking status | Folio | Lines | Fabricated credit | Folio balance now | Balance if reversed | booking.paidAmount | Real payments (net) | First created (IST) |");
out.push("|---|---|---|---|---|---|---|---|---|---|");
for (const r of A) out.push(`| ${r.ref} | ${r.status} | ${r.folioStatus} | ${r.count} | ${inr(r.total)} | ${inr(r.balance)} | ${inr(r.balanceWithout)} | ${inr(r.paidAmount)} | ${inr(r.realPayments)} | ${r.created} |`);
out.push(`| **Total** | | | **${fabricated.length}** | **${inr(sum(A, "total"))}** | ${inr(sum(A, "balance"))} | ${inr(sum(A, "balanceWithout"))} | | ${inr(sum(A, "realPayments"))} | |`, "");
const settledHit = A.filter((r) => ["SETTLED", "FINALIZED", "CLOSED"].includes(r.folioStatus));
out.push(`Folios already settled/finalized among these: ${settledHit.length ? settledHit.map((r) => r.ref).join(", ") : "none"}.`, "");

out.push("## B. PAYMENT lines with no Payment document", "");
out.push("Each must get a Payment record (created in the same transaction going forward). These are listed for repair in the folio step.", "");
out.push(`**${unbackedPayments.length} lines on ${B.length} bookings, ${inr(sum(B, "total"))}.**`, "");
out.push("| Booking | Booking status | Folio | Posted (IST) | Amount | Description | postedBy |");
out.push("|---|---|---|---|---|---|---|");
for (const r of B) for (const l of r.lines) out.push(`| ${r.ref} | ${r.status} | ${r.folioStatus} | ${ist(l.createdAt)} | ${inr(l.amount)} | ${l.description} | ${l.postedBy} |`);
out.push("");

const other = lines.filter((l) => !["PAYMENT", "ADVANCE_ADJUSTMENT"].includes(l.lineType));
const byType = {};
for (const l of other) byType[l.lineType] = (byType[l.lineType] || 0) + 1;
out.push("## C. Other credit lines (for context, not repaired here)", "");
out.push(Object.entries(byType).map(([t, n]) => `- ${t}: ${n}`).join("\n") || "- none", "");
const backedAdv = lines.filter((l) => l.lineType === "ADVANCE_ADJUSTMENT" && backed(l)).length;
const otherAdv = lines.filter((l) => l.lineType === "ADVANCE_ADJUSTMENT" && !backed(l) && !/^Advance Payment Received/.test(l.description || ""));
out.push(`- ADVANCE_ADJUSTMENT lines with a valid record: ${backedAdv}`);
out.push(`- ADVANCE_ADJUSTMENT lines without a record and not matching “Advance Payment Received”: ${otherAdv.length}${otherAdv.length ? " → " + otherAdv.map((l) => `${bookings.get(String(l.booking))?.bookingReference}: ${l.description} ${inr(l.amount)}`).join("; ") : ""}`);

fs.mkdirSync("docs/repair", { recursive: true });
fs.writeFileSync("docs/repair/folio-unbacked-credits.md", out.join("\n") + "\n");
console.log(out.slice(0, 8).join("\n"));
console.log(`\nA: ${fabricated.length} lines / ${A.length} bookings / ${inr(sum(A, "total"))}`);
console.log(`B: ${unbackedPayments.length} lines / ${B.length} bookings / ${inr(sum(B, "total"))}`);
await mongoose.disconnect();
