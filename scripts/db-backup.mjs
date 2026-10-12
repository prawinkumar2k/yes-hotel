// npm run db:backup — mongodump of MONGODB_URI into backups/<timestamp>/ (gzip, BSON).
// Read-only against the source DB. Restore with: npm run db:restore -- backups/<timestamp> --yes
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findTool } from "./mongo-tools.mjs";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
const outDir = path.resolve(process.argv[2] || "backups", stamp);
mkdirSync(outDir, { recursive: true });

const mongodump = findTool("mongodump");
console.log(`[db:backup] ${mongodump}\n[db:backup] → ${outDir}`);
const r = spawnSync(mongodump, [`--uri=${uri}`, `--out=${outDir}`, "--gzip"], { stdio: "inherit" });
if (r.status !== 0) {
  console.error(`[db:backup] mongodump failed (exit ${r.status})`);
  process.exit(r.status ?? 1);
}

writeFileSync(
  path.join(outDir, "BACKUP_INFO.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), uri: uri.replace(/\/\/[^@]*@/, "//<creds>@"), tool: "mongodump --gzip" }, null, 2),
);
console.log(`[db:backup] done: ${outDir}`);
