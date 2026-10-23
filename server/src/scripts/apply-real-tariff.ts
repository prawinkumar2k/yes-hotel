/**
 * Puts the hotel's real tariff (from the owner's notes of 13-16 March 2026) into the database.
 *
 *   Dry run (default, changes nothing):   npx tsx server/src/scripts/apply-real-tariff.ts
 *   Apply:                                npx tsx server/src/scripts/apply-real-tariff.ts --apply --backup-taken
 *
 * Take a database backup first (see DEPLOYMENT.md). The script matches the room types by name (Delux/Deluxe and
 * Executive), prints exactly what it would change, and refuses to apply unless both flags are given.
 */
import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
const backupTaken = process.argv.includes("--backup-taken");

const CATEGORY_RATES: { match: RegExp; label: string; set: Record<string, unknown> }[] = [
  {
    match: /delu?xe/i,
    label: "Delux",
    set: {
      singleOccupancyPrice: 1800, basePrice: 2000,
      extraPersonRate: 700, extraBedRate: 1000, childRateNoBed: 500, childRateWithBed: 800,
      dayUseAllowed: true, dayUseSinglePrice: 1200, dayUseDoublePrice: 1600, dayUseMaxHours: 12,
      "capacity.adults": 3,
    },
  },
  {
    match: /executive/i,
    label: "Executive",
    set: {
      singleOccupancyPrice: 2500, basePrice: 3000,
      extraPersonRate: 1000, extraBedRate: 1500,
      dayUseAllowed: false,
    },
  },
];

const SETTINGS = {
  taxInclusiveRates: false, // "+5% GST for all rooms (extra)"
  earlyLateFeeSingle: 800, earlyLateFeeDouble: 1000, earlyLateMaxHours: 6,
  cpSingleSupplement: 200, cpDoubleSupplement: 300, extraBreakfastRate: 200,
  extraPersonRate: 700, extraBedRate: 1000, childRateNoBed: 500, childRateWithBed: 800,
  cancellationFreeHours: 48, cancellationPartialHours: 24, cancellationPartialPercent: 50,
  cancellationPolicy: "Free cancellation up to 48 hours before check-in. Between 48 and 24 hours before check-in, 50% of the booking amount is charged. Within 24 hours of check-in, or on a no-show, there is no refund.",
};

async function main() {
  if (apply && !backupTaken) {
    console.error("Refusing to apply: take a database backup first, then add --backup-taken.");
    process.exit(2);
  }
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels");
  const db = mongoose.connection.db!;
  console.log(`Database: ${mongoose.connection.name}   Mode: ${apply ? "APPLY" : "DRY RUN (nothing is changed)"}\n`);

  const categories = await db.collection("roomcategories").find({}).toArray();
  console.log("Room types found:", categories.map((c) => c.name).join(", ") || "none");
  for (const rule of CATEGORY_RATES) {
    const hits = categories.filter((c) => rule.match.test(String(c.name)));
    if (hits.length !== 1) {
      console.log(`\n${rule.label}: ${hits.length} matching room types (${hits.map((h) => h.name).join(", ") || "none"}): skipped, fix by hand in Admin → Room Types.`);
      continue;
    }
    const cat = hits[0];
    const rooms = await db.collection("rooms").countDocuments({ category: cat._id });
    console.log(`\n${rule.label} → "${cat.name}" (${rooms} rooms)`);
    for (const [k, v] of Object.entries(rule.set)) {
      const before = k.includes(".") ? k.split(".").reduce((o: any, p) => o?.[p], cat) : (cat as any)[k];
      console.log(`  ${k.padEnd(22)} ${String(before ?? "(not set)").padStart(10)}  →  ${v}`);
    }
    if (apply) await db.collection("roomcategories").updateOne({ _id: cat._id }, { $set: rule.set });
  }

  const settings: any = await db.collection("hotelsettings").find({}).sort({ updatedAt: -1 }).limit(1).next();
  if (!settings) {
    console.log("\nNo hotel settings document found: nothing to update there.");
  } else {
    console.log("\nHotel settings");
    for (const [k, v] of Object.entries(SETTINGS)) {
      const before = settings[k];
      if (typeof v === "string") console.log(`  ${k.padEnd(28)} (text will be replaced)`);
      else console.log(`  ${k.padEnd(28)} ${String(before ?? "(not set)").padStart(8)}  →  ${v}`);
    }
    if (apply) await db.collection("hotelsettings").updateOne({ _id: settings._id }, { $set: SETTINGS });
  }

  console.log(apply ? "\nDone." : "\nDry run only. Re-run with --apply --backup-taken after a backup.");
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
