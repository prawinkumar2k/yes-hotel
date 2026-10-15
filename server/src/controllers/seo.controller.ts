import { Request, Response } from "express";
import { SeoLandingPage, SeoPageType, SeoVerificationStatus, ISeoLandingPage } from "../models/SeoLandingPage";
import { RoomCategory } from "../models/RoomCategory";
import { HOTEL } from "../../../shared/hotel-info";
import { logger } from "../services/logger.service";

/**
 * Calculates a rigorous technical SEO health score (0-100) for a landing page.
 */
export function calculateSeoAuditScore(page: Partial<ISeoLandingPage>): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // 1. Meta Title checks
  if (!page.metaTitle || page.metaTitle.trim().length === 0) {
    issues.push("Missing meta title");
    score -= 20;
  } else if (page.metaTitle.length < 30) {
    issues.push(`Meta title too short (${page.metaTitle.length} chars; min 30 recommended)`);
    score -= 8;
  } else if (page.metaTitle.length > 70) {
    issues.push(`Meta title too long (${page.metaTitle.length} chars; max 70 recommended)`);
    score -= 8;
  }

  // 2. Meta Description checks
  if (!page.metaDescription || page.metaDescription.trim().length === 0) {
    issues.push("Missing meta description");
    score -= 20;
  } else if (page.metaDescription.length < 100) {
    issues.push(`Meta description too short (${page.metaDescription.length} chars; min 100 recommended)`);
    score -= 8;
  } else if (page.metaDescription.length > 175) {
    issues.push(`Meta description exceeds search snippet limit (${page.metaDescription.length} chars)`);
    score -= 8;
  }

  // 3. H1 & Content Depth
  if (!page.h1 || page.h1.trim().length === 0) {
    issues.push("Missing primary H1 heading");
    score -= 15;
  }

  const wordCount = (page.overviewContent || "").trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 150) {
    issues.push(`Thin content: overview has only ${wordCount} words (min 150 recommended)`);
    score -= 15;
  }

  // 4. Distance & Proximity Verification
  if (page.distanceKm === undefined || page.distanceKm === null || page.distanceKm < 0) {
    issues.push("Missing or invalid distance calculation");
    score -= 10;
  }

  if (page.verificationStatus !== SeoVerificationStatus.VERIFIED) {
    issues.push(`Unverified proximity status: ${page.verificationStatus}`);
    score -= 15;
  }

  // 5. FAQs completeness for rich snippets
  if (!page.faqs || page.faqs.length < 2) {
    issues.push("Fewer than 2 FAQs provided for Schema.org FAQPage rich snippets");
    score -= 10;
  }

  // 6. Coordinates & Route info
  if (!page.coordinates?.latitude || !page.coordinates?.longitude) {
    issues.push("Missing geographical coordinates for local map schema");
    score -= 10;
  }

  if (!page.distanceRouteDetails || page.distanceRouteDetails.length < 20) {
    issues.push("Missing clear transit / driving route directions");
    score -= 5;
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

/**
 * Public: Get list of all published, verified landing pages
 */
export const getPublicLandingPages = async (req: Request, res: Response) => {
  try {
    const pages = await SeoLandingPage.find({
      isPublished: true,
      verificationStatus: SeoVerificationStatus.VERIFIED,
    })
      .select("slug targetLocality destinationName pageType distanceKm travelTimeMinutes metaTitle metaDescription h1 auditScore updatedAt")
      .sort({ distanceKm: 1 })
      .lean();

    return res.status(200).json({ success: true, data: pages });
  } catch (error: any) {
    logger.error("seo.getPublicLandingPages_failed", { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public: Get single landing page by slug with live rates & rooms
 */
export const getLandingPageBySlug = async (req: Request, res: Response) => {
  try {
    const rawSlug = req.params.slug;
    const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug || "").toLowerCase().trim();
    const isPreview = req.query.preview === "true";

    const query: any = { slug };
    if (!isPreview) {
      query.isPublished = true;
    }

    const page = await SeoLandingPage.findOne(query).lean();
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Destination landing page not found",
      });
    }

    // Increment page views asynchronously without blocking response
    if (!isPreview) {
      SeoLandingPage.updateOne({ _id: page._id }, { $inc: { "analytics.views": 1 } }).catch(() => undefined);
    }

    // Fetch active room categories so the page has authoritative rates
    const roomCategories = await RoomCategory.find({ isActive: true })
      .select("name slug description shortDescription basePrice hourlyPrice capacity amenities images")
      .sort({ basePrice: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...page,
        hotelFacts: HOTEL,
        roomCategories,
      },
    });
  } catch (error: any) {
    logger.error("seo.getLandingPageBySlug_failed", { error: error.message, slug: req.params.slug });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public: Track search/booking CTA clicks from a landing page
 */
export const trackBookingStart = async (req: Request, res: Response) => {
  try {
    const { slug } = req.body;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Slug is required" });
    }

    await SeoLandingPage.updateOne(
      { slug: slug.toLowerCase().trim() },
      { $inc: { "analytics.bookingStarts": 1 } }
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Get all pages with search, filter, and pagination
 */
export const getAllPagesAdmin = async (req: Request, res: Response) => {
  try {
    const { search, pageType, verificationStatus, isPublished } = req.query;

    const filter: any = {};

    if (search) {
      const q = String(search).trim();
      filter.$or = [
        { targetLocality: { $regex: q, $options: "i" } },
        { destinationName: { $regex: q, $options: "i" } },
        { slug: { $regex: q, $options: "i" } },
      ];
    }

    if (pageType) {
      filter.pageType = pageType;
    }

    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }

    if (isPublished !== undefined && isPublished !== "") {
      filter.isPublished = isPublished === "true";
    }

    const pages = await SeoLandingPage.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: pages });
  } catch (error: any) {
    logger.error("seo.getAllPagesAdmin_failed", { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Create a new landing page
 */
export const createLandingPage = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body.slug || !body.targetLocality || !body.destinationName || !body.h1) {
      return res.status(400).json({
        success: false,
        message: "Slug, targetLocality, destinationName, and H1 are required",
      });
    }

    const slug = body.slug.toLowerCase().trim();
    const existing = await SeoLandingPage.findOne({ slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A landing page with slug "${slug}" already exists`,
      });
    }

    const { score } = calculateSeoAuditScore(body);

    const newPage = await SeoLandingPage.create({
      ...body,
      slug,
      auditScore: score,
      canonicalUrl: body.canonicalUrl || `https://yeshotels.in/hotels-near/${slug}`,
    });

    return res.status(201).json({ success: true, data: newPage });
  } catch (error: any) {
    logger.error("seo.createLandingPage_failed", { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Update an existing landing page
 */
export const updateLandingPage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const page = await SeoLandingPage.findById(id);
    if (!page) {
      return res.status(404).json({ success: false, message: "Landing page not found" });
    }

    if (body.slug && body.slug !== page.slug) {
      const slug = body.slug.toLowerCase().trim();
      const duplicate = await SeoLandingPage.findOne({ slug, _id: { $ne: id } });
      if (duplicate) {
        return res.status(409).json({ success: false, message: "Slug is already in use by another page" });
      }
      page.slug = slug;
    }

    const { score } = calculateSeoAuditScore({ ...page.toObject(), ...body });
    body.auditScore = score;

    Object.assign(page, body);
    await page.save();

    return res.status(200).json({ success: true, data: page });
  } catch (error: any) {
    logger.error("seo.updateLandingPage_failed", { error: error.message, id: req.params.id });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Delete a landing page
 */
export const deleteLandingPage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await SeoLandingPage.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Landing page not found" });
    }
    return res.status(200).json({ success: true, message: "Landing page deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Run comprehensive automated SEO audit across all pages
 */
export const runAutomatedAudit = async (req: Request, res: Response) => {
  try {
    const pages = await SeoLandingPage.find().lean();

    const auditResults = pages.map((page) => {
      const { score, issues } = calculateSeoAuditScore(page);
      return {
        _id: page._id,
        slug: page.slug,
        targetLocality: page.targetLocality,
        destinationName: page.destinationName,
        isPublished: page.isPublished,
        score,
        issues,
        passed: issues.length === 0,
      };
    });

    const totalPages = auditResults.length;
    const passedPages = auditResults.filter((r) => r.passed).length;
    const averageScore =
      totalPages > 0
        ? Math.round(auditResults.reduce((sum, r) => sum + r.score, 0) / totalPages)
        : 100;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalPages,
          passedPages,
          flaggedPages: totalPages - passedPages,
          averageScore,
          auditTimestamp: new Date(),
        },
        results: auditResults,
      },
    });
  } catch (error: any) {
    logger.error("seo.runAutomatedAudit_failed", { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Aggregate SEO and attribution performance
 */
export const getSeoAnalytics = async (req: Request, res: Response) => {
  try {
    const pages = await SeoLandingPage.find()
      .select("slug targetLocality destinationName analytics isPublished")
      .lean();

    const totals = pages.reduce(
      (acc, p) => {
        acc.views += p.analytics?.views || 0;
        acc.bookingStarts += p.analytics?.bookingStarts || 0;
        acc.completedBookings += p.analytics?.completedBookings || 0;
        acc.revenueAttributed += p.analytics?.revenueAttributed || 0;
        return acc;
      },
      { views: 0, bookingStarts: 0, completedBookings: 0, revenueAttributed: 0 }
    );

    const conversionRate =
      totals.views > 0
        ? ((totals.completedBookings / totals.views) * 100).toFixed(2)
        : "0.00";

    const topPerformingPages = [...pages]
      .sort((a, b) => (b.analytics?.revenueAttributed || 0) - (a.analytics?.revenueAttributed || 0))
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      data: {
        totals: {
          ...totals,
          conversionRatePercent: Number(conversionRate),
        },
        topPerformingPages,
      },
    });
  } catch (error: any) {
    logger.error("seo.getSeoAnalytics_failed", { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
