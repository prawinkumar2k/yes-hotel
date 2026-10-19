/**
 * Website analytics (Google Analytics 4). Nothing is loaded or sent unless the server has a GA_MEASUREMENT_ID
 * (it adds <meta name="ga-measurement-id"> to the page). Events: page_view, search_availability, begin_checkout, purchase.
 * No names, phone numbers or emails are ever sent.
 */
type Params = Record<string, string | number | boolean | undefined>;

let ready = false;
const gaId = () => (typeof document === "undefined" ? "" : document.querySelector<HTMLMetaElement>('meta[name="ga-measurement-id"]')?.content ?? "");

function boot(): boolean {
  if (ready) return true;
  const id = gaId();
  if (!id || typeof window === "undefined") return false;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer.push(arguments); };
  w.gtag("js", new Date());
  w.gtag("config", id, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  ready = true;
  return true;
}

export function track(event: string, params: Params = {}) {
  try {
    if (!boot()) return;
    (window as any).gtag("event", event, params);
  } catch {
    // analytics must never break the site
  }
}

export const trackPageView = (path: string) => track("page_view", { page_path: path, page_location: typeof location !== "undefined" ? location.href : path });
