/**
 * RBAC access matrix: for every mounted route, which roles can reach the handler.
 *
 * Simulates each route's middleware chain in declaration order (router.use()
 * only applies to routes declared after it):
 *   protect / optionalProtect, authorize(...roles), requirePermission(PAGE, ACTION),
 *   requirePropertyAccess (modelled as: staff pass, CUSTOMER and anonymous fail).
 * Role checks written inside controllers are NOT modelled.
 *
 * Usage:
 *   npx tsx scripts/audit/rbac-matrix.ts --source=db   --out=before.json   (permissions from rolepermissions collection)
 *   npx tsx scripts/audit/rbac-matrix.ts --source=code --out=after.json    (permissions from server/src/config/permissions.ts)
 *   npx tsx scripts/audit/rbac-matrix.ts --diff=before.json,after.json     (markdown diff)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const ROLES = [
  "PUBLIC", "CUSTOMER", "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "RECEPTIONIST", "CASHIER",
  "HOUSEKEEPING", "MAINTENANCE", "RESTAURANT", "FINANCE", "EVENTS", "INVENTORY", "PROCUREMENT",
];
type Perms = Record<string, Record<string, string[]>>; // role -> pageKey -> actions
type Row = { method: string; path: string; roles: string[] };

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));

function splitArgs(s: string) {
  const out: string[] = [];
  let depth = 0, cur = "", q: string | null = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { q = ch; cur += ch; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function callAt(src: string, openParen: number) {
  let i = openParen + 1, depth = 1, q: string | null = null;
  for (; i < src.length && depth; i++) {
    const ch = src[i];
    if (q) { if (ch === q && src[i - 1] !== "\\") q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") q = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
  }
  return { body: src.slice(openParen + 1, i - 1), end: i };
}

/** Expand a middleware expression into atomic tokens, resolving `...CONST_ARRAY` spreads. */
function resolveMw(expr: string, consts: Record<string, string[]>): string[] {
  const e = expr.replace(/\s+/g, " ").trim();
  const auth = e.match(/^authorize\((.*)\)$/);
  if (auth) {
    const roles = splitArgs(auth[1]).flatMap((a) => {
      const spread = a.match(/^\.\.\.(\w+)$/);
      if (spread) return consts[spread[1]] ?? [`?${spread[1]}`];
      return [a.replace(/^UserRole\./, "").replace(/["'`]/g, "")];
    });
    return [`authorize:${roles.join(",")}`];
  }
  const perm = e.match(/^requirePermission\(\s*["'](.+?)["']\s*(?:,\s*["'](\w+)["'])?\s*\)$/);
  if (perm) return [`perm:${perm[1]}:${perm[2] || "VIEW"}`];
  const owner = e.match(/^requirePermissionOrBookingOwner\(\s*["'](.+?)["']\s*(?:,\s*["'](\w+)["'])?\s*\)$/);
  if (owner) return [`permOrOwner:${owner[1]}:${owner[2] || "VIEW"}`];
  return [e];
}

function parseRouteFile(file: string) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\/\/.*$/gm, "");
  const consts: Record<string, string[]> = {};
  for (const m of src.matchAll(/const (\w+)\s*(?::[^=]+)?=\s*\[([^\]]*)\]/g))
    consts[m[1]] = m[2].split(",").map((x) => x.trim().replace(/^UserRole\./, "").replace(/["'`]/g, "")).filter(Boolean);
  const out: { method: string; path: string; mw: string[] }[] = [];
  let active: string[] = [];
  const re = /router\.(use|get|post|put|patch|delete)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const { body, end } = callAt(src, re.lastIndex - 1);
    re.lastIndex = end;
    const parts = splitArgs(body);
    if (m[1] === "use") {
      // path-scoped router.use("/sub", ...) is not used in this codebase; applies to every later route
      active = active.concat(parts.filter((p) => !/^["'`]/.test(p)).flatMap((p) => resolveMw(p, consts)));
      continue;
    }
    const p = parts[0].replace(/^["'`]|["'`]$/g, "");
    const mw = parts.slice(1, -1).flatMap((x) => resolveMw(x, consts));
    out.push({ method: m[1].toUpperCase(), path: p, mw: [...active, ...mw] });
  }
  return out;
}

function mountedRoutes() {
  const idx = fs.readFileSync(path.join(ROOT, "server/index.ts"), "utf8");
  const imports: Record<string, string> = {};
  for (const m of idx.matchAll(/import (\w+) from "\.\/src\/routes\/([\w.-]+)"/g)) imports[m[1]] = `server/src/routes/${m[2]}.ts`;
  const rows: { method: string; path: string; mw: string[] }[] = [];
  for (const m of idx.matchAll(/^\s*app\.use\("([^"]+)",\s*(\w+)\)/gm)) {
    const file = imports[m[2]];
    if (!file) continue;
    for (const r of parseRouteFile(file)) {
      const full = (m[1] + (r.path === "/" ? "" : r.path)).replace(/\/+$/, "") || "/";
      rows.push({ ...r, path: full });
    }
  }
  return rows;
}

function allowed(role: string, mw: string[], perms: Perms, bypass: string[]): boolean {
  for (const t of mw) {
    if (t === "protect" || t.startsWith("protect")) { if (role === "PUBLIC") return false; continue; }
    if (t === "requirePropertyAccess") { if (role === "PUBLIC" || role === "CUSTOMER") return false; continue; }
    if (t.startsWith("authorize:")) { if (!t.slice(10).split(",").includes(role)) return false; continue; }
    if (t.startsWith("requireRole:")) { if (!t.slice(12).split(",").includes(role)) return false; continue; }
    if (t.startsWith("permOrOwner:")) {
      if (role === "PUBLIC") return false;
      if (role === "CUSTOMER" || bypass.includes(role)) continue; // CUSTOMER: own booking only (enforced in middleware)
      const [, page, action] = t.split(":");
      if (!(perms[role]?.[page] || []).includes(action)) return false;
      continue;
    }
    if (t.startsWith("perm:")) {
      if (role === "PUBLIC") return false;
      if (bypass.includes(role)) continue;
      const [, page, action] = t.split(":");
      if (!(perms[role]?.[page] || []).includes(action)) return false;
      continue;
    }
  }
  return true;
}

async function loadDbPerms(): Promise<Perms> {
  const mongoose = (await import("mongoose")).default;
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const roles = await db.collection("roles").find({ isActive: { $ne: false } }).toArray();
  const rp = await db.collection("rolepermissions").find({ isActive: { $ne: false } }).toArray();
  await mongoose.disconnect();
  const byId = Object.fromEntries(roles.map((r: any) => [String(r._id), r.key]));
  const perms: Perms = {};
  for (const r of rp as any[]) {
    const role = byId[String(r.roleId)];
    if (!role) continue;
    (perms[role] ||= {})[r.pageKey] = r.actions;
  }
  return perms;
}

async function main() {
  if (args.diff) {
    const [a, b] = String(args.diff).split(",").map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as Row[]);
    const key = (r: Row) => `${r.method} ${r.path}`;
    const before = new Map(a.map((r) => [key(r), r.roles]));
    const lines: string[] = [];
    for (const r of b) {
      const prev = before.get(key(r));
      if (!prev) { lines.push(`+ ${key(r)} (new route): ${r.roles.join(", ")}`); continue; }
      const gained = r.roles.filter((x) => !prev.includes(x));
      const lost = prev.filter((x) => !r.roles.includes(x));
      if (gained.length || lost.length)
        lines.push(`${key(r)}${gained.length ? `  +[${gained.join(",")}]` : ""}${lost.length ? `  -[${lost.join(",")}]` : ""}`);
    }
    for (const k of before.keys()) if (!b.some((r) => key(r) === k)) lines.push(`- ${k} (route removed)`);
    console.log(lines.length ? lines.join("\n") : "(no access changes)");
    return;
  }

  let perms: Perms;
  let bypass: string[];
  if (args.source === "code") {
    const mod = await import(pathToFileURL(path.join(ROOT, "server/src/config/permissions.ts")).href);
    perms = mod.DEFAULT_ROLE_PERMISSIONS;
    bypass = mod.FULL_ACCESS_ROLES;
  } else {
    perms = await loadDbPerms();
    bypass = ["SUPER_ADMIN", "ADMIN"]; // requirePermission's hardcoded bypass before the merge
  }
  const rows: Row[] = mountedRoutes().map((r) => ({
    method: r.method,
    path: r.path,
    roles: ROLES.filter((role) => allowed(role, r.mw, perms, bypass)),
  }));
  const out = String(args.out || "rbac-matrix.json");
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`${rows.length} routes → ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
