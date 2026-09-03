import { Router } from "express";
import { RoomCategory } from "../models/RoomCategory";

const router = Router();

const STATIC_PAGES: { path: string; priority: string }[] = [
  { path: "/", priority: "1.0" },
  { path: "/about", priority: "0.8" },
  { path: "/rooms", priority: "0.9" },
  { path: "/gallery", priority: "0.7" },
  { path: "/faq", priority: "0.5" },
  { path: "/contact", priority: "0.6" },
  { path: "/search", priority: "0.8" },
  { path: "/terms-and-conditions", priority: "0.3" },
  { path: "/privacy-policy", priority: "0.3" },
  { path: "/cancellation-and-refund", priority: "0.3" },
];

// GET /sitemap.xml — dynamic, not the previous static file that only ever
// listed the fixed marketing routes. Now includes every real, published
// room category page (/rooms/:slug), generated from the live database each
// time it's requested rather than going stale the moment a room category is
// added/renamed/deactivated.
router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = (process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const categories = await RoomCategory.find({ isActive: true }).select("slug updatedAt").lean();

    const urls = [
      ...STATIC_PAGES.map((p) => `  <url><loc>${baseUrl}${p.path}</loc><priority>${p.priority}</priority></url>`),
      ...categories.map(
        (c: any) =>
          `  <url><loc>${baseUrl}/rooms/${c.slug}</loc><priority>0.7</priority>${
            c.updatedAt ? `<lastmod>${new Date(c.updatedAt).toISOString().slice(0, 10)}</lastmod>` : ""
          }</url>`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml");
    return res.status(200).send(xml);
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
