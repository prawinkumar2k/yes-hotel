import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { gsap } from "@/lib/gsap";

const NON_PUBLIC_PREFIXES = ["/admin", "/staff", "/customer", "/login", "/register", "/forgot-password", "/reset-password"];

/**
 * A single, subtle 2px progress line fixed to the top of the viewport —
 * "part of the brand," not a loud loading-bar. scaleX (GPU transform), not
 * width, so it never triggers layout on scroll.
 */
export default function ScrollProgress() {
  const location = useLocation();
  const barRef = useRef<HTMLDivElement>(null);
  const isPublicPage = !NON_PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!isPublicPage || !barRef.current) return;
    const bar = barRef.current;

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      gsap.set(bar, { scaleX: progress });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isPublicPage, location.pathname]);

  if (!isPublicPage) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] bg-transparent">
      <div ref={barRef} className="h-full w-full origin-left bg-hotel-gold" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
