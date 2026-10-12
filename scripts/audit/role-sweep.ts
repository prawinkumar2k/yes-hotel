/**
 * Per-role verification sweep against a running dev server.
 *
 *  1. API: every GET route in docs/rbac/<matrix>.json, called with each role's token.
 *     A 403 is "expected" when the permission map does not grant the route to the role.
 *  2. Pages: every permission-guarded route in client/App.tsx loaded in Chromium as each
 *     role (session injected into localStorage). Records failed /api calls, console and
 *     page errors, and whether the page showed "Access Denied".
 *
 * Read-only (GET + page loads). Dev tool: mints tokens with JWT_ACCESS_SECRET.
 *
 *   npx tsx scripts/audit/role-sweep.ts [--base=http://localhost:8090] [--matrix=docs/rbac/after-n2.json] [--label=n1-n5]
 * Writes docs/verification/role-sweep-<label>.md and .json
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { chromium } from "playwright";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const BASE = String(args.base || "http://localhost:8090");
const MATRIX = String(args.matrix || "docs/rbac/after-n2.json");
const LABEL = String(args.label || "latest");
const ROLES = ["RECEPTIONIST", "CASHIER", "HOUSEKEEPING", "MAINTENANCE", "SUPERVISOR", "MANAGER", "FINANCE", "RESTAURANT"];
// GET handlers that still write (non-financial); skipped so the sweep stays read-only.
const SKIP_GET = new Set(["/api/guests/:id"]);

type ApiResult = { path: string; status: number | string; expected: boolean; verdict: "ok" | "403-expected" | "param" | "error"; msg: string };
type PageResult = { route: string; pageKey: string; verdict: "ok" | "denied-expected" | "error"; notes: string[] };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const pick = async (c: string, q: object = {}) => (await db.collection(c).findOne(q))?._id;
  const sample: Record<string, any> = {
    booking: await pick("bookings", { status: "CHECKED_IN" }),
    room: await pick("rooms"),
    folio: await pick("folios"),
    enquiry: await pick("bookingenquiries"),
    category: await pick("roomcategories"),
    slug: (await db.collection("roomcategories").findOne({}))?.slug,
  };
  const usersByRole: Record<string, any> = {};
  for (const r of ROLES) usersByRole[r] = await db.collection("users").findOne({ role: r, isActive: { $ne: false } });
  await mongoose.disconnect();

  const token = (u: any) => jwt.sign({ id: String(u._id), role: u.role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "30m" });
  const fill = (p: string) =>
    p.split("/").map((s) => {
      if (!s.startsWith(":")) return s;
      const n = s.slice(1);
      if (n === "slug") return sample.slug;
      if (n === "key") return "terms";
      if (/room/i.test(n)) return String(sample.room);
      if (/folio/i.test(n)) return String(sample.folio);
      return String(sample.booking);
    }).join("/");

  // ── 1. API sweep ──────────────────────────────────────────────────────────
  const matrix: Array<{ method: string; path: string; roles: string[] }> = JSON.parse(fs.readFileSync(MATRIX, "utf8"));
  const gets = matrix.filter((r) => r.method === "GET" && !SKIP_GET.has(r.path));
  const api: Record<string, ApiResult[]> = {};
  for (const role of ROLES) {
    const u = usersByRole[role];
    if (!u) continue;
    const t = token(u);
    api[role] = [];
    for (const r of gets) {
      const expected = r.roles.includes(role);
      let status: number | string, msg = "";
      try {
        const res = await fetch(BASE + fill(r.path), { headers: { Authorization: `Bearer ${t}` } });
        status = res.status;
        if (status >= 400) msg = String(((await res.json().catch(() => ({}))) as any).message ?? "").slice(0, 120);
      } catch (e: any) { status = "ERR"; msg = e.message; }
      let verdict: ApiResult["verdict"];
      if (typeof status === "number" && status < 400) verdict = expected ? "ok" : "error"; // allowed but should not be
      else if (status === 403) verdict = expected ? "error" : "403-expected";
      else if (status === 400 || status === 404) verdict = "param"; // generic params / sample ids
      else verdict = "error";
      if (verdict === "error" && typeof status === "number" && status < 400) msg = "allowed but the permission map denies it";
      api[role].push({ path: r.path, status, expected, verdict, msg });
    }
  }

  // ── 2. Page sweep ─────────────────────────────────────────────────────────
  const app = fs.readFileSync("client/App.tsx", "utf8");
  const pages = [...app.matchAll(/<Route path="([^"]+)" element=\{<PermissionRoute pageKey="([^"]+)"/g)].map((m) => ({ route: m[1], pageKey: m[2] }));
  const pageRoute = (r: string) =>
    r.replace("/*", "").replace(/:id/, String(r.startsWith("/admin/enquiries") ? sample.enquiry : sample.booking));

  const browser = await chromium.launch();
  const pageResults: Record<string, PageResult[]> = {};
  for (const role of ROLES) {
    const u = usersByRole[role];
    if (!u) continue;
    const session = { _id: String(u._id), firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, token: token(u) };
    const ctx = await browser.newContext({ baseURL: BASE });
    await ctx.addInitScript((s) => localStorage.setItem("yes_hotels_user", JSON.stringify(s)), session);
    const page = await ctx.newPage();
    pageResults[role] = [];
    for (const p of pages) {
      const notes: string[] = [];
      const failed: string[] = [];
      const onResp = (res: any) => {
        const url = new URL(res.url());
        if (url.pathname.startsWith("/api/") && res.status() >= 400) failed.push(`${res.status()} ${res.request().method()} ${url.pathname}`);
        // Any server failure on a non-API asset (e.g. Vite 504 "Outdated Optimize Dep") breaks the page.
        else if (!url.pathname.startsWith("/api/") && res.status() >= 500) failed.push(`${res.status()} asset ${url.pathname}`);
      };
      const onConsole = (m: any) => { if (m.type() === "error") notes.push(`console: ${m.text().slice(0, 140)}`); };
      const onPageError = (e: any) => notes.push(`pageerror: ${String(e.message).slice(0, 140)}`);
      page.on("response", onResp);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      try {
        await page.goto(pageRoute(p.route), { waitUntil: "networkidle", timeout: 20000 });
        await page.waitForTimeout(400);
      } catch (e: any) {
        notes.push(`navigation: ${e.message.split("\n")[0]}`);
      }
      const denied = await page.getByText("Access Denied", { exact: true }).count().catch(() => 0);
      // A blank page, a stuck permission check or a bounce to /login is never "OK".
      const bodyText = ((await page.locator("body").innerText().catch(() => "")) || "").trim();
      if (!bodyText) notes.push("blank page (nothing rendered)");
      else if (/Verifying access/.test(bodyText) && bodyText.length < 200) notes.push("stuck on 'Verifying access'");
      if (new URL(page.url()).pathname === "/login") notes.push("redirected to /login (session rejected)");
      page.off("response", onResp);
      page.off("console", onConsole);
      page.off("pageerror", onPageError);

      // Console noise from failed fetches duplicates the network entries; keep the network ones.
      const realNotes = notes.filter((n) => !/Failed to load resource/.test(n));
      const unexpectedApi = failed.filter((f) => !f.startsWith("403 "));
      const subcall403 = failed.filter((f) => f.startsWith("403 "));
      let verdict: PageResult["verdict"];
      if (denied) verdict = "denied-expected";
      else if (unexpectedApi.length || realNotes.length) verdict = "error";
      else verdict = "ok";
      pageResults[role].push({
        route: p.route,
        pageKey: p.pageKey,
        verdict,
        notes: [...new Set([...unexpectedApi, ...subcall403.map((s) => `${s} (permission map)`), ...realNotes])].slice(0, 6),
      });
    }
    await ctx.close();
  }
  await browser.close();

  // ── Report ────────────────────────────────────────────────────────────────
  const out: string[] = [`# Per-role sweep — ${LABEL}`, "", `Run ${new Date().toISOString()} against ${BASE}. Matrix: \`${MATRIX}\`.`, ""];
  out.push("## API (GET routes)", "", "| Role | 2xx | 403 expected | 400/404 (generic params) | Errors |", "|---|---|---|---|---|");
  for (const role of ROLES) {
    const rs = api[role] ?? [];
    const c = (v: string) => rs.filter((r) => r.verdict === v).length;
    out.push(`| ${role} | ${c("ok")} | ${c("403-expected")} | ${c("param")} | ${c("error")} |`);
  }
  out.push("", "API errors:", "");
  for (const role of ROLES) for (const r of (api[role] ?? []).filter((x) => x.verdict === "error")) out.push(`- ${role} · GET ${r.path} → ${r.status} ${r.msg}`);

  const sym = { ok: "✅", "denied-expected": "🔒", error: "❌" } as const;
  out.push("", "## Pages", "", "✅ loads with no failed API calls or console errors · 🔒 Access Denied (role lacks the page permission) · ❌ error (details below). A 403 on a sub-call that the permission map denies is noted but not counted as an error.", "");
  out.push(`| Page | Key | ${ROLES.join(" | ")} |`, `|---|---|${ROLES.map(() => "---").join("|")}|`);
  const allPages = pageResults[ROLES[0]]?.map((p) => p.route) ?? [];
  for (const route of allPages) {
    const key = pageResults[ROLES[0]].find((p) => p.route === route)!.pageKey;
    out.push(`| \`${route}\` | ${key} | ${ROLES.map((r) => sym[pageResults[r]?.find((p) => p.route === route)?.verdict ?? "error"]).join(" | ")} |`);
  }
  out.push("", "### Page errors and notes", "");
  for (const role of ROLES) for (const p of pageResults[role] ?? []) {
    if (p.verdict === "error" || p.notes.length) out.push(`- **${role}** \`${p.route}\` ${sym[p.verdict]}: ${p.notes.join("; ")}`);
  }
  fs.mkdirSync("docs/verification", { recursive: true });
  const base = path.join("docs/verification", `role-sweep-${LABEL}`);
  fs.writeFileSync(base + ".md", out.join("\n") + "\n");
  fs.writeFileSync(base + ".json", JSON.stringify({ api, pages: pageResults }, null, 1));
  console.log(out.slice(0, 16).join("\n"));
  const pageErrs = Object.values(pageResults).flat().filter((p) => p.verdict === "error").length;
  console.log(`\npage errors: ${pageErrs} · wrote ${base}.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
