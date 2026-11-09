/**
 * Regression test for SEO-001: every page must carry exactly ONE <meta name="description">, and it must be the
 * page's own. This runs the REAL index.html (not a mock) through the injector, because the bug came from the way
 * index.html itself was formatted (the tag split over several lines was not found and a second one was appended).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { RoomCategory } from "../models/RoomCategory";
import { SeoLandingPage, SeoPageType, SeoVerificationStatus } from "../models/SeoLandingPage";
import { injectSeoTagsIntoHtml } from "../services/seo-meta-injector.service";

const tag = String(new mongoose.Types.ObjectId()).slice(-6);
const areaSlug = `desc-area-${tag}`;
const roomSlug = `desc-room-${tag}`;
const areaDescription = `Looking for hotels near the test area ${tag}? YES HOTELS is minutes away at Hosa Road Junction. Book direct!`;
const indexHtml = fs.readFileSync(path.resolve(__dirname, "../../../index.html"), "utf8");

const count = (html: string, re: RegExp) => (html.match(re) || []).length;
const descriptions = (html: string) => [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"/g)].map((m) => m[1]);
const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

beforeAll(async () => {
  // Always the isolated test database (vitest.config.ts sets MONGODB_URI to yes_hotels_test).
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI!);
  await mongoose.connection.asPromise();
  await SeoLandingPage.create({
    slug: areaSlug,
    targetLocality: `Test Area ${tag}`,
    destinationName: `Test Area ${tag}`,
    pageType: SeoPageType.IT_PARK,
    distanceKm: 2.8,
    distanceRouteDetails: "Along Hosur Main Road.",
    travelTimeMinutes: { car: 8, metro: 4 },
    coordinates: { latitude: 12.8452, longitude: 77.6602 },
    metaTitle: `Hotels Near Test Area ${tag} | YES HOTELS`,
    metaDescription: areaDescription,
    h1: `Hotel Near Test Area ${tag}`,
    h2Subheading: "Test",
    targetKeywords: ["hotel near test area"],
    overviewContent: "Overview text for the test area.",
    stayHighlights: ["Free Wi-Fi", "24-Hour Front Desk"],
    nearbyAttractions: [{ name: "Test Landmark", distanceKm: 1, category: "Landmark" }],
    faqs: [{ question: "Is Wi-Fi free?", answer: "Yes, Wi-Fi is complimentary." }],
    verificationStatus: SeoVerificationStatus.VERIFIED,
    verificationSource: "Test",
    isPublished: true,
    canonicalUrl: `https://yeshotels.in/hotels-near/${areaSlug}`,
    auditScore: 100,
  } as any);
  await RoomCategory.create({ slug: roomSlug, name: `Test Room ${tag}`, description: "A test room.", basePrice: 2500, isActive: true } as any);
});

afterAll(async () => {
  await SeoLandingPage.deleteMany({ slug: areaSlug });
  await RoomCategory.deleteMany({ slug: roomSlug });
  await mongoose.disconnect();
});

const PUBLIC_PATHS = ["/", "/about", "/rooms", "/hotels-near", "/gallery", "/faq", "/contact", "/terms-and-conditions", "/privacy-policy", "/cancellation-and-refund"];

describe("one meta description per page (real index.html)", () => {
  it("index.html keeps the description tag on one line, which is what the injector searches for", () => {
    expect(indexHtml).toContain('<meta name="description"');
  });

  for (const p of [...PUBLIC_PATHS, "/search"]) {
    it(`${p}: exactly one description, og/twitter description match it, one canonical, one title`, async () => {
      const html = await injectSeoTagsIntoHtml(indexHtml, p);
      const d = descriptions(html);
      expect(d).toHaveLength(1);
      expect(count(html, /<meta\s+name="description"/g)).toBe(1);
      expect(count(html, /<meta\s+property="og:description"/g)).toBe(1);
      expect(count(html, /<meta\s+name="twitter:description"/g)).toBe(1);
      expect(count(html, /<link\s+rel="canonical"/g)).toBe(1);
      expect(count(html, /<title>/g)).toBe(1);
      expect(html).toContain(`<meta property="og:description" content="${d[0]}" />`);
      expect(d[0].length).toBeGreaterThan(50);
    });
  }

  it("the home page receives its own intended description (the injector's home text, with the hotel phone), not index.html's generic one", async () => {
    const html = await injectSeoTagsIntoHtml(indexHtml, "/");
    const d = unescape(descriptions(html)[0]);
    expect(d).toMatch(/^Book direct at YES HOTELS, Hosa Road Junction, Bengaluru: .*Call \+91 87698 28787\.$/);
    expect(d).not.toMatch(/^YES HOTELS — a contemporary boutique hotel/);
  });

  it("pages without their own text (about, faq, contact...) keep index.html's generic description, exactly once", async () => {
    const html = await injectSeoTagsIntoHtml(indexHtml, "/about");
    expect(unescape(descriptions(html)[0])).toMatch(/^YES HOTELS — a contemporary boutique hotel at Hosa Road Junction.*Call \+91 87698 28787\.$/);
  });

  it("an area page gets its own description, not the home one", async () => {
    const html = await injectSeoTagsIntoHtml(indexHtml, `/hotels-near/${areaSlug}`);
    expect(descriptions(html)).toHaveLength(1);
    expect(unescape(descriptions(html)[0])).toBe(areaDescription);
    expect(html).toContain(`<link rel="canonical" href="https://yeshotels.in/hotels-near/${areaSlug}" />`);
  });

  it("a room page gets its own description built from the room, not the home one", async () => {
    const html = await injectSeoTagsIntoHtml(indexHtml, `/rooms/${roomSlug}`);
    expect(descriptions(html)).toHaveLength(1);
    expect(unescape(descriptions(html)[0])).toBe(`Test Room ${tag} at YES HOTELS, Hosa Road Junction, Bengaluru: air-conditioned, free Wi-Fi, 24-hour front desk. Rooms from ₹2,500 per night. Book direct.`);
  });

  it("the old multi-line formatting of the tag is what produced the duplicate (the test would have caught it)", async () => {
    const multiline = indexHtml.replace(/<meta name="description" content="([^"]*)" \/>/, '<meta\n      name="description"\n      content="$1"\n    />');
    expect(multiline).not.toBe(indexHtml);
    const html = await injectSeoTagsIntoHtml(multiline, "/rooms");
    expect(count(html, /<meta\s+name="description"/g)).toBe(2);
  });

  it("private areas and the search page keep their robots directives", async () => {
    expect(await injectSeoTagsIntoHtml(indexHtml, "/search")).toContain('<meta name="robots" content="noindex, follow" />');
    expect(await injectSeoTagsIntoHtml(indexHtml, "/admin/front-desk")).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});
