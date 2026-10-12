// Migration: businessDate as a date-only string "YYYY-MM-DD" (Asia/Kolkata) on financial and
// operational documents.
//
//  1. Convert existing Date-typed fields: businessdates.date, cashiershifts.businessDate,
//     foliolines.businessDate  →  the IST calendar date of the stored instant.
//  2. Backfill businessDate where missing, from the document's own event time (IST).
//
// DRY RUN by default: writes docs/migrations/business-date-dry-run.md and changes nothing.
// --apply runs in one transaction with a marker in `migrations`. Ship together with the schema
// change (Date → String) and the code that reads/writes these fields.
//
//   node scripts/migrations/2026-10-13-business-date-strings.mjs [--apply]
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const MARKER = "2026-10-13-business-date-strings";
const istDate = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
const utcDate = (d) => new Date(d).toISOString().slice(0, 10);

// [collection, target field, source fields in order of preference, mode]
// mode "convert": target exists as a Date and is converted in place (missing ones are backfilled).
// mode "backfill": target does not exist yet.
const PLAN = [
  ["businessdates", "date", ["date"], "convert"],
  ["cashiershifts", "businessDate", ["businessDate", "openedAt", "createdAt"], "convert"],
  ["foliolines", "businessDate", ["businessDate", "postedAt", "createdAt"], "convert"],
  ["payments", "businessDate", ["paidAt", "createdAt"], "backfill"],
  ["refunds", "businessDate", ["processedAt", "createdAt"], "backfill"],
  ["advancepayments", "businessDate", ["receivedAt", "createdAt"], "backfill"],
  ["advanceadjustments", "businessDate", ["adjustedAt", "createdAt"], "backfill"],
  ["restaurantorders", "businessDate", ["createdAt"], "backfill"],
  ["ancillaryservices", "businessDate", ["createdAt"], "backfill"],
  ["housekeepingtasks", "businessDate", ["createdAt"], "backfill"],
  ["maintenancetickets", "businessDate", ["createdAt"], "backfill"],
];

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
if (await db.collection("migrations").findOne({ _id: MARKER })) {
  console.log(`Migration ${MARKER} has already been applied.`);
  await mongoose.disconnect();
  process.exit(0);
}

const rows = [];
const updates = [];
for (const [coll, target, sources, mode] of PLAN) {
  const docs = await db.collection(coll).find({}).toArray();
  let converted = 0, backfilled = 0, alreadyString = 0, noSource = 0, utcWouldDiffer = 0;
  const samples = [];
  for (const d of docs) {
    const current = d[target];
    if (typeof current === "string" && /^\d{4}-\d{2}-\d{2}$/.test(current)) { alreadyString++; continue; }
    const srcField = sources.find((s) => d[s] instanceof Date);
    if (!srcField) { noSource++; continue; }
    const value = istDate(d[srcField]);
    if (utcDate(d[srcField]) !== value) utcWouldDiffer++;
    if (current instanceof Date) converted++;
    else backfilled++;
    if (samples.length < 3) samples.push(`${d[srcField].toISOString()} (${srcField}) → "${value}"`);
    updates.push({ coll, _id: d._id, field: target, value });
  }
  rows.push({ coll, target, mode, docs: docs.length, converted, backfilled, alreadyString, noSource, utcWouldDiffer, samples, sources });
}

const total = updates.length;
const lines = [
  "# businessDate as YYYY-MM-DD (Asia/Kolkata) — dry run",
  "",
  `Generated ${new Date().toISOString()} against \`${db.databaseName}\`. **Nothing was changed.**`,
  "",
  `**${total} documents** would be updated. “UTC day differs” counts the documents whose UTC calendar day is not their IST day, i.e. those any UTC-based day bucketing put on the wrong day (defect B).`,
  "",
  "| Collection | Field | Mode | Docs | Converted Date→string | Backfilled | Already string | No source time | UTC day differs | Source (preference) | Samples |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.coll} | \`${r.target}\` | ${r.mode} | ${r.docs} | ${r.converted} | ${r.backfilled} | ${r.alreadyString} | ${r.noSource} | ${r.utcWouldDiffer} | ${r.sources.join(" → ")} | ${r.samples.join("<br>")} |`),
  "",
  "Schema change shipped with the apply: these fields become `String` matching `^\\d{4}-\\d{2}-\\d{2}$`, written via `toBusinessDate()` from `shared/dates.ts`; new documents get it on create.",
];
fs.mkdirSync("docs/migrations", { recursive: true });
fs.writeFileSync("docs/migrations/business-date-dry-run.md", lines.join("\n") + "\n");
console.log(lines.slice(0, 6).join("\n"));

if (!APPLY) {
  console.log("\nDry run only. Report: docs/migrations/business-date-dry-run.md");
  await mongoose.disconnect();
  process.exit(0);
}
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    for (const u of updates) await db.collection(u.coll).updateOne({ _id: u._id }, { $set: { [u.field]: u.value } }, { session });
    await db.collection("migrations").insertOne({ _id: MARKER, appliedAt: new Date(), documents: total }, { session });
  });
  console.log(`Applied to ${total} documents.`);
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
