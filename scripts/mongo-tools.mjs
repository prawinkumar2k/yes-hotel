// Locates MongoDB Database Tools binaries (mongodump / mongorestore).
// Order: MONGODB_TOOLS_DIR, PATH, then this machine's dev install under ~/mongodb-dev/tools.
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

export function findTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (process.env.MONGODB_TOOLS_DIR) {
    const p = path.join(process.env.MONGODB_TOOLS_DIR, exe);
    if (existsSync(p)) return p;
  }
  const onPath = spawnSync(process.platform === "win32" ? "where" : "which", [name], { encoding: "utf8" });
  if (onPath.status === 0) return onPath.stdout.split(/\r?\n/)[0].trim();

  const devRoot = path.join(os.homedir(), "mongodb-dev", "tools");
  if (existsSync(devRoot)) {
    for (const d of readdirSync(devRoot)) {
      const p = path.join(devRoot, d, "bin", exe);
      if (existsSync(p)) return p;
    }
  }
  throw new Error(`${name} not found. Install MongoDB Database Tools or set MONGODB_TOOLS_DIR.`);
}
