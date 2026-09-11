import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Only the public marketing site gets cinematic smooth scroll — the admin
// panel and customer portal are data-dense, table/form-heavy UIs where a
// weighted scroll feel actively hurts usability (and were explicitly out of
// scope for this visual redesign). Matched by prefix, not by trying to
// enumerate every public route.
const NON_SMOOTH_PREFIXES = ["/admin", "/staff", "/customer", "/login", "/register", "/forgot-password", "/reset-password"];

export default function SmoothScroll() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const isPublicPage = !NON_SMOOTH_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!isPublicPage || reducedMotion) return;

    // Weighted but not sluggish — lerp 0.1 is a common, well-tested value
    // for "cinematic, not slow" (much lower reads as floaty/delayed).
    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });

    // Keep GSAP's ScrollTrigger in sync with Lenis's virtual scroll position
    // — without this, pinned/scroll-linked GSAP animations elsewhere on the
    // page would read the real (unsmoothed) scrollTop and desync from what
    // the user actually sees.
    lenis.on("scroll", ScrollTrigger.update);
    // Named reference kept so cleanup can remove the exact same callback —
    // gsap.ticker.remove() only works with reference equality, and a fresh
    // arrow function at cleanup time would silently fail to unregister it.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(tick);
    };
  }, [isPublicPage, reducedMotion]);

  return null;
}
