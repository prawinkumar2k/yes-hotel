// Migration: assign the property to staff users and backfill propertyId on orphan records.
//
// Staff (every role except CUSTOMER and SUPER_ADMIN, which is global) get
// propertyId + propertyIds = [property]. Bookings, guests and restaurant
// orders without a propertyId get the property, because property-scoped
// staff views filter on it.
//
// Only valid while there is exactly one property; refuses otherwise.
//
//   node scripts/migrations/2026-10-12-assign-property.mjs           (dry run: prints before -> after)
//   node scripts/migrations/2026-10-12-assign-property.mjs --apply   (single transaction)
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const missing = { $or: [{ propertyId: { $exists: false } }, { propertyId: null }] };

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const properties = await db.collection("properties").find({}).toArray();
if (properties.length !== 1) {
  console.error(`Expected exactly one property, found ${properties.length}. Aborting.`);
  process.exit(1);
}
const property = properties[0];
console.log(`Property: ${property.code} ${property._id}\n`);

const staffFilter = { role: { $nin: ["CUSTOMER", "SUPER_ADMIN"] } };
const staff = await db.collection("users").find(staffFilter).sort({ role: 1 }).toArray();
console.log(`Users (${staff.length}): name | email | role | propertyId before -> after`);
for (const u of staff) {
  const after = String(u.propertyId ?? "") === String(property._id) ? "(unchanged)" : String(property._id);
  console.log(`  ${`${u.firstName} ${u.lastName}`.padEnd(20)} ${u.email.padEnd(30)} ${u.role.padEnd(13)} ${u.propertyId ?? "(none)"} -> ${after}`);
}

const backfill = ["bookings", "guests", "restaurantorders"];
const label = { bookings: "bookingReference", guests: "email", restaurantorders: "_id" };
for (const c of backfill) {
  const docs = await db.collection(c).find(missing).project({ [label[c]]: 1 }).toArray();
  console.log(`\n${c}: ${docs.length} without propertyId -> ${property._id}`);
  if (docs.length) console.log("  " + docs.map((d) => String(d[label[c]])).join(", "));
}

if (!APPLY) {
  console.log("\nDry run only. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const u = await db.collection("users").updateMany(
      staffFilter,
      { $set: { propertyId: property._id }, $addToSet: { propertyIds: property._id } },
      { session },
    );
    console.log(`\nusers updated: ${u.modifiedCount}`);
    for (const c of backfill) {
      const r = await db.collection(c).updateMany(missing, { $set: { propertyId: property._id } }, { session });
      console.log(`${c} updated: ${r.modifiedCount}`);
    }
  });
  console.log("Committed.");
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
