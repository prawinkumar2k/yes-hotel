import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// `mongodb` isn't a direct dependency (it's nested inside mongoose's own
// dependency tree, not resolvable as a top-level type import under pnpm's
// strict node_modules) — mongoose re-exports the driver's Db type via
// `mongoose.mongo`, so that's the type source used here instead.
type Db = InstanceType<typeof mongoose.mongo.Db>;

const { EJSON } = mongoose.mongo.BSON;

export interface BackupManifest {
  dbName: string;
  timestamp: string;
  collections: { name: string; count: number }[];
}

/**
 * Dumps every collection in `db` to EJSON files under a fresh
 * `<outRoot>/<dbName>-<timestamp>/` directory, plus a manifest.json. Purely
 * read-only against the source database. EJSON (not plain JSON) preserves
 * BSON types (ObjectId, Date) so a restore can reconstruct documents
 * exactly, not guess at field types from bare strings.
 */
export async function runBackup(db: Db, outRoot: string): Promise<{ outDir: string; manifest: BackupManifest }> {
  const dbName = db.databaseName;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(outRoot, `${dbName}-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const collections = await db.listCollections().toArray();
  const manifest: BackupManifest = { dbName, timestamp, collections: [] };

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(outDir, `${name}.json`), EJSON.stringify(docs, undefined, 2));
    manifest.collections.push({ name, count: docs.length });
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { outDir, manifest };
}

export interface RestoreResult {
  name: string;
  expected: number;
  restored: number;
}

export class LiveDatabaseRestoreRefusedError extends Error {
  constructor(dbName: string) {
    super(`Refused to restore into "${dbName}" — it matches the app's own configured MONGODB_URI. Pass force:true to override.`);
    this.name = "LiveDatabaseRestoreRefusedError";
  }
}

/**
 * Restores a backup directory (produced by runBackup) into `db`. Refuses if
 * `db.databaseName === liveDbName` unless `force` is set — a disaster
 * recovery tool that bulk-inserts a full dataset must not be pointable at a
 * live database by accident.
 */
export async function runRestore(
  db: Db,
  backupDir: string,
  opts: { liveDbName?: string; force?: boolean } = {}
): Promise<RestoreResult[]> {
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest.json found in ${backupDir} — not a valid backup directory`);
  }
  const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (opts.liveDbName && db.databaseName === opts.liveDbName && !opts.force) {
    throw new LiveDatabaseRestoreRefusedError(db.databaseName);
  }

  const results: RestoreResult[] = [];
  for (const { name, count } of manifest.collections) {
    const filePath = path.join(backupDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      results.push({ name, expected: count, restored: 0 });
      continue;
    }
    const docs = EJSON.parse(fs.readFileSync(filePath, "utf8"));
    if (docs.length === 0) {
      results.push({ name, expected: count, restored: 0 });
      continue;
    }
    const insertResult = await db.collection(name).insertMany(docs, { ordered: false });
    results.push({ name, expected: count, restored: insertResult.insertedCount });
  }
  return results;
}
