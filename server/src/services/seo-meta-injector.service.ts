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

/** Published area pages and active room types, cached for 5 minutes: used for internal links and the home page text. */
let siteMapCache: { at: number; areas: { href: string; label: string }[]; rooms: { slug: string; name: string; basePrice: number; description: string }[] } | null = null;
async function siteLinks() {
  if (siteMapCache && Date.now() - siteMapCache.at < 5 * 60 * 1000) return siteMapCache;
  const [pages, cats]: [any[], any[]] = await Promise.all([
    SeoLandingPage.find({ isPublished: true }).select("slug targetLocality").sort({ targetLocality: 1 }).lean().catch(() => []),
    RoomCategory.find({ isActive: { $ne: false } }).select("slug name basePrice description").sort({ basePrice: 1 }).lean().catch(() => []),
  ]);
  siteMapCache = {
    at: Date.now(),
    areas: pages.map((p) => ({ href: `/hotels-near/${p.slug}`, label: `Hotel near ${p.targetLocality}` })),
    rooms: cats.map((c) => ({ slug: c.slug, name: c.name, basePrice: Number(c.basePrice) || 0, description: String(c.description ?? "") })),
  };
  return siteMapCache;
}

const BRAND = "YES HOTELS";
/** "<page title> | YES HOTELS" without repeating the brand when the title already carries it. */
const withBrand = (t: string) => (new RegExp(BRAND, "i").test(t) ? t : `${t} | ${BRAND}`);

/** Plain HTML of a page's main content, served inside #root so crawlers that do not run scripts still read it (React replaces it on load). */
function staticBody(parts: { h1: string; sub?: string; paragraphs?: string[]; bullets?: string[]; faqs?: { question: string; answer: string }[]; contact: string; links?: { href: string; label: string }[]; linksTitle?: string }) {
  const e = escapeHtml;
  return [
    `<main data-prerender="1" style="max-width:860px;margin:0 auto;padding:96px 16px 32px;font-family:Inter,system-ui,sans-serif;line-height:1.6">`,
    `<h1>${e(parts.h1)}</h1>`,
    parts.sub ? `<h2>${e(parts.sub)}</h2>` : "",
    ...(parts.paragraphs ?? []).filter(Boolean).map((p) => `<p>${e(p)}</p>`),
    parts.bullets?.length ? `<ul>${parts.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul>` : "",
    parts.faqs?.length ? `<h2>Frequently asked questions</h2>${parts.faqs.map((f) => `<h3>${e(f.question)}</h3><p>${e(f.answer)}</p>`).join("")}` : "",
    parts.links?.length ? `<h2>${e(parts.linksTitle ?? "Explore")}</h2><ul>${parts.links.map((l) => `<li><a href="${e(l.href)}">${e(l.label)}</a></li>`).join("")}</ul>` : "",
    `<p>${e(parts.contact)}</p>`,
    `<p><a href="/rooms">Rooms</a> · <a href="/about">About</a> · <a href="/faq">FAQ</a> · <a href="/contact">Contact</a></p>`,
    `</main>`,
  ].join("");
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
  let prerender = "";
  let robots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const contactLine = `${HOTEL.name}, ${hotelAddressOneLine()}. Phone ${facts.phone}.`;

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
        title = withBrand(page.metaTitle);
        description = page.metaDescription;
        canonicalUrl = `${baseUrl}/hotels-near/${page.slug}`;

        // Enhanced Hotel Schema with local target locality reference
        hotelSchema.description = page.metaDescription;
        // The hotel's name stays "YES HOTELS" on every page (one entity, not one per locality).

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
              item: `${baseUrl}/hotels-near`,
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

        prerender = staticBody({
          h1: page.h1,
          sub: page.h2Subheading,
          paragraphs: String(page.overviewContent ?? "").split(/\n{2,}/),
          bullets: ((page as any).stayHighlights ?? []).map((h: any) => (typeof h === "string" ? h : h?.title ?? h?.text ?? "")).filter(Boolean),
          faqs: page.faqs as any,
          contact: contactLine,
          linksTitle: "Other areas we serve",
          links: (await siteLinks()).areas.filter((a) => a.href !== `/hotels-near/${page.slug}`),
        });

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

  // /rooms/:slug: title, description and a crawlable summary from the room type itself
  const roomMatch = pathname.match(/^\/rooms\/([a-z0-9-]+)\/?$/i);
  if (roomMatch) {
    try {
      const cat: any = await RoomCategory.findOne({ slug: roomMatch[1].toLowerCase(), isActive: { $ne: false } }).select("name description slug basePrice").lean();
      if (cat) {
        title = withBrand(`${cat.name} at Hosa Road Junction, Bengaluru`);
        description = `${cat.name} at YES HOTELS, Hosa Road Junction, Bengaluru: air-conditioned, free Wi-Fi, 24-hour front desk. Rooms from ₹${Number(cat.basePrice).toLocaleString("en-IN")} per night. Book direct.`;
        canonicalUrl = `${baseUrl}/rooms/${cat.slug}`;
        structuredDataGraphs.push({
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
            { "@type": "ListItem", position: 2, name: "Rooms", item: `${baseUrl}/rooms` },
            { "@type": "ListItem", position: 3, name: cat.name, item: canonicalUrl },
          ],
        });
        prerender = staticBody({ h1: `${cat.name} at YES HOTELS, Hosa Road Junction, Bengaluru`, paragraphs: [String(cat.description ?? ""), `From ₹${Number(cat.basePrice).toLocaleString("en-IN")} per night.`], contact: contactLine });
      }
    } catch {
      // keep the default tags
    }
  }
  if (pathname === "/" || pathname === "") {
    const links = await siteLinks();
    title = `Hotel near Hosa Road Metro & Electronic City, Bengaluru${facts.priceRange ? ` | Rooms from ${facts.priceRange.split(" - ")[0]}` : ""} | ${BRAND}`;
    description = `Book direct at YES HOTELS, Hosa Road Junction, Bengaluru: air-conditioned rooms close to Hosa Road Metro, Electronic City, Bommasandra and Narayana Health City. Free Wi-Fi, parking and a 24-hour front desk. Call ${facts.phone}.`;
    prerender = staticBody({
      h1: "YES HOTELS: hotel and rooms at Hosa Road Junction, Bengaluru",
      sub: "A place to stay near Hosa Road Metro, Electronic City and South Bengaluru",
      paragraphs: [
        "YES HOTELS is a hotel at Hosa Road Junction on Hosur Main Road, Bengaluru 560100, close to Hosa Road Metro Station on the Yellow Line. It suits business travellers visiting Electronic City, families visiting Narayana Health City, and anyone who wants a clean room with parking and a 24-hour front desk in South Bengaluru.",
        "Every room is air-conditioned and includes free Wi-Fi. There is a lift, free on-site parking and daily housekeeping. Book directly with us for the hotel's own rates.",
        ...links.rooms.map((r) => `${r.name}${r.basePrice ? ` from ₹${r.basePrice.toLocaleString("en-IN")} per night` : ""}. ${r.description}`),
      ],
      links: [...links.rooms.map((r) => ({ href: `/rooms/${r.slug}`, label: `${r.name}: rooms and rates` })), ...links.areas],
      linksTitle: "Rooms and the areas we serve",
      contact: contactLine,
    });
  }

  if (pathname === "/hotels-near" || pathname === "/hotels-near/") {
    const links = await siteLinks();
    title = "Hotels near Hosa Road Metro, Electronic City & South Bengaluru | YES HOTELS";
    description = "YES HOTELS at Hosa Road Junction: distances and travel times to Hosa Road Metro, Electronic City, Bommasandra, Narayana Health City, Bommanahalli, Singasandra, Kudlu Gate, Begur and Hebbagodi.";
    canonicalUrl = `${baseUrl}/hotels-near`;
    prerender = staticBody({ h1: "Where to stay near Hosa Road Metro and South Bengaluru", paragraphs: [description], links: links.areas, linksTitle: "Areas we serve", contact: contactLine });
  }

  // The search page is thin and driven by dates: keep it out of the index, let links through.
  if (pathname === "/search") robots = "noindex, follow";
  if (/^\/(admin|staff|customer|login|register|forgot-password|reset-password|booking)(\/|$)/.test(pathname)) robots = "noindex, nofollow";

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

  // Robots directive: indexable pages may show large previews; the search page is noindex
  result = result.replace(/<meta\s+name="robots"[^>]*>\s*/i, "");
  result = result.replace("</head>", `  <meta name="robots" content="${robots}" />\n</head>`);

  // Crawlable content (React replaces it when the app starts)
  if (prerender) result = result.replace('<div id="root"></div>', `<div id="root">${prerender}</div>`);

  // Web analytics id from the server's environment (GA4), read by the client; nothing is loaded without it.
  const ga = String(process.env.GA_MEASUREMENT_ID ?? "").trim();
  if (/^G-[A-Z0-9]{6,}$/.test(ga)) result = result.replace("</head>", `  <meta name="ga-measurement-id" content="${ga}" />\n</head>`);

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
