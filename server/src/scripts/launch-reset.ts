/**
 * One-time launch reset (approved by the hotel owner): removes test bookings and demo data,
 * keeps the hotel's setup. Runs once per --run-id (recorded in the "migrations" collection).
 *
 *   npx tsx server/src/scripts/launch-reset.ts --run-id=<id>            dry run: counts only
 *   npx tsx server/src/scripts/launch-reset.ts --run-id=<id> --apply    delete (take a backup first)
 *
 * Kept: staff logins, rooms, active room types, rates, settings, website content, gallery, FAQs,
 * SEO pages, coupons. Rooms become vacant and clean. Room types the hotel doesn't have
 * (RETIRE_ROOM_TYPES) are switched off, not deleted.
 */
import mongoose from "mongoose";

const WIPE = [
  // bookings, bills and guests
  "bookings", "folios", "foliolines", "payments", "refunds", "advancepayments", "advanceadjustments",
  "roomnights", "bookinginventorydays", "bookingevents", "bookingidempotencies", "bookingchangerequests",
  "bookingenquiries", "guests", "chatconversations", "chatmessages", "reviews", "housekeepingtasks",
  "cashiershifts", "restaurantorders", "complaints", "contactmessages", "banquetbookings", "groupbookings",
  "verificationrequests", "taskapprovals", "notificationlogs", "loyaltytransactions", "inspectionresults",
  "banksettlements", "webhookevents", "jobs", "loginotps", "passwordresettokens", "refreshtokens",
  "auditlogs", "businessdates", "counters",
  // demo setup from the seed script
  "menuitems", "rateplans", "corporateaccounts", "companies", "channelmappings", "ancillaryservices",
  "maintenancetickets", "testimonials",
];
const RETIRE_INTO: Record<string, string> = { "standard-room": "deluxe-room", suite: "executive-room" };
const RETIRE_ROOM_TYPES = Object.keys(RETIRE_INTO);

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const runId = String(args["run-id"] || "");
const apply = "apply" in args;

async function snapshot(db: mongoose.mongo.Db, names: Set<string>) {
  const out: Record<string, number | string> = {};
  for (const c of WIPE) if (names.has(c)) out[c] = await db.collection(c).countDocuments();
  out["users: guest accounts"] = await db.collection("users").countDocuments({ role: "CUSTOMER" });
  out["users: staff (kept)"] = await db.collection("users").countDocuments({ role: { $ne: "CUSTOMER" } });
  out["rooms (kept)"] = await db.collection("rooms").countDocuments();
  out["room types active"] = (await db.collection("roomcategories").find({ isActive: { $ne: false } }).project({ name: 1 }).toArray()).map((c) => c.name).join(", ");
  const cats = await db.collection("roomcategories").find({}).project({ name: 1, slug: 1 }).toArray();
  for (const c of cats) out[`rooms in ${c.name}`] = await db.collection("rooms").countDocuments({ category: c._id });
  return out;
}

async function main() {
  if (!/^[a-z0-9-]{6,60}$/.test(runId)) throw new Error("--run-id=<id> is required");
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const done = await db.collection("migrations").findOne({ _id: `launch-reset:${runId}` as any });
  if (done) {
    console.log(`Already ran (${runId}) at ${done.at?.toISOString?.() ?? done.at} — nothing to do.`);
    return;
  }
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const before = await snapshot(db, names);
  console.log(`Database ${db.databaseName} — ${apply ? "APPLY" : "DRY RUN"}`);
  console.table(before);
  if (!apply) return;

  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    for (const c of WIPE) if (names.has(c)) await db.collection(c).deleteMany({}, { session });
    await db.collection("users").deleteMany({ role: "CUSTOMER" }, { session });
    // Rooms of the retired types move to the hotel's types so every room stays sellable
    // (Standard → Deluxe, Signature Suite → Executive); Admin can re-assign any room later.
    for (const [from, to] of Object.entries(RETIRE_INTO)) {
      const [src, dst] = await Promise.all([
        db.collection("roomcategories").findOne({ slug: from }, { session }),
        db.collection("roomcategories").findOne({ slug: to, isActive: { $ne: false } }, { session }),
      ]);
      if (src && dst) await db.collection("rooms").updateMany({ category: src._id }, { $set: { category: dst._id } }, { session });
    }
    await db.collection("roomcategories").updateMany({ slug: { $in: RETIRE_ROOM_TYPES } }, { $set: { isActive: false } }, { session });
    // Every room vacant and clean with no booking; rooms on a maintenance hold keep their hold.
    await db.collection("rooms").updateMany({}, {
      $set: { occupancyStatus: "VACANT", housekeepingStatus: "CLEAN" },
      $unset: { currentBooking: "", releasedAt: "", releasedBy: "" },
    }, { session });
    await db.collection("rooms").updateMany(
      { maintenanceHold: { $exists: false }, status: { $in: ["RESERVED", "OCCUPIED", "CLEANING"] } },
      { $set: { status: "AVAILABLE" } }, { session });
  });
  await session.endSession();

  const after = await snapshot(db, names);
  console.log("After:");
  console.table(after);
  await db.collection("migrations").insertOne({ _id: `launch-reset:${runId}` as any, at: new Date(), before, after });
  // The first entry of the fresh audit log says what happened (visible in Admin → Audit Log).
  await db.collection("auditlogs").insertOne({
    action: "system.launch_reset", resourceType: "System", resourceId: runId, createdAt: new Date(), timestamp: new Date(),
    metadata: { removed: Object.fromEntries(Object.entries(before).filter(([k]) => WIPE.includes(k))), roomTypesActive: after["room types active"] },
  });
  console.log(`Done (${runId}).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
