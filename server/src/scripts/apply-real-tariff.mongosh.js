/*
 * The hotel's real tariff (owner's notes, 13-16 March 2026), for running inside the MongoDB container (mongosh).
 * Same changes as apply-real-tariff.ts, without needing Node tooling on the server.
 *
 *   Dry run (changes nothing):
 *     docker cp /opt/yeshotels/server/src/scripts/apply-real-tariff.mongosh.js yeshotels-db:/tmp/tariff.js
 *     docker exec yeshotels-db mongosh yes_hotels --quiet --file /tmp/tariff.js
 *   Apply (after a database backup):
 *     docker exec -e APPLY=1 -e BACKUP_TAKEN=1 yeshotels-db mongosh yes_hotels --quiet --file /tmp/tariff.js
 */
const env = process.env;
const apply = env.APPLY === "1";
if (apply && env.BACKUP_TAKEN !== "1") {
  print("Refusing to apply: take a database backup first, then add BACKUP_TAKEN=1.");
  quit(2);
}

const RULES = [
  { match: /delu?xe/i, label: "Delux", set: {
    singleOccupancyPrice: 1800, basePrice: 2000,
    extraPersonRate: 700, extraBedRate: 1000, childRateNoBed: 500, childRateWithBed: 800,
    dayUseAllowed: true, dayUseSinglePrice: 1200, dayUseDoublePrice: 1600, dayUseMaxHours: 12,
    "capacity.adults": 3,
  } },
  { match: /executive/i, label: "Executive", set: {
    singleOccupancyPrice: 2500, basePrice: 3000,
    extraPersonRate: 1000, extraBedRate: 1500,
    dayUseAllowed: false,
    "capacity.adults": 2,
  } },
];

const SETTINGS = {
  taxInclusiveRates: false,
  earlyLateFeeSingle: 800, earlyLateFeeDouble: 1000, earlyLateMaxHours: 6,
  cpSingleSupplement: 200, cpDoubleSupplement: 300, extraBreakfastRate: 200,
  extraPersonRate: 700, extraBedRate: 1000, childRateNoBed: 500, childRateWithBed: 800,
  cancellationFreeHours: 48, cancellationPartialHours: 24, cancellationPartialPercent: 50,
  cancellationPolicy: "Free cancellation up to 48 hours before check-in. Between 48 and 24 hours before check-in, 50% of the booking amount is charged. Within 24 hours of check-in, or on a no-show, there is no refund.",
};

const pick = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
print("Database: " + db.getName() + "   Mode: " + (apply ? "APPLY" : "DRY RUN (nothing is changed)") + "\n");

const cats = db.roomcategories.find().toArray();
print("Room types found: " + cats.map((c) => c.name + " (" + db.rooms.countDocuments({ category: c._id }) + " rooms)").join(", "));

for (const rule of RULES) {
  const hits = cats.filter((c) => rule.match.test(String(c.name)));
  if (hits.length !== 1) {
    print("\n" + rule.label + ": " + hits.length + " matching room types (" + hits.map((h) => h.name).join(", ") + "): SKIPPED, set by hand in Admin > Room Types.");
    continue;
  }
  const cat = hits[0];
  print("\n" + rule.label + ' -> "' + cat.name + '" (' + db.rooms.countDocuments({ category: cat._id }) + " rooms)");
  for (const k of Object.keys(rule.set)) {
    const before = pick(cat, k);
    print("  " + k.padEnd(22) + String(before === undefined ? "(not set)" : before).padStart(10) + "  ->  " + rule.set[k]);
  }
  if (apply) db.roomcategories.updateOne({ _id: cat._id }, { $set: rule.set });
}

const settings = db.hotelsettings.find().sort({ updatedAt: -1 }).limit(1).toArray()[0];
if (!settings) {
  print("\nNo hotel settings document found: nothing to update there.");
} else {
  print("\nHotel settings");
  for (const k of Object.keys(SETTINGS)) {
    const v = SETTINGS[k];
    if (typeof v === "string") print("  " + k.padEnd(28) + "(text will be replaced)");
    else print("  " + k.padEnd(28) + String(settings[k] === undefined ? "(not set)" : settings[k]).padStart(8) + "  ->  " + v);
  }
  if (apply) db.hotelsettings.updateOne({ _id: settings._id }, { $set: SETTINGS });
}
print(apply ? "\nDone." : "\nDry run only. Apply with: docker exec -e APPLY=1 -e BACKUP_TAKEN=1 yeshotels-db mongosh yes_hotels --quiet --file /tmp/tariff.js");
