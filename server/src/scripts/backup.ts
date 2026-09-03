import "dotenv/config";
import path from "node:path";
import mongoose from "mongoose";
import { runBackup } from "../services/backup-restore.service";

/**
 * Application-level backup: dumps every collection in the target database to
 * timestamped EJSON files, plus a manifest recording per-collection document
 * counts. This exists because this environment has no `mongodump` available
 * (MongoDB Database Tools aren't installed) — for a real production
 * deployment on a managed provider (MongoDB Atlas), prefer that provider's
 * native continuous/point-in-time backup instead of this script; this is a
 * portable fallback that works anywhere Node + a Mongo connection do, and is
 * what restore.ts knows how to read back. Actual behavior verified in
 * backup-restore.service.spec.ts and manually against the real dev database
 * (26 collections / 108 documents backed up, restored into an isolated
 * database, and verified byte-for-byte including BSON types).
 *
 * Usage:
 *   MONGODB_URI=... tsx server/src/scripts/backup.ts [outDir]
 *
 * Never deletes or modifies anything — read-only against the source DB.
 */
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels";
  const outRoot = process.argv[2] || path.join(process.cwd(), "backups");

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  const { outDir, manifest } = await runBackup(db, outRoot);
  for (const c of manifest.collections) console.log(`  ${c.name}: ${c.count} documents`);
  console.log(`\n✅ Backup of "${manifest.dbName}" written to ${outDir}`);
  console.log(`   ${manifest.collections.length} collections, ${manifest.collections.reduce((s, c) => s + c.count, 0)} total documents`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
