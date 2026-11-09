#!/usr/bin/env node
/**
 * Daily SEO run (target: 09:00 Asia/Kolkata). Safe and read-only against the live site:
 *   node seo-agent/scripts/run-daily.mjs
 * 1. takes a lock so runs never overlap   2. runs the audit   3. compares with the previous audit
 * 4. writes reports/daily/YYYY-MM-DD.md   5. updates state/state.json
 * It never edits the website and never deploys. Implementation work happens in a reviewed session.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...a) => path.join(root, ...a);
const cfg = JSON.parse(fs.readFileSync(p("config/seo-agent.config.json"), "utf8"));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: cfg.timezone }).format(new Date());
const nowLocal = new Intl.DateTimeFormat("en-GB", { timeZone: cfg.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date());
const log = (m) => { fs.mkdirSync(p("logs"), { recursive: true }); fs.appendFileSync(p("logs", `${today}.log`), `${new Date().toISOString()} ${m}\n`); console.log(m); };

// --- lock (a stale lock older than 30 minutes is ignored) ---
const lock = p("state/run.lock");
fs.mkdirSync(p("state"), { recursive: true });
if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 30 * 60 * 1000) { log("Another run is in progress; exiting."); process.exit(0); }
fs.writeFileSync(lock, String(process.pid));
const release = () => { try { fs.unlinkSync(lock); } catch {} };
process.on("exit", release);

const read = (f, d) => { try { return JSON.parse(fs.readFileSync(p(f), "utf8")); } catch { return d; } };
const prev = read("state/last-audit.json", null);
const state = read("state/state.json", { firstRun: today, history: [] });

let status = "ok", failure = "";
try {
  execFileSync(process.execPath, [p("scripts/audit.mjs")], { stdio: "ignore", timeout: 10 * 60 * 1000 });
} catch (e) {
  status = "failed"; failure = String(e.message || e); log(`Audit failed: ${failure}`);
}
const audit = read("state/last-audit.json", null);
const queue = read("tasks/queue.json", { tasks: [] });

const lines = [];
const L = (s = "") => lines.push(s);
L("# YES HOTEL — DAILY SEO REPORT"); L();
L(`Date: ${today}`); L(`Execution time: ${nowLocal} (${cfg.timezone})`); L(`Website: ${cfg.siteUrl} (canonical host: ${cfg.canonicalHost})`);
L(`Agent execution status: ${status === "ok" ? "Completed (read-only audit; no website changes made by the scheduled run)" : "FAILED: " + failure}`); L();
L("## 1. Search Performance");
L("- Clicks: Unavailable — access or data pending.");
L("- Impressions: Unavailable — access or data pending.");
L("- CTR: Unavailable — access or data pending.");
L("- Average position: Unavailable — access or data pending.");
L("- Data freshness: Search Console is not connected (task SEO-007).");
L();
L("## 2. Google Maps / Local SEO");
L("- Business profile status: Unavailable — access or data pending (task SEO-008).");
L("- Local SEO findings (from the website only): see Technical SEO. Address, phone and Maps link come from shared/hotel-info.ts.");
L("- Review monitoring: Unavailable — access or data pending.");
L("- Recommended actions: connect Business Profile access; verify the review numbers before they appear in structured data (SEO-004).");
L();
L("## 3. Technical SEO");
if (audit) {
  const s = audit.summary;
  L(`- Pages checked: ${s.pagesChecked}; HTTP errors: ${s.non200}; broken internal links: ${s.brokenInternalLinks}; duplicate titles groups: ${s.duplicateTitles}.`);
  L(`- robots.txt: HTTP ${audit.checks.robots.status}; sitemap: HTTP ${audit.checks.sitemap.status}, ${audit.checks.sitemap.urlCount} URLs; llms.txt: HTTP ${audit.checks.llmsTxt.status}.`);
  L(`- Host variants: ${Object.entries(audit.checks.hostVariants).map(([h, v]) => `${h} → ${v.status}${v.redirectsTo ? " redirects to " + v.redirectsTo : " (no redirect)"}`).join("; ")}.`);
  const counts = {};
  for (const pg of audit.pages) for (const i of pg.issues) { const k = i.replace(/\d+/g, "#").replace(/https?:\S+/, "…"); counts[k] = (counts[k] || 0) + 1; }
  L("- Issues detected (count of pages):");
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) L(`  - ${k}: ${v}`);
  if (prev && prev.ranAt !== audit.ranAt) {
    const was = prev.pages.reduce((n, pg) => n + pg.issues.length, 0), now = audit.pages.reduce((n, pg) => n + pg.issues.length, 0);
    L(`- Change since previous audit (${prev.ranAt.slice(0, 10)}): total issue count ${was} → ${now}.`);
  }
} else L("- Audit data unavailable.");
L("- Issues fixed: see section 4."); L("- Pending issues: see the task queue (seo-agent/tasks/queue.json).");
L();
L("## 4. Website Changes");
L("- The scheduled run itself changes nothing. Changes are made in reviewed sessions and recorded in seo-agent/state/state.json history.");
for (const h of state.history.slice(-5)) L(`- ${h.date}: ${h.summary}`);
L();
L("## 5. Content Optimization"); L("- Content reviewed: metadata of all public pages (titles, descriptions, headings, schema types)."); L("- Content updated: none by the scheduled run."); L("- Drafts created: none yet. Only verified hotel facts from shared/hotel-info.ts may be used.");
L();
L("## 6. Testing"); L("- Tests executed: live audit (HTTP, metadata, canonical, robots, sitemap, JSON-LD, links)."); L("- Build status: not run by the scheduled run.");
L();
L("## 7. Approval Required");
for (const t of queue.tasks.filter((t) => t.status === "awaiting-approval" || t.status === "implemented-locally")) L(`- ${t.id} (${t.priority}): ${t.name} — ${t.approvalNeeded || (t.dependencies || []).join("; ") || "owner decision"}. Risk: ${t.risk}.`);
L();
const open = queue.tasks.filter((t) => !["done"].includes(t.status)).sort((a, b) => a.priority.localeCompare(b.priority));
L("## 8. Next Execution"); L(`- Highest-priority open task: ${open[0] ? `${open[0].id} ${open[0].name} [${open[0].status}]` : "none"}.`); L("- Planned: re-run the audit; verify SEO-001 once deployed; continue with the next unblocked task.");
L();
L("## 9. Summary");
L(`- Completed: audit run. In progress: ${queue.tasks.filter((t) => t.status === "implemented-locally").map((t) => t.id).join(", ") || "none"}. Blocked: ${queue.tasks.filter((t) => t.status === "blocked").map((t) => t.id).join(", ") || "none"}.`);
L(`- Overall status: ${status === "ok" ? "Baseline established; search and local data pending access." : "Run failed; see logs."}`);

fs.mkdirSync(p("reports/daily"), { recursive: true });
fs.writeFileSync(p("reports/daily", `${today}.md`), lines.join("\n") + "\n");
state.lastExecution = new Date().toISOString();
state.lastExecutionStatus = status;
if (status === "ok") state.lastSuccessfulAudit = audit?.ranAt;
state.lastSearchConsoleSync = null;
fs.writeFileSync(p("state/state.json"), JSON.stringify(state, null, 2));
log(`Report written: reports/daily/${today}.md (${status})`);
