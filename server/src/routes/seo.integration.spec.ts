import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "../../index";
import { getJwtSecret } from "../config/jwt";
import { SeoLandingPage, SeoPageType, SeoVerificationStatus } from "../models/SeoLandingPage";
import { injectSeoTagsIntoHtml } from "../services/seo-meta-injector.service";
import { calculateSeoAuditScore } from "../controllers/seo.controller";

const oid = () => new mongoose.Types.ObjectId();
const tag = String(oid()).slice(-6);
const adminUser = oid();
let server: Server;
let base = "";
const db = () => mongoose.connection.db!;
const adminToken = () =>
  jwt.sign({ id: String(adminUser), role: "ADMIN" }, getJwtSecret(), { expiresIn: "10m" });

const testSlug = `test-locality-${tag}`;

beforeAll(async () => {
  const app = createServer();
  await new Promise<void>((r) => {
    server = app.listen(0, () => r());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();

  // Create an Admin user
  await db()
    .collection("users")
    .insertOne({
      _id: adminUser,
      role: "ADMIN",
      firstName: "SEO",
      lastName: "Admin",
      email: `seo-admin-${tag}@test.local`,
      passwordHash: "x",
      isActive: true,
    });

  // Seed a sample verified SEO landing page for integration tests
  await SeoLandingPage.create({
    slug: testSlug,
    targetLocality: `Electronic City ${tag}`,
    destinationName: `Electronic City Phase 1 ${tag}`,
    pageType: SeoPageType.IT_PARK,
    distanceKm: 2.8,
    distanceRouteDetails: "Direct connection along Hosur Main Road or via Yellow Line Metro.",
    travelTimeMinutes: { car: 8, metro: 4 },
    coordinates: { latitude: 12.8452, longitude: 77.6602 },
    metaTitle: "Hotels Near Electronic City Bengaluru | YES HOTELS from ₹1,400",
    metaDescription:
      "Looking for hotels near Electronic City? YES HOTELS is 8 mins away at Hosa Road Junction. Clean AC rooms, fast Wi-Fi, work desks, 24h desk & free parking. Book direct!",
    h1: "Premium Boutique Hotel Near Electronic City, Bengaluru",
    h2Subheading: "Convenient Corporate Accommodation for Electronic City Phase 1 & Phase 2",
    targetKeywords: ["hotels near electronic city", "rooms near electronic city phase 1"],
    overviewContent:
      "Welcome to YES HOTELS, situated just 2.8 km north of Electronic City at Hosa Road Junction. Our boutique property provides spotlessly maintained air-conditioned rooms, elevator access, free parking, and 24-hour reception.",
    stayHighlights: [
      "2.8 km from Electronic City Phase 1",
      "24-Hour Front Desk and elevator access",
      "Complimentary high-speed Wi-Fi and parking",
    ],
    nearbyAttractions: [{ name: "Infosys Campus", distanceKm: 3.2, category: "IT Campus" }],
    faqs: [
      {
        question: "How far is the hotel from Electronic City?",
        answer: "The hotel is 2.8 km away via Hosur Main Road, about 8 minutes by car.",
      },
      {
        question: "Is high-speed Wi-Fi provided in all rooms?",
        answer: "Yes, fast complimentary Wi-Fi is available throughout the property.",
      },
    ],
    verificationStatus: SeoVerificationStatus.VERIFIED,
    verificationSource: "Ground Truth Distance Audit",
    isPublished: true,
    canonicalUrl: `https://yeshotels.in/hotels-near/${testSlug}`,
    auditScore: 100,
  });
});

afterAll(async () => {
  await SeoLandingPage.deleteMany({ slug: testSlug });
  await db().collection("users").deleteOne({ _id: adminUser });
  server?.close();
});

describe("Local SEO & Discovery Engine Integration Tests", () => {
  it("GET /api/seo/pages returns published verified pages", async () => {
    const res = await fetch(`${base}/api/seo/pages`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    const found = json.data.find((p: any) => p.slug === testSlug);
    expect(found).toBeDefined();
    expect(found.distanceKm).toBe(2.8);
  });

  it("GET /api/seo/pages/:slug returns complete page data with room categories", async () => {
    const res = await fetch(`${base}/api/seo/pages/${testSlug}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.slug).toBe(testSlug);
    expect(json.data.hotelFacts).toBeDefined();
    expect(json.data.hotelFacts.name).toBe("YES HOTELS");
    expect(Array.isArray(json.data.faqs)).toBe(true);
    expect(json.data.faqs.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(json.data.roomCategories)).toBe(true);
  });

  it("POST /api/seo/track-start tracks booking clicks on landing page", async () => {
    const res = await fetch(`${base}/api/seo/track-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: testSlug }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const doc = await SeoLandingPage.findOne({ slug: testSlug });
    expect(doc?.analytics?.bookingStarts).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/seo/admin/audit performs automated quality check", async () => {
    const res = await fetch(`${base}/api/seo/admin/audit`, {
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.summary).toBeDefined();
    expect(json.data.summary.totalPages).toBeGreaterThanOrEqual(1);
    expect(json.data.summary.averageScore).toBeGreaterThanOrEqual(70);
  });

  it("GET /sitemap.xml includes verified SEO landing page URLs", async () => {
    const res = await fetch(`${base}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();

    expect(xml).toContain("<urlset");
    expect(xml).toContain(`<loc>https://yeshotels.in/hotels-near/${testSlug}</loc>`);
    expect(xml).toContain("<loc>https://yeshotels.in/</loc>");
    expect(xml).toContain("<priority>0.9</priority>");
  });

  it("GET /robots.txt serves correct directives and canonical sitemap", async () => {
    const res = await fetch(`${base}/robots.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();

    expect(text).toContain("Allow: /hotels-near/");
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Sitemap: https://yeshotels.in/sitemap.xml");
  });

  it("injectSeoTagsIntoHtml enriches HTML with title, description, canonical and Schema.org", async () => {
    const mockHtml = `<!doctype html><html><head><title>Original</title></head><body><div id="root"></div></body></html>`;
    const enriched = await injectSeoTagsIntoHtml(mockHtml, `/hotels-near/${testSlug}`);

    expect(enriched).toContain("<title>Hotels Near Electronic City Bengaluru | YES HOTELS from ₹1,400 | YES HOTELS</title>");
    expect(enriched).toContain(`<link rel="canonical" href="https://yeshotels.in/hotels-near/${testSlug}" />`);
    expect(enriched).toContain('application/ld+json');
    expect(enriched).toContain('"@type": "Hotel"');
    expect(enriched).toContain('"@type": "FAQPage"');
    expect(enriched).toContain('"@type": "BreadcrumbList"');
  });

  it("calculateSeoAuditScore accurately evaluates pages and flags defects", () => {
    // Perfect page
    const good = calculateSeoAuditScore({
      metaTitle: "Hotels Near Electronic City Bengaluru | YES HOTELS from ₹1,400",
      metaDescription:
        "Looking for hotels near Electronic City? YES HOTELS is 8 mins away at Hosa Road Junction. Clean AC rooms, fast Wi-Fi, work desks, 24h desk & free parking. Book direct!",
      h1: "Premium Boutique Hotel Near Electronic City, Bengaluru",
      overviewContent:
        "Welcome to YES HOTELS, situated just 2.8 km north of Electronic City at Hosa Road Junction. Our boutique property provides spotlessly maintained air-conditioned rooms, elevator access, free parking, and 24-hour reception. Whether you are traveling for business meetings at Infosys, Wipro, Tech Mahindra, or attending conferences across the South Bengaluru tech corridor, our hotel offers quiet, peaceful, and dependable accommodation. Skip the intense traffic inside the electronic city tech parks while remaining just an eight minute drive or a single metro stop away on the Yellow Line. Every guest room includes modern individual air-conditioning, private bathroom with round-the-clock hot water, complimentary high-speed Wi-Fi, work desks, and electric kettles with tea and coffee supplies. Our 24-hour reception team is always available to assist with early check-ins, late arrivals, luggage storage, and formal GST tax invoices on checkout. Book directly on our official website for the guaranteed lowest rates without any middleman fees.",
      distanceKm: 2.8,
      distanceRouteDetails: "Direct connection along Hosur Main Road or via Yellow Line Metro.",
      travelTimeMinutes: { car: 8, metro: 4 },
      coordinates: { latitude: 12.8452, longitude: 77.6602 },
      verificationStatus: SeoVerificationStatus.VERIFIED,
      faqs: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ],
    });
    expect(good.score).toBe(100);
    expect(good.issues.length).toBe(0);

    // Defective page
    const bad = calculateSeoAuditScore({
      metaTitle: "Short",
      metaDescription: "Short",
      h1: "",
      overviewContent: "Too few words",
      distanceKm: -1,
      verificationStatus: SeoVerificationStatus.PENDING,
      faqs: [],
    });
    expect(bad.score).toBeLessThan(50);
    expect(bad.issues.length).toBeGreaterThan(4);
  });
});
