import { SeoLandingPage } from "../models/SeoLandingPage";
import { HOTEL, hotelAddressOneLine } from "../../../shared/hotel-info";
import { HotelSettings } from "../models/HotelSettings";
import { RoomCategory } from "../models/RoomCategory";

/** Phone, email, times (Admin → Settings) and the active room-rate range, cached for 5 minutes. */
let factsCache: { at: number; facts: { phone: string; email: string; checkIn: string; checkOut: string; priceRange?: string } } | null = null;
async function liveHotelFacts() {
  if (factsCache && Date.now() - factsCache.at < 5 * 60 * 1000) return factsCache.facts;
  const [settings, cats]: [any, any[]] = await Promise.all([
    HotelSettings.findOne().select("phone email checkInTime checkOutTime").lean().catch(() => null),
    RoomCategory.find({ isActive: { $ne: false } }).select("basePrice").lean().catch(() => []),
  ]);
  const prices = cats.map((c) => Number(c.basePrice)).filter((n) => n > 0);
  const hhmmss = (v: unknown, d: string) => (/^\d{2}:\d{2}$/.test(String(v ?? "")) ? `${v}:00` : d);
  const facts = {
    phone: settings?.phone || HOTEL.phones[0],
    email: settings?.email || "",
    checkIn: hhmmss(settings?.checkInTime, "12:00:00"),
    checkOut: hhmmss(settings?.checkOutTime, "11:00:00"),
    priceRange: prices.length ? `₹${Math.min(...prices).toLocaleString("en-IN")} - ₹${Math.max(...prices).toLocaleString("en-IN")}` : undefined,
  };
  factsCache = { at: Date.now(), facts };
  return facts;
}

/**
 * Injects dynamic, database-backed Meta Tags, Canonical URL, Open Graph,
 * Twitter Cards, and Rich Schema.org JSON-LD into the index.html template.
 *
 * This provides 100% crawlability and rich snippet eligibility for
 * Googlebot, Bingbot, WhatsApp, Facebook, LinkedIn, Twitter/X, without
 * requiring full server-side JS bundle execution.
 */
export async function injectSeoTagsIntoHtml(
  rawHtml: string,
  pathname: string
): Promise<string> {
  const baseUrl = (process.env.CLIENT_URL || "https://yeshotels.in").replace(/\/$/, "");
  const facts = await liveHotelFacts();
  let title = "YES HOTELS, Bengaluru — Boutique Hotel at Hosa Road Junction";
  let description =
    `YES HOTELS — a contemporary boutique hotel at Hosa Road Junction, Hosur Road, Electronic City, Bengaluru. Clean AC rooms near Hosa Road Metro, free Wi-Fi and parking, 24-hour front desk. Call ${facts.phone}.`;
  let canonicalUrl = `${baseUrl}${pathname === "/" ? "" : pathname}`;
  let ogImage = `${baseUrl}/brand/icon-512.png`;
  let structuredDataGraphs: any[] = [];

  // Core Hotel Schema (always present)
  const hotelSchema: any = {
    "@type": "Hotel",
    "@id": `${baseUrl}/#hotel`,
    name: HOTEL.name,
    legalName: "YES HOTELS",
    url: baseUrl,
    logo: `${baseUrl}/brand/icon-512.png`,
    image: `${baseUrl}/brand/icon-512.png`,
    description: description,
    telephone: facts.phone,
    ...(facts.email ? { email: facts.email } : {}),
    ...(facts.priceRange ? { priceRange: facts.priceRange } : {}),
    checkinTime: facts.checkIn,
    checkoutTime: facts.checkOut,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${HOTEL.address.line1}, ${HOTEL.address.line2}`,
      addressLocality: HOTEL.address.area,
      addressRegion: HOTEL.address.state,
      postalCode: HOTEL.address.pincode,
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 12.8715,
      longitude: 77.6534,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "142",
      bestRating: "5",
      worstRating: "1",
    },
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Free High-Speed Wi-Fi", value: true },
      { "@type": "LocationFeatureSpecification", name: "Air Conditioning", value: true },
      { "@type": "LocationFeatureSpecification", name: "24-Hour Front Desk", value: true },
      { "@type": "LocationFeatureSpecification", name: "Elevator / Lift", value: true },
      { "@type": "LocationFeatureSpecification", name: "Free On-Site Parking", value: true },
      { "@type": "LocationFeatureSpecification", name: "Daily Housekeeping", value: true },
    ],
  };

  const organizationSchema: any = {
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: HOTEL.name,
    legalName: "YES HOTELS",
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/brand/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: `${baseUrl}/brand/icon-512.png`,
    telephone: facts.phone,
    ...(facts.email ? { email: facts.email } : {}),
  };
  structuredDataGraphs.push(organizationSchema);

  // Check if pathname matches /hotels-near/:slug
  const seoMatch = pathname.match(/^\/hotels-near\/([a-z0-9-]+)/i);
  if (seoMatch) {
    const slug = seoMatch[1].toLowerCase();
    try {
      const page = await SeoLandingPage.findOne({ slug, isPublished: true }).lean();
      if (page) {
        title = `${page.metaTitle} | YES HOTELS`;
        description = page.metaDescription;
        canonicalUrl = `${baseUrl}/hotels-near/${page.slug}`;

        // Enhanced Hotel Schema with local target locality reference
        hotelSchema.description = page.metaDescription;
        hotelSchema.name = `YES HOTELS near ${page.targetLocality}`;

        // BreadcrumbList Schema
        const breadcrumbs = {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: baseUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Hotels Near",
              item: `${baseUrl}/rooms`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: page.targetLocality,
              item: canonicalUrl,
            },
          ],
        };

        structuredDataGraphs.push(breadcrumbs);

        // FAQPage Schema if FAQs exist
        if (page.faqs && page.faqs.length > 0) {
          const faqSchema = {
            "@type": "FAQPage",
            mainEntity: page.faqs.map((f: any) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: f.answer,
              },
            })),
          };
          structuredDataGraphs.push(faqSchema);
        }
      }
    } catch {
      // Fallback gracefully on query error
    }
  }

  structuredDataGraphs.unshift(hotelSchema);

  const jsonLdScript = `\n    <script type="application/ld+json">\n${JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": structuredDataGraphs,
    },
    null,
    2
  )}\n    </script>`;

  // String replacements in index.html
  let result = rawHtml;

  // Replace Title
  result = result.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // Replace or inject Meta Description
  if (result.includes('<meta name="description"')) {
    result = result.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );
  } else {
    result = result.replace("</head>", `  <meta name="description" content="${escapeHtml(description)}" />\n</head>`);
  }

  // Inject Canonical Link
  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
  if (result.includes('<link rel="canonical"')) {
    result = result.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, canonicalTag);
  } else {
    result = result.replace("</head>", `  ${canonicalTag}\n</head>`);
  }

  // Open Graph
  result = result.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  result = result.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  result = result.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);

  // Twitter
  result = result.replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  result = result.replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);

  // Inject JSON-LD right before </head>
  result = result.replace("</head>", `${jsonLdScript}\n  </head>`);

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
