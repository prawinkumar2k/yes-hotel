import { useEffect } from "react";

/**
 * SEO Architecture Note — SPA metadata limitations:
 *
 * This is a client-side SPA with no SSR. Crawlers that do NOT execute
 * JavaScript (social preview bots, some Googlebot crawls) will see only
 * the static defaults from index.html. This hook is the correct solution
 * for Googlebot (which does execute JS) and for the browser tab/bookmark.
 *
 * For full parity, prerendering (e.g. with react-snap or Vite SSR) or
 * server-side rendering would be required — that is out of scope here but
 * documented as a roadmap item in SEO_REPORT.md.
 *
 * @param title          Page-level title (appended with " — YES Hotels")
 * @param description    Meta description for this page
 * @param opts.canonical Absolute canonical URL for this page
 * @param opts.ogImage   Absolute OG image URL for this page
 * @param opts.noindex   Set to true to add a noindex directive
 * @param opts.jsonLd    Structured data object(s) to inject as JSON-LD
 */
export interface PageMetaOptions {
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
  /** Pass a single object or array of schema.org objects for JSON-LD */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function usePageMeta(
  title: string,
  description?: string,
  opts: PageMetaOptions = {}
) {
  useEffect(() => {
    const BRAND_SUFFIX = " — YES Hotels";
    const fullTitle = `${title}${BRAND_SUFFIX}`;

    // ─── Title ───────────────────────────────────────────────────────────
    const previousTitle = document.title;
    document.title = fullTitle;

    // ─── Meta description ─────────────────────────────────────────────────
    let descTag: HTMLMetaElement | null = null;
    let previousDescription: string | null = null;
    if (description) {
      descTag = document.querySelector('meta[name="description"]');
      if (descTag) {
        previousDescription = descTag.getAttribute("content");
        descTag.setAttribute("content", description);
      }
    }

    // ─── OG title + description ──────────────────────────────────────────
    const ogTitleTag = document.querySelector('meta[property="og:title"]');
    const prevOgTitle = ogTitleTag?.getAttribute("content") ?? null;
    ogTitleTag?.setAttribute("content", fullTitle);

    const ogDescTag = document.querySelector('meta[property="og:description"]');
    const prevOgDesc = ogDescTag?.getAttribute("content") ?? null;
    if (description) ogDescTag?.setAttribute("content", description);

    // ─── Twitter title + description ─────────────────────────────────────
    const twTitleTag = document.querySelector('meta[name="twitter:title"]');
    const prevTwTitle = twTitleTag?.getAttribute("content") ?? null;
    twTitleTag?.setAttribute("content", fullTitle);

    const twDescTag = document.querySelector('meta[name="twitter:description"]');
    const prevTwDesc = twDescTag?.getAttribute("content") ?? null;
    if (description) twDescTag?.setAttribute("content", description);

    // ─── Canonical ────────────────────────────────────────────────────────
    let canonicalEl: HTMLLinkElement | null = null;
    let prevCanonical: string | null = null;
    if (opts.canonical) {
      canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.rel = "canonical";
        document.head.appendChild(canonicalEl);
      }
      prevCanonical = canonicalEl.getAttribute("href");
      canonicalEl.setAttribute("href", opts.canonical);
    }

    // ─── OG image ─────────────────────────────────────────────────────────
    const ogImgTag = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    const prevOgImg = ogImgTag?.getAttribute("content") ?? null;
    if (opts.ogImage && ogImgTag) {
      ogImgTag.setAttribute("content", opts.ogImage);
    }

    // ─── robots (noindex support) ─────────────────────────────────────────
    let robotsTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const prevRobots = robotsTag?.getAttribute("content") ?? null;
    if (opts.noindex) {
      if (!robotsTag) {
        robotsTag = document.createElement("meta");
        robotsTag.name = "robots";
        document.head.appendChild(robotsTag);
      }
      robotsTag.setAttribute("content", "noindex, nofollow");
    }

    // ─── JSON-LD structured data ──────────────────────────────────────────
    let jsonLdScript: HTMLScriptElement | null = null;
    if (opts.jsonLd) {
      jsonLdScript = document.createElement("script");
      jsonLdScript.type = "application/ld+json";
      jsonLdScript.id = "page-json-ld";
      jsonLdScript.textContent = JSON.stringify(
        Array.isArray(opts.jsonLd)
          ? { "@context": "https://schema.org", "@graph": opts.jsonLd }
          : { "@context": "https://schema.org", ...opts.jsonLd }
      );
      // Remove any existing page-level JSON-LD first
      document.getElementById("page-json-ld")?.remove();
      document.head.appendChild(jsonLdScript);
    }

    // ─── Cleanup on unmount / title change ───────────────────────────────
    return () => {
      document.title = previousTitle;

      if (descTag && previousDescription !== null) {
        descTag.setAttribute("content", previousDescription);
      }
      if (ogTitleTag && prevOgTitle !== null) {
        ogTitleTag.setAttribute("content", prevOgTitle);
      }
      if (ogDescTag && prevOgDesc !== null) {
        ogDescTag.setAttribute("content", prevOgDesc);
      }
      if (twTitleTag && prevTwTitle !== null) {
        twTitleTag.setAttribute("content", prevTwTitle);
      }
      if (twDescTag && prevTwDesc !== null) {
        twDescTag.setAttribute("content", prevTwDesc);
      }
      if (canonicalEl && prevCanonical !== null) {
        canonicalEl.setAttribute("href", prevCanonical);
      } else if (canonicalEl && prevCanonical === null) {
        canonicalEl.remove();
      }
      if (ogImgTag && prevOgImg !== null) {
        ogImgTag.setAttribute("content", prevOgImg);
      }
      if (robotsTag && prevRobots !== null) {
        robotsTag.setAttribute("content", prevRobots);
      }
      jsonLdScript?.remove();
    };
  }, [title, description, opts.canonical, opts.ogImage, opts.noindex]);
}
