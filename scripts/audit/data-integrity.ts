// READ-ONLY data integrity report. Writes docs/consistency/data-integrity.md. Changes nothing.
//   npx tsx scripts/audit/data-integrity.ts
//
// Checks: booking chronology (made after the stay began), OTA bookings without commission
// terms, and stored OTA settlement figures that disagree with ota.service.
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { computeOtaSettlement } from "../../server/src/services/ota.service";
import { toBusinessDate } from "../../shared/dates";

await mongoose.connect(process.env.MONGODB_URI!);
const db = mongoose.connection.db!;
const bookings = await db.collection("bookings").find({}).toArray();

const madeAfterStart = bookings.filter((b) => {
  if (!b.createdAt || !b.checkInDate) return false;
  // A walk-in is booked on its arrival day; anything else must be booked before check-in.
  const madeDay = toBusinessDate(b.createdAt);
  const inDay = toBusinessDate(b.checkInDate);
  return b.source === "WALK_IN" ? madeDay > inDay : +new Date(b.createdAt) > +new Date(b.checkInDate);
});
const madeAfterEnd = madeAfterStart.filter((b) => +new Date(b.createdAt) > +new Date(b.checkOutDate));
const ota = bookings.filter((b) => b.source === "OTA");
const otaNoTerms = ota.filter((b) => b.otaCommissionPercent == null || !b.otaPaymentModel);
const otaDrift = ota
  .filter((b) => b.otaCommissionPercent != null && b.otaPaymentModel)
  .filter((b) => {
    const s = computeOtaSettlement({ totalAmount: b.totalAmount, taxAmount: b.taxAmount, commissionPercent: b.otaCommissionPercent, paymentModel: b.otaPaymentModel });
    return s.otaCommissionAmount !== b.otaCommissionAmount || s.otaReceivable !== b.otaReceivable || s.otaPayable !== b.otaPayable;
  });

const criticalOpen = await db.collection("maintenancetickets").find({ priority: "CRITICAL", status: { $in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } }).toArray();
const rooms = new Map((await db.collection("rooms").find({}).toArray()).map((r) => [String(r._id), r]));
const criticalOnSale = criticalOpen.filter((t) => rooms.get(String(t.room))?.sellStatus !== "OUT_OF_ORDER");

const row = (b: any) => `| ${b.bookingReference} | ${b.source} | ${toBusinessDate(b.createdAt)} | ${toBusinessDate(b.checkInDate)} | ${toBusinessDate(b.checkOutDate)} |`;
const out = [
  `# Data integrity (dry run)\n`,
  `Generated ${new Date().toISOString()}. Nothing was changed.\n`,
  `| Check | Count |\n|---|---:|`,
  `| Bookings made after check-in (walk-ins: after the arrival day) | ${madeAfterStart.length} |`,
  `| … of which made after check-out | ${madeAfterEnd.length} |`,
  `| OTA bookings without commission terms | ${otaNoTerms.length} / ${ota.length} |`,
  `| OTA bookings whose stored settlement disagrees with the rule | ${otaDrift.length} |`,
  `| Rooms on sale with an open CRITICAL ticket | ${criticalOnSale.length} |`,
  `\n## Bookings made after their stay began\n`,
  `| Booking | Source | Made | Check-in | Check-out |\n|---|---|---|---|---|`,
  ...madeAfterStart.map(row),
  `\n## OTA bookings without terms\n`,
  ...otaNoTerms.map((b) => `- ${b.bookingReference} (${b.otaName ?? "OTA"})`),
  `\n## Open CRITICAL tickets on rooms still on sale\n`,
  ...criticalOnSale.map((t) => `- Room ${rooms.get(String(t.room))?.roomNumber}: ${t.issueTitle} (${t.status}). Proposed: OUT_OF_ORDER via syncRoomSellStatusWithTickets.`),
  `\nThese are demo-seed artefacts; the fix is the corrected seed (\`npm run seed\`) on a fresh database, which needs approval.`,
];
fs.writeFileSync("docs/consistency/data-integrity.md", out.join("\n") + "\n");
console.log(`criticalOnSale=${criticalOnSale.length} madeAfterStart=${madeAfterStart.length} madeAfterEnd=${madeAfterEnd.length} otaNoTerms=${otaNoTerms.length}/${ota.length} otaDrift=${otaDrift.length}`);
await mongoose.disconnect();
