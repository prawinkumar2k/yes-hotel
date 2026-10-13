// Migration: room-night inventory. One `roomnights` document per (room, night), unique on
// (room, date), backfilled from bookings that hold an assigned room.
//
// Nights are the IST calendar dates [checkIn, checkOut). Bookings counted: CONFIRMED,
// CHECKED_IN, CHECKED_OUT (history is kept so past nights stay accounted for).
// Conflicts (two bookings on the same room-night) are reported and block --apply.
//
// DRY RUN by default: writes docs/migrations/room-nights-dry-run.md, changes nothing.
//   node scripts/migrations/2026-10-13-room-nights.mjs [--apply]
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const MARKER = "2026-10-13-room-nights";
const ist = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
const addDays = (ymd, n) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d) + n * 864e5).toISOString().slice(0, 10); };
const nightsOf = (ci, co) => { const out = []; for (let d = ist(ci); d < ist(co); d = addDays(d, 1)) out.push(d); return out; };

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
if (await db.collection("migrations").findOne({ _id: MARKER })) {
  console.log(`Migration ${MARKER} has already been applied.`);
  await mongoose.disconnect();
  process.exit(0);
}

const bookings = await db.collection("bookings")
  .find({ assignedRoom: { $ne: null }, status: { $in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } })
  .project({ bookingReference: 1, status: 1, assignedRoom: 1, checkInDate: 1, checkOutDate: 1, propertyId: 1 })
  .toArray();
const rooms = new Map((await db.collection("rooms").find().project({ roomNumber: 1 }).toArray()).map((r) => [String(r._id), r.roomNumber]));

const claims = new Map(); // room|date -> [booking]
const docs = [];
let noNights = 0;
for (const b of bookings) {
  const ns = nightsOf(b.checkInDate, b.checkOutDate);
  if (!ns.length) noNights++;
  for (const date of ns) {
    const key = `${b.assignedRoom}|${date}`;
    if (!claims.has(key)) claims.set(key, []);
    claims.get(key).push(b);
    docs.push({ room: b.assignedRoom, date, booking: b._id, propertyId: b.propertyId, status: b.status === "CHECKED_OUT" ? "CONSUMED" : "HELD", createdAt: new Date() });
  }
}
const conflicts = [...claims.entries()].filter(([, bs]) => bs.length > 1);

const lines = [
  "# Room-night inventory backfill — dry run",
  "",
  `Generated ${new Date().toISOString()} against \`${db.databaseName}\`. **Nothing was changed.**`,
  "",
  `- Bookings with an assigned room (CONFIRMED / CHECKED_IN / CHECKED_OUT): **${bookings.length}**`,
  `- Room-night documents to insert into the new \`roomnights\` collection: **${docs.length}** (unique index on room + date)`,
  `- Bookings with no nights (same-day): ${noNights}`,
  `- **Conflicts (same room, same night, more than one booking): ${conflicts.length}**`,
  "",
  conflicts.length ? "| Room | Night | Bookings |\n|---|---|---|" : "No conflicts: the unique index can be created as-is.",
  ...conflicts.map(([k, bs]) => `| ${rooms.get(k.split("|")[0]) ?? k.split("|")[0]} | ${k.split("|")[1]} | ${bs.map((b) => `${b.bookingReference} (${b.status})`).join(", ")} |`),
  "",
  "Existing data is not modified; this only inserts into a new collection.",
];
fs.mkdirSync("docs/migrations", { recursive: true });
fs.writeFileSync("docs/migrations/room-nights-dry-run.md", lines.join("\n") + "\n");
console.log(lines.join("\n"));

if (!APPLY) { await mongoose.disconnect(); process.exit(0); }
if (conflicts.length) { console.error("Refusing to apply: resolve conflicts first."); process.exit(1); }
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    if (docs.length) await db.collection("roomnights").insertMany(docs, { session });
    await db.collection("migrations").insertOne({ _id: MARKER, appliedAt: new Date(), documents: docs.length }, { session });
  });
  await db.collection("roomnights").createIndex({ room: 1, date: 1 }, { unique: true });
  console.log(`Applied: ${docs.length} room-nights; unique index (room, date) created.`);
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
