// npm run db:restore -- <backupDir> --yes
// mongorestore --drop of a db:backup folder into MONGODB_URI. Destructive: every
// collection present in the backup is dropped and replaced, so --yes is required.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { findTool } from "./mongo-tools.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const uri = process.env.MONGODB_URI;

if (!dir || !existsSync(dir)) {
  console.error("Usage: npm run db:restore -- <backups/TIMESTAMP> --yes");
  process.exit(1);
}
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const dbName = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).pathname.slice(1);
const dumped = readdirSync(dir).filter((d) => !d.endsWith(".json"));
if (!dumped.includes(dbName)) {
  console.error(`Backup in ${dir} contains [${dumped.join(", ")}], not "${dbName}"`);
  process.exit(1);
}
if (!args.includes("--yes")) {
  console.error(`Refusing to restore without --yes: this DROPS and replaces every collection of "${dbName}" found in ${dir}.`);
  process.exit(1);
}

const mongorestore = findTool("mongorestore");
const r = spawnSync(
  mongorestore,
  [`--uri=${uri}`, "--drop", "--gzip", `--nsInclude=${dbName}.*`, path.resolve(dir)],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
