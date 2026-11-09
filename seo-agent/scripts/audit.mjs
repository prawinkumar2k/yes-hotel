#!/usr/bin/env node
/**
 * Lightweight, read-only SEO audit of the live site.
 *   node seo-agent/scripts/audit.mjs   -> writes seo-agent/state/last-audit.json and prints a summary
 * No dependencies. Polite: sequential requests with a delay. Never writes to the site.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/seo-agent.config.json"), "utf8"));
const H = { "user-agent": cfg.crawl.userAgent };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalise = (u) => u.replace(/^https?:\/\/(www\.)?yeshotels\.in/, cfg.siteUrl);

async function get(url, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.crawl.timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: H, redirect: "manual", signal: ctl.signal, ...init });
    const body = init.method === "HEAD" ? "" : await res.text();
    return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type") || "", enc: res.headers.get("content-encoding"), cache: res.headers.get("cache-control"), ms: Date.now() - started, body };
  } catch (e) {
    return { status: 0, error: String(e.message || e), type: "", ms: Date.now() - started, body: "" };
  } finally {
    clearTimeout(t);
  }
}

const pick = (re, s) => (s.match(re) || [])[1]?.trim();

function analyse(url, r) {
  const html = r.body;
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ?? pick(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html);
  const descTags = (html.match(/<meta[^>]+name=["']description["']/gi) || []).length;
  const canonicalTags = (html.match(/<link[^>]+rel=["']canonical["']/gi) || []).length;
  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i, html);
  const robots = pick(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i, html);
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  const ldTypes = [];
  let ldInvalid = 0;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      for (const n of Array.isArray(j) ? j : [j]) {
        if (Array.isArray(n["@graph"])) for (const g of n["@graph"]) ldTypes.push(g["@type"]);
        else ldTypes.push(n["@type"]);
      }
    } catch {
      ldInvalid++;
    }
  }
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgNoAlt = imgs.filter((t) => !/\balt=/.test(t)).length;
  const links = [...new Set([...html.matchAll(/<a\b[^>]+href=["']([^"'#]+)["']/gi)].map((m) => m[1]))].filter(
    (h) => h.startsWith("/") || h.startsWith(cfg.siteUrl) || cfg.alternateHosts.some((a) => h.startsWith(a)),
  );
  const issues = [];
  if (r.status !== 200) issues.push(`HTTP ${r.status}`);
  if (!title) issues.push("missing <title>");
  else if (title.length > 65) issues.push(`title long (${title.length})`);
  if (!desc) issues.push("missing meta description");
  else if (desc.length > 170) issues.push(`description long (${desc.length})`);
  if (descTags > 1) issues.push(`${descTags} meta description tags (search engines may use the wrong one)`);
  if (canonicalTags > 1) issues.push(`${canonicalTags} canonical tags`);
  if (!canonical) issues.push("missing canonical");
  else if (!canonical.startsWith(cfg.canonicalHost)) issues.push(`canonical host differs from declared canonical host: ${canonical}`);
  if (/noindex/i.test(robots || "")) issues.push("noindex");
  if (h1s === 0) issues.push("no H1 in served HTML");
  else if (h1s > 1) issues.push(`${h1s} H1 tags`);
  if (ldInvalid) issues.push(`${ldInvalid} invalid JSON-LD block(s)`);
  if (imgNoAlt) issues.push(`${imgNoAlt} image(s) without alt`);
  if (!r.enc && r.type.includes("html") && html.length > 5000) issues.push("HTML not compressed");
  return { url, status: r.status, ms: r.ms, title, titleLen: title?.length ?? 0, description: desc, descLen: desc?.length ?? 0, canonical, robots, h1s, jsonLdTypes: ldTypes, images: imgs.length, imgNoAlt, internalLinks: links, issues };
}

const out = { ranAt: new Date().toISOString(), site: cfg.siteUrl, checks: {}, pages: [], duplicates: {}, brokenLinks: [], summary: {} };

const robots = await get(`${cfg.siteUrl}/robots.txt`);
out.checks.robots = {
  status: robots.status,
  sitemapLines: robots.body.split(/\r?\n/).filter((l) => /^sitemap:/i.test(l)),
  blocksAll: /^disallow:\s*\/\s*$/im.test(robots.body),
};
const sm = await get(`${cfg.siteUrl}/sitemap.xml`);
const smUrls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
out.checks.sitemap = { status: sm.status, urlCount: smUrls.length, hosts: [...new Set(smUrls.map((u) => new URL(u).origin))] };
out.checks.llmsTxt = { status: (await get(`${cfg.siteUrl}/llms.txt`)).status };

out.checks.hostVariants = {};
for (const h of [cfg.siteUrl, ...cfg.alternateHosts]) {
  const r = await get(h + "/", { method: "HEAD" });
  out.checks.hostVariants[h] = { status: r.status, redirectsTo: r.location || null };
  await sleep(cfg.crawl.delayMs);
}

const targets = [...new Set([...cfg.extraPaths.map((p) => cfg.siteUrl + p), ...smUrls.map(normalise)])];
for (const u of targets) {
  out.pages.push(analyse(u, await get(u)));
  await sleep(cfg.crawl.delayMs);
}

for (const k of ["title", "description"]) {
  const m = {};
  for (const p of out.pages.filter((p) => p.status === 200 && p[k])) (m[p[k]] ||= []).push(p.url);
  out.duplicates[k] = Object.values(m).filter((g) => g.length > 1);
}

const known = new Set(out.pages.map((p) => p.url));
const linkSet = new Set();
for (const p of out.pages) for (const l of p.internalLinks) linkSet.add(l.startsWith("/") ? cfg.siteUrl + l : normalise(l));
for (const l of [...linkSet].filter((l) => !known.has(l) && !/\.(png|jpe?g|webp|svg|mp4|ico)$/i.test(l)).slice(0, 60)) {
  const r = await get(l, { method: "HEAD" });
  if (r.status >= 400 || r.status === 0) out.brokenLinks.push({ url: l, status: r.status });
  await sleep(cfg.crawl.delayMs);
}

const bad = out.pages.filter((p) => p.issues.length);
out.summary = {
  pagesChecked: out.pages.length,
  pagesWithIssues: bad.length,
  non200: out.pages.filter((p) => p.status !== 200).length,
  brokenInternalLinks: out.brokenLinks.length,
  duplicateTitles: out.duplicates.title.length,
  duplicateDescriptions: out.duplicates.description.length,
};
fs.mkdirSync(path.join(root, "state"), { recursive: true });
fs.writeFileSync(path.join(root, "state/last-audit.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ summary: out.summary, checks: out.checks, issues: bad.map((p) => ({ url: p.url, issues: p.issues })), brokenLinks: out.brokenLinks, duplicates: out.duplicates }, null, 2));
