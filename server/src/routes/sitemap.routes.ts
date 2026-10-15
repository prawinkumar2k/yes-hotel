import { Router } from "express";
import { RoomCategory } from "../models/RoomCategory";
import { SeoLandingPage, SeoVerificationStatus } from "../models/SeoLandingPage";

const router = Router();

const STATIC_PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/about", priority: "0.8", changefreq: "monthly" },
  { path: "/rooms", priority: "0.9", changefreq: "daily" },
  { path: "/gallery", priority: "0.7", changefreq: "monthly" },
  { path: "/faq", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.7", changefreq: "monthly" },
  { path: "/search", priority: "0.8", changefreq: "daily" },
  { path: "/terms-and-conditions", priority: "0.3", changefreq: "yearly" },
  { path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  { path: "/cancellation-and-refund", priority: "0.3", changefreq: "yearly" },
];

/**
 * GET /sitemap.xml
 * Fully dynamic, database-backed XML sitemap that automatically includes:
 * 1. Marketing and legal pages
 * 2. Active room category detail pages (/rooms/:slug)
 * 3. Authoritative local SEO discovery pages (/hotels-near/:slug)
 */
router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = (process.env.CLIENT_URL || "https://yeshotels.in").replace(/\/$/, "");

    // 1. Static Pages
    const staticUrls = STATIC_PAGES.map(
      (p) => `  <url>
    <loc>${baseUrl}${p.path}</loc>
    <priority>${p.priority}</priority>
    <changefreq>${p.changefreq}</changefreq>
  </url>`
    );

    // 2. Room Categories
    const categories = await RoomCategory.find({ isActive: true }).select("slug updatedAt").lean();
    const categoryUrls = categories.map(
      (c: any) => `  <url>
    <loc>${baseUrl}/rooms/${c.slug}</loc>
    <priority>0.85</priority>
    <changefreq>weekly</changefreq>${c.updatedAt ? `\n    <lastmod>${new Date(c.updatedAt).toISOString().slice(0, 10)}</lastmod>` : ""}
  </url>`
    );

    // 3. Verified SEO Landing Pages (Corridor Bommasandra to Bommanahalli)
    const seoPages = await SeoLandingPage.find({
      isPublished: true,
      verificationStatus: SeoVerificationStatus.VERIFIED,
    })
      .select("slug updatedAt")
      .lean();

    const seoUrls = seoPages.map(
      (p: any) => `  <url>
    <loc>${baseUrl}/hotels-near/${p.slug}</loc>
    <priority>0.9</priority>
    <changefreq>weekly</changefreq>${p.updatedAt ? `\n    <lastmod>${new Date(p.updatedAt).toISOString().slice(0, 10)}</lastmod>` : ""}
  </url>`
    );

    const allUrls = [...staticUrls, ...categoryUrls, ...seoUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUrls.join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=14400");
    return res.status(200).send(xml);
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /robots.txt
 * Dynamic robots.txt that always uses the canonical production domain.
 */
router.get("/robots.txt", (req, res) => {
  const baseUrl = (process.env.CLIENT_URL || "https://yeshotels.in").replace(/\/$/, "");
  const robots = `User-agent: *
Allow: /
Allow: /hotels-near/
Allow: /rooms/
Allow: /about
Allow: /gallery
Allow: /faq
Allow: /contact
Allow: /search
Allow: /sitemap.xml

# Disallow private, staff, and transactional endpoints from indexation
Disallow: /admin
Disallow: /staff
Disallow: /customer
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /booking/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(200).send(robots);
});

export default router;
