// Migration: store money as integer paise (×100, rounded half away from zero).
//
// DRY RUN by default: writes docs/migrations/money-to-paise-dry-run.md and changes nothing.
// --apply converts in one transaction and records a marker document so it can never run twice.
// (Do not --apply until the code that reads/writes these fields has been switched to paise.)
//
//   node scripts/migrations/2026-10-13-money-to-paise.mjs
//   node scripts/migrations/2026-10-13-money-to-paise.mjs --apply
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const MARKER = "2026-10-13-money-to-paise";

// Money fields per collection. "a[].b" = field b of each element of array a.
// Excluded on purpose: counts (quantity, pax, denominations n2000…n10, usageLimit…), percentages
// (gst*/cgst*/sgst*/igst*Percentage, commissionPercentage, discountPercentage, markupPercent,
// taxRatePercent, gstRules[].bands[].rate, cancellationPenaltyPercentage), ratings, sort orders,
// RatePlan.multiplier, loyalty points, PaymentChannel.taxOnFee (unit unclear; 0 documents).
export const MONEY_FIELDS = {
  advanceadjustments: ["amount"],
  advancepayments: ["amount", "totalAdjusted", "totalRefunded", "remainingBalance"],
  ancillaryservices: ["amount", "taxAmount", "totalAmount"],
  banksettlements: ["grossAmount", "commission", "gatewayFee", "taxOnFee", "expectedSettlement", "actualSettlement", "difference"],
  banquetbookings: ["ratePerPax", "totalEstimatedAmount", "advancePaid"],
  bookings: ["ratePerNight", "totalAmount", "taxAmount", "cgstAmount", "sgstAmount", "paidAmount", "discountAmount", "rateOverrideAmount", "cancellationPenalty"],
  bookingenquiries: ["expectedBudget", "pricePerNight", "roomSubtotal", "quotationAmount"],
  businessdates: ["auditSummary.roomChargesAmount", "auditSummary.totalRevenue", "auditSummary.totalTax", "auditSummary.totalCollection", "auditSummary.totalRefunds", "auditSummary.totalAdvances", "auditSummary.totalAdvanceAdjustments"],
  cashiershifts: ["openingFloat", "openingDenominations.coins", "openingDenominations.total", "cashCollected", "cashAdvances", "cashRefunds", "paidOuts[].amount", "totalPaidOut", "expectedCash", "expectedUpi", "expectedCard", "expectedGateway", "expectedOther", "actualCashCounted", "closingDenominations.coins", "closingDenominations.total", "cashVariance"],
  companies: ["creditLimit", "currentOutstanding"],
  corporateaccounts: ["creditLimit", "currentOutstanding"],
  coupons: ["minBookingAmount", "maxDiscount", { field: "discountValue", when: { discountType: "FIXED" } }],
  folios: ["totalCharges", "totalDiscounts", "totalTax", "totalPaid", "totalAdvanceAdjusted", "balance", "cgst", "sgst", "igst"],
  foliolines: ["amount", "unitPrice"],
  groupbookings: ["roomBlocks[].ratePerRoom", "totalEstimatedValue", "advancePaid", "balance"],
  guests: ["totalSpend"],
  hotelsettings: ["earlyCheckInFee", "lateCheckOutFee", "extraPersonRate", "extraBedRate", "childRateNoBed", "childRateWithBed", "mealPlanRates.EP", "mealPlanRates.CP", "mealPlanRates.MAP", "mealPlanRates.AP", "mealPlanRates.RO", "mealPlanRates.BB", "gstRules[].bands[].upTo"],
  menuitems: ["price", "modifiers[].priceDelta"],
  payments: ["amount", "refundedAmount"],
  paymentchannels: ["fixedFee"],
  pricingrules: ["price"],
  refunds: ["amount"],
  restaurantorders: ["items[].unitPrice", "items[].totalPrice", "subtotal", "taxAmount", "grandTotal"],
  roomcategories: ["basePrice", "hourlyPrice"],
  taskapprovals: ["amount"],
};

const toPaise = (rupees) => Math.sign(rupees) * Math.round(Math.abs(rupees) * 100);
const hasFloatDrift = (v) => Math.abs(v * 100 - Math.round(v * 100)) > 1e-6; // more than 2 decimals

/** Visit every value at a dotted path with [] for arrays; cb(container, key, value). */
function visit(obj, parts, cb) {
  if (obj == null) return;
  const [head, ...rest] = parts;
  if (head.endsWith("[]")) {
    const arr = obj[head.slice(0, -2)];
    if (Array.isArray(arr)) for (const el of arr) visit(el, rest, cb);
    return;
  }
  if (!rest.length) {
    if (typeof obj[head] === "number") cb(obj, head, obj[head]);
    return;
  }
  visit(obj[head], rest, cb);
}
const splitPath = (p) => p.split(".").flatMap((seg) => (seg.includes("[]") && !seg.endsWith("[]") ? seg.split(/(?<=\[\])/) : [seg]));

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

if (await db.collection("migrations").findOne({ _id: MARKER })) {
  console.log(`Migration ${MARKER} has already been applied. Nothing to do.`);
  await mongoose.disconnect();
  process.exit(0);
}

const report = [];
let totalValues = 0, totalDocs = 0, totalDrift = 0;
const plan = []; // { coll, _id, $set }
for (const [coll, fields] of Object.entries(MONEY_FIELDS)) {
  const docs = await db.collection(coll).find({}).toArray();
  if (!docs.length) { report.push({ coll, field: "(all)", docs: 0, values: 0 }); continue; }
  const perDocSets = new Map();
  for (const spec of fields) {
    const field = typeof spec === "string" ? spec : spec.field;
    const when = typeof spec === "string" ? null : spec.when;
    const parts = splitPath(field);
    let values = 0, drift = 0, min = Infinity, max = -Infinity, docsWith = 0;
    const samples = [];
    for (const d of docs) {
      if (when && !Object.entries(when).every(([k, v]) => d[k] === v)) continue;
      let touched = false;
      visit(d, parts, (container, key, v) => {
        values++; touched = true;
        if (hasFloatDrift(v)) drift++;
        min = Math.min(min, v); max = Math.max(max, v);
        if (samples.length < 3 && v !== 0) samples.push(`${v} → ${toPaise(v)}`);
        container[key] = toPaise(v);
      });
      if (touched) {
        docsWith++;
        perDocSets.set(String(d._id), d);
      }
    }
    totalValues += values; totalDrift += drift;
    report.push({ coll, field, docs: docsWith, values, drift, min: values ? min : "", max: values ? max : "", samples, when });
  }
  for (const d of perDocSets.values()) {
    const { _id, ...rest } = d;
    plan.push({ coll, _id, set: rest });
  }
  totalDocs += perDocSets.size;
}

const lines = [
  "# Money → integer paise — dry run",
  "",
  `Generated ${new Date().toISOString()} against \`${db.databaseName}\`. **Nothing was changed.**`,
  "",
  `Conversion: paise = round(rupees × 100), half away from zero. **${totalValues} values in ${totalDocs} documents** across ${Object.keys(MONEY_FIELDS).length} collections; **${totalDrift} values carry float drift** (more than 2 decimals) and are rounded to the paisa.`,
  "",
  "| Collection | Field | Docs | Values | >2 decimals | Min (₹) | Max (₹) | Sample before → after (paise) |",
  "|---|---|---|---|---|---|---|---|",
  ...report.map((r) =>
    r.values === 0 && r.field === "(all)"
      ? `| ${r.coll} | — | 0 | 0 | | | | (empty collection) |`
      : `| ${r.coll} | \`${r.field}\`${r.when ? ` (only ${Object.entries(r.when).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""} | ${r.docs} | ${r.values} | ${r.drift || ""} | ${r.min} | ${r.max} | ${r.samples.join("; ")} |`,
  ),
  "",
  "Excluded on purpose: counts (quantities, pax, cash denominations n2000…n10, usage limits), percentages and rates (GST %, commission %, discount %, markup %, `taxRatePercent`, `gstRules[].bands[].rate`), ratings, sort orders, `RatePlan.multiplier`, loyalty points, and `PaymentChannel.taxOnFee` (unit unclear; 0 documents).",
  "",
  "Applying: one transaction, then a marker document in `migrations` so it cannot run twice. Restore point: `npm run db:backup` immediately before.",
];
fs.mkdirSync("docs/migrations", { recursive: true });
fs.writeFileSync("docs/migrations/money-to-paise-dry-run.md", lines.join("\n") + "\n");
console.log(lines.slice(0, 6).join("\n"));

if (!APPLY) {
  console.log("\nDry run only. Report: docs/migrations/money-to-paise-dry-run.md");
  await mongoose.disconnect();
  process.exit(0);
}

const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    for (const p of plan) await db.collection(p.coll).replaceOne({ _id: p._id }, { _id: p._id, ...p.set }, { session });
    await db.collection("migrations").insertOne({ _id: MARKER, appliedAt: new Date(), documents: totalDocs, values: totalValues }, { session });
  });
  console.log(`Applied: ${totalValues} values in ${totalDocs} documents.`);
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
