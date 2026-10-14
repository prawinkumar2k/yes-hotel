// Four staff logins: Admin, Manager, Reception, Housekeeping.
// Every other STAFF account is disabled (isActive=false), never deleted; customers are untouched.
// Per role only the first account (by creation date) stays active, so there is exactly one
// login each. Dry run by default; pass --apply to write.
//   node scripts/migrations/2026-10-14-four-staff-logins.mjs           (dry run)
//   node scripts/migrations/2026-10-14-four-staff-logins.mjs --apply
import "dotenv/config";
import mongoose from "mongoose";

const KEEP_ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"];
const apply = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGODB_URI);
const users = mongoose.connection.db.collection("users");
const staff = await users.find({ role: { $ne: "CUSTOMER" } }).sort({ createdAt: 1, _id: 1 }).toArray();

const keep = new Map();
for (const u of staff) if (KEEP_ROLES.includes(u.role) && u.isActive !== false && !keep.has(u.role)) keep.set(u.role, u);
const keepIds = new Set([...keep.values()].map((u) => String(u._id)));
const disable = staff.filter((u) => !keepIds.has(String(u._id)) && u.isActive !== false);

console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
console.log("\nStay active (one per role):");
for (const r of KEEP_ROLES) console.log(`  ${r.padEnd(13)} ${keep.get(r)?.email ?? "— none found —"}`);
console.log(`\nTo disable (${disable.length}):`);
for (const u of disable) console.log(`  ${u.role.padEnd(13)} ${u.email}`);

if (apply && disable.length) {
  const res = await users.updateMany(
    { _id: { $in: disable.map((u) => u._id) } },
    { $set: { isActive: false, disabledReason: "Four-login setup (Admin, Manager, Reception, Housekeeping) 2026-10-14", updatedAt: new Date() } },
  );
  // End any live sessions of the disabled accounts.
  await mongoose.connection.db.collection("refreshtokens").deleteMany({ user: { $in: disable.map((u) => u._id) } }).catch(() => undefined);
  await mongoose.connection.db.collection("auditlogs").insertOne({
    propertyId: keep.get("ADMIN")?.propertyId ?? new mongoose.Types.ObjectId(),
    actorType: "SYSTEM", actorRole: "SYSTEM", action: "users.disabled_for_four_logins", resourceType: "User",
    metadata: { disabled: disable.map((u) => ({ id: String(u._id), email: u.email, role: u.role })) },
    createdAt: new Date(),
  });
  console.log(`\nDisabled ${res.modifiedCount} account(s).`);
}
await mongoose.disconnect();
