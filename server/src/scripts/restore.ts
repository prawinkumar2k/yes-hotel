import "dotenv/config";
import mongoose from "mongoose";
import { runRestore, LiveDatabaseRestoreRefusedError } from "../services/backup-restore.service";

/**
 * Restores a backup produced by backup.ts into a TARGET database. Refuses
 * to restore into the database the app's own MONGODB_URI currently points
 * at, unless --force is explicitly passed — a disaster-recovery tool that
 * bulk-inserts a full dataset in one shot must not be pointable at a live
 * database by a copy-paste mistake. See backup-restore.service.ts.
 *
 * Usage:
 *   tsx server/src/scripts/restore.ts <backupDir> <targetMongoUri> [--force]
 */
async function main() {
  const [, , backupDir, targetUri, ...rest] = process.argv;
  const force = rest.includes("--force");

  if (!backupDir || !targetUri) {
    console.error("Usage: tsx server/src/scripts/restore.ts <backupDir> <targetMongoUri> [--force]");
    process.exit(1);
  }

  const liveUri = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels";
  const liveDbName = new URL(liveUri.replace("mongodb://", "http://").replace("mongodb+srv://", "http://")).pathname.replace("/", "");

  await mongoose.connect(targetUri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  console.log(`Restoring backup from ${backupDir} into "${db.databaseName}"...`);

  try {
    const results = await runRestore(db, backupDir, { liveDbName, force });
    for (const r of results) console.log(`  ${r.name}: restored ${r.restored}/${r.expected}`);
    const allMatch = results.every((r) => r.restored === r.expected);
    console.log(allMatch ? "\n✅ Restore complete — every collection matches the backup's document count." : "\n⚠️  Restore complete with mismatches — see counts above.");
    await mongoose.disconnect();
    if (!allMatch) process.exit(1);
  } catch (err) {
    await mongoose.disconnect();
    if (err instanceof LiveDatabaseRestoreRefusedError) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error("❌ Restore failed:", err);
  process.exit(1);
});
