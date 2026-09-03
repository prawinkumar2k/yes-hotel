import { useEffect } from "react";

/**
 * This is a client-rendered SPA with no server-side rendering or
 * prerendering — a crawler that doesn't execute JavaScript (most search
 * engine and social-share bots still fall into this category, or execute
 * with a delay) will only ever see index.html's static defaults, not what
 * this hook sets. This is a real, honest limitation of the current
 * architecture, not something this hook can fully solve — full coverage
 * would require SSR/prerendering per route, which is out of scope here.
 * What this DOES do: sets the document title and meta description correctly
 * for JS-executing crawlers, and for the browser tab / bookmark itself.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} — YES Hotels`;

    let descTag: HTMLMetaElement | null = null;
    let previousDescription: string | null = null;
    if (description) {
      descTag = document.querySelector('meta[name="description"]');
      if (descTag) {
        previousDescription = descTag.getAttribute("content");
        descTag.setAttribute("content", description);
      }
    }

    return () => {
      document.title = previousTitle;
      if (descTag && previousDescription !== null) {
        descTag.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
