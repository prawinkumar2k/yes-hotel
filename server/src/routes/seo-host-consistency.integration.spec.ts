/**
 * Every address the site announces about itself (canonical, og:url, JSON-LD ids, sitemap, robots) uses ONE host:
 * https://yeshotels.in. Runs the real index.html through the injector and the real /sitemap.xml and /robots.txt routes
 * (isolated test database, see vitest.config.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { createServer } from "../../index";
import { RoomCategory } from "../models/RoomCategory";
import { SeoLandingPage, SeoPageType, SeoVerificationStatus } from "../models/SeoLandingPage";
import { injectSeoTagsIntoHtml } from "../services/seo-meta-injector.service";

const HOST = "yeshotels.in";
const ORIGIN = `https://${HOST}`;
const tag = String(new mongoose.Types.ObjectId()).slice(-6);
const areaSlug = `host-area-${tag}`;
const roomSlug = `host-room-${tag}`;
const indexHtml = fs.readFileSync(path.resolve(__dirname, "../../../index.html"), "utf8");
const savedClientUrl = process.env.CLIENT_URL;
let server: Server;
let base = "";

const PATHS = ["/", "/about", "/rooms", "/hotels-near", "/gallery", "/faq", "/contact", "/terms-and-conditions", "/privacy-policy", "/cancellation-and-refund", "/search", `/hotels-near/${areaSlug}`, `/rooms/${roomSlug}`];
const one = (html: string, re: RegExp) => { const m = [...html.matchAll(re)]; expect(m).toHaveLength(1); return m[0][1]; };
const urlFields = (node: any, key = "", out: { key: string; url: string }[] = []) => {
  if (typeof node === "string") { if (/^https?:\/\//.test(node) && key !== "@context") out.push({ key, url: node }); }
  else if (Array.isArray(node)) node.forEach((n) => urlFields(n, key, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) urlFields(v, k, out);
  return out;
};
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

beforeAll(async () => {
  process.env.CLIENT_URL = ORIGIN;
  const app = createServer();
  await new Promise<void>((r) => (server = app.listen(0, () => r())));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
  await SeoLandingPage.create({
    slug: areaSlug, targetLocality: `Host Area ${tag}`, destinationName: `Host Area ${tag}`, pageType: SeoPageType.IT_PARK, distanceKm: 2, distanceRouteDetails: "Along Hosur Main Road.",
    travelTimeMinutes: { car: 8, metro: 4 }, coordinates: { latitude: 12.8, longitude: 77.6 }, metaTitle: `Hotels Near Host Area ${tag}`, metaDescription: "Test description for the host consistency test, long enough to be a real sentence.",
    h1: `Hotel Near Host Area ${tag}`, h2Subheading: "Test", targetKeywords: ["test"], overviewContent: "Overview.", stayHighlights: ["Wi-Fi"], nearbyAttractions: [{ name: "Landmark", distanceKm: 1, category: "Landmark" }],
    faqs: [{ question: "Q?", answer: "A." }], verificationStatus: SeoVerificationStatus.VERIFIED, verificationSource: "Test", isPublished: true, canonicalUrl: `${ORIGIN}/hotels-near/${areaSlug}`, auditScore: 100,
  } as any);
  await RoomCategory.create({ slug: roomSlug, name: `Host Room ${tag}`, description: "A test room.", basePrice: 2500, isActive: true } as any);
});

afterAll(async () => {
  await SeoLandingPage.deleteMany({ slug: areaSlug });
  await RoomCategory.deleteMany({ slug: roomSlug });
  if (savedClientUrl === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = savedClientUrl;
  server?.close();
});

describe("canonical and og:url", () => {
  for (const p of PATHS) {
    it(`${p}: one canonical and one og:url, both on ${ORIGIN}, no trailing-slash page address, and they match`, async () => {
      const html = await injectSeoTagsIntoHtml(indexHtml, p);
      const canonical = one(html, /<link rel="canonical" href="([^"]*)"/g);
      const og = one(html, /<meta property="og:url" content="([^"]*)"/g);
      expect(canonical.startsWith(ORIGIN), canonical).toBe(true);
      expect(new URL(canonical).host).toBe(HOST);
      expect(canonical.endsWith("/") && new URL(canonical).pathname !== "/", canonical).toBe(false);
      expect(og).toBe(canonical);
      // Tags and page text only. JSON-LD sameAs is covered by the it.todo below (it depends on owner-modified files).
      const withoutJsonLd = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
      expect(withoutJsonLd).not.toContain("www.yeshotels.in");
    });
  }
  it("the trailing-slash address is announced as a duplicate by the injector, which is why the server redirects it (canonical-url middleware)", async () => {
    const html = await injectSeoTagsIntoHtml(indexHtml, "/rooms/");
    expect(one(html, /<link rel="canonical" href="([^"]*)"/g)).toBe(`${ORIGIN}/rooms/`);
  });
});

describe("JSON-LD", () => {
  for (const p of ["/", "/rooms", "/hotels-near", `/hotels-near/${areaSlug}`, `/rooms/${roomSlug}`, "/faq"]) {
    it(`${p}: the page's own ids and URLs (@id, url, logo, image, item) are all on ${ORIGIN}`, async () => {
      const html = await injectSeoTagsIntoHtml(indexHtml, p);
      const own = jsonLd(html).flatMap((b) => urlFields(b)).filter((f) => ["@id", "url", "logo", "image", "item"].includes(f.key));
      expect(own.length).toBeGreaterThan(0);
      for (const f of own) expect(f.url.startsWith(ORIGIN), `${f.key}: ${f.url}`).toBe(true);
    });
  }
  // Blocked: shared/hotel-info.ts (HOTEL.website is the www address) and the uncommitted sameAs/hasMap/aggregateRating draft in
  // seo-meta-injector.service.ts are owner-modified files. Once they are settled: sameAs must list https://yeshotels.in, not the www twin.
  it.todo("JSON-LD sameAs / website use https://yeshotels.in (HOTEL.website is currently the www address)");
});

describe("sitemap.xml and robots.txt", () => {
  it("every sitemap URL is on the canonical host, without trailing-slash duplicates or repeats", async () => {
    const xml = await (await fetch(`${base}/sitemap.xml`)).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(8);
    for (const l of locs) { expect(l.startsWith(`${ORIGIN}`), l).toBe(true); expect(l.endsWith("/") && new URL(l).pathname !== "/", l).toBe(false); }
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs).toContain(`${ORIGIN}/rooms/${roomSlug}`);
    expect(locs).toContain(`${ORIGIN}/hotels-near/${areaSlug}`);
    expect(xml).not.toContain("www.yeshotels.in");
  });
  it("robots.txt names the sitemap on the canonical host", async () => {
    const txt = await (await fetch(`${base}/robots.txt`)).text();
    const lines = txt.split(/\r?\n/).filter((l) => /^sitemap:/i.test(l));
    expect(lines).toEqual([`Sitemap: ${ORIGIN}/sitemap.xml`]);
  });
  it("the static copy of robots.txt (public/robots.txt) agrees", () => {
    const txt = fs.readFileSync(path.resolve(__dirname, "../../../public/robots.txt"), "utf8");
    expect(txt.split(/\r?\n/).filter((l) => /^sitemap:/i.test(l))).toEqual([`Sitemap: ${ORIGIN}/sitemap.xml`]);
  });
});
