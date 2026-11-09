#!/usr/bin/env node
/**
 * Read-only audit of hostname / redirect behaviour for www vs non-www, http vs https, trailing slashes.
 *   node seo-agent/scripts/host-audit.mjs            -> prints a summary, writes <data dir>/state/host-audit.json
 * Only GET requests, one at a time, 300 ms apart. It changes nothing on the site.
 * Re-run it after any redirect change to verify the matrix with real responses.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/seo-agent.config.json"), "utf8"));
const DATA = process.env.SEO_AGENT_DATA_DIR ? path.resolve(process.env.SEO_AGENT_DATA_DIR) : root;
const APEX = process.env.SEO_AGENT_APEX || "yeshotels.in";
const WWW = `www.${APEX}`;
const PREFERRED = `https://${APEX}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { "user-agent": cfg.crawl.userAgent };
const MAX_HOPS = 6;

async function hop(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.crawl.timeoutMs);
  try {
    const res = await fetch(url, { headers: H, redirect: "manual", signal: ctl.signal });
    return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type") || "", hsts: res.headers.get("strict-transport-security"), body: res.status >= 300 && res.status < 400 ? "" : await res.text() };
  } catch (e) {
    return { status: 0, error: String(e.cause?.code || e.message), body: "" };
  } finally {
    clearTimeout(t);
  }
}

const urlStrings = (node, key = "", out = []) => {
  if (typeof node === "string") { if (/^https?:\/\//.test(node)) out.push({ key, url: node }); }
  else if (Array.isArray(node)) node.forEach((n) => urlStrings(n, key, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) urlStrings(v, k, out);
  return out;
};

function inspect(html) {
  const pick = (re) => (html.match(re) || [])[1]?.trim();
  const ld = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { urlStrings(JSON.parse(m[1]), "", ld); } catch { /* ignore */ } }
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(/<meta\s+name="description"\s+content="([^"]*)"/i),
    canonical: pick(/<link\s+rel="canonical"\s+href="([^"]*)"/i),
    ogUrl: pick(/<meta\s+property="og:url"\s+content="([^"]*)"/i) ?? null,
    robots: pick(/<meta\s+name="robots"\s+content="([^"]*)"/i),
    jsonLdUrls: ld,
    sha: crypto.createHash("sha256").update(html).digest("hex").slice(0, 16),
    bytes: Buffer.byteLength(html),
  };
}

async function follow(start) {
  const chain = [];
  const seen = new Set();
  let url = start, last = null, problem = null;
  for (let i = 0; i <= MAX_HOPS; i++) {
    if (seen.has(url)) { problem = "redirect loop"; break; }
    seen.add(url);
    last = await hop(url);
    chain.push({ url, status: last.status, location: last.location || null, error: last.error });
    await sleep(300);
    if (last.status >= 300 && last.status < 400 && last.location) { url = new URL(last.location, url).toString(); continue; }
    break;
  }
  if (!problem && chain.length > MAX_HOPS) problem = "too many redirects";
  const final = chain[chain.length - 1];
  return { start, chain, hops: chain.filter((c) => c.status >= 300 && c.status < 400).length, finalUrl: final.url, finalStatus: final.status, problem, ...(last && last.status === 200 ? inspect(last.body) : {}) };
}

// ---- which URLs to test ----
const smBody = (await (await fetch(`${PREFERRED}/sitemap.xml`, { headers: H })).text().catch(() => ""));
const smPaths = [...smBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const pick = (re) => smPaths.find((p) => re.test(p));
const routes = [...new Set(["/", "/rooms", "/rooms/", "/hotels-near", "/hotels-near/begur", "/hotels-near/begur/", "/about", "/contact", pick(/^\/rooms\/[^/]+$/), pick(/^\/hotels-near\/hosa-road$/), "/privacy-policy", "/sitemap.xml", "/robots.txt"].filter(Boolean))];
const origins = [`http://${APEX}`, `http://${WWW}`, `https://${APEX}`, `https://${WWW}`];

const matrix = [];
for (const o of origins) for (const r of routes) matrix.push({ origin: o, route: r, ...(await follow(o + r)) });

// ---- content equivalence between the two https hosts ----
const equivalence = routes.map((r) => {
  const a = matrix.find((m) => m.origin === `https://${APEX}` && m.route === r), b = matrix.find((m) => m.origin === `https://${WWW}` && m.route === r);
  return { route: r, apexStatus: a?.finalStatus, wwwStatus: b?.finalStatus, sameBytes: a?.sha && b?.sha ? a.sha === b.sha : null, sameCanonical: a?.canonical === b?.canonical };
});

// ---- TLS ----
const certOf = (host) => new Promise((resolve) => {
  const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true, timeout: 15000 }, () => {
    const c = s.getPeerCertificate();
    resolve({ host, trusted: s.authorized, subject: c.subject?.CN, san: c.subjectaltname, issuer: c.issuer?.O, validFrom: c.valid_from, validTo: c.valid_to, daysLeft: Math.floor((new Date(c.valid_to) - Date.now()) / 864e5), protocol: s.getProtocol() });
    s.end();
  });
  s.on("error", (e) => resolve({ host, trusted: false, error: e.code || e.message }));
  s.on("timeout", () => { s.destroy(); resolve({ host, trusted: false, error: "timeout" }); });
});
const certs = [await certOf(APEX), await certOf(WWW)];

// ---- verdicts ----
const preferredHost = new URL(PREFERRED).host;
const findings = [];
const noRedirectBetweenHosts = matrix.filter((m) => m.origin === `https://${WWW}` && m.finalStatus === 200 && new URL(m.finalUrl).host === WWW).length;
if (noRedirectBetweenHosts) findings.push(`https://${WWW} serves ${noRedirectBetweenHosts} of ${routes.length} tested routes with 200 and no redirect to ${preferredHost}`);
for (const m of matrix.filter((m) => m.problem)) findings.push(`${m.start}: ${m.problem}`);
const wrongCanon = matrix.filter((m) => m.finalStatus === 200 && m.canonical && !m.canonical.startsWith(PREFERRED));
if (wrongCanon.length) findings.push(`${wrongCanon.length} responses have a canonical outside ${PREFERRED}`);
const slash = matrix.filter((m) => m.origin === `https://${APEX}` && m.route.length > 1 && m.route.endsWith("/") && m.finalStatus === 200 && m.canonical?.endsWith("/"));
if (slash.length) findings.push(`trailing-slash URLs answer 200 with a self-canonical slash URL (duplicates): ${slash.map((m) => m.route).join(", ")}`);
const mixedLd = matrix.filter((m) => m.finalStatus === 200 && m.jsonLdUrls?.some((u) => new URL(u.url).host === WWW));
if (mixedLd.length) findings.push(`${mixedLd.length} responses have www URLs inside JSON-LD`);
const noOg = matrix.filter((m) => m.origin === `https://${APEX}` && m.finalStatus === 200 && m.ogUrl === null && m.type !== "x");
const htmlOnly = noOg.filter((m) => m.title);
if (htmlOnly.length) findings.push(`og:url is missing on ${htmlOnly.length} HTML pages (https://${APEX})`);

const out = { ranAt: new Date().toISOString(), preferred: PREFERRED, routes, matrix, equivalence, certs, findings };
fs.mkdirSync(path.join(DATA, "state"), { recursive: true });
fs.writeFileSync(path.join(DATA, "state/host-audit.json"), JSON.stringify(out, null, 2));

console.log("=== Redirect matrix (start -> hops -> final) ===");
for (const m of matrix) console.log(`${m.start.padEnd(58)} ${String(m.hops).padStart(1)} hop(s) -> ${m.finalStatus} ${m.finalUrl}${m.problem ? "  [" + m.problem + "]" : ""}`);
console.log("\n=== Same content on both https hosts? ===");
for (const e of equivalence) console.log(`${e.route.padEnd(34)} apex ${e.apexStatus} | www ${e.wwwStatus} | identical bytes: ${e.sameBytes} | same canonical: ${e.sameCanonical}`);
console.log("\n=== TLS ===");
for (const c of certs) console.log(JSON.stringify(c));
console.log("\n=== Findings ===");
for (const f of findings) console.log("- " + f);
