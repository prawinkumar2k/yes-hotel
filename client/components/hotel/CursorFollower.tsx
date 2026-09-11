import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const NON_PUBLIC_PREFIXES = ["/admin", "/staff", "/customer", "/login", "/register", "/forgot-password", "/reset-password"];

/**
 * A small custom cursor that smoothly interpolates toward the real pointer
 * (gsap.quickTo, not 1:1 tracking — that lag is what reads as "premium"
 * rather than "a div stuck to your mouse"). Expands and shows a label when
 * hovering any element carrying `data-cursor="LABEL"` (e.g. gallery images
 * -> "VIEW", room links -> "EXPLORE", the booking CTA -> "BOOK").
 *
 * Disabled entirely — not just visually hidden, the whole effect never
 * initializes — on: any non-public route, touch/coarse-pointer devices
 * (matchMedia, not user-agent sniffing), and prefers-reduced-motion.
 */
export default function CursorFollower() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const dotRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const isPublicPage = !NON_PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!isPublicPage || reducedMotion) return;
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    if (!dotRef.current) return;

    const xTo = gsap.quickTo(dotRef.current, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(dotRef.current, "y", { duration: 0.4, ease: "power3.out" });

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      if (!visible) setVisible(true);
    };
    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>("[data-cursor]");
      setLabel(target?.dataset.cursor ?? null);
    };
    const onLeaveWindow = () => setVisible(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
    };
  }, [isPublicPage, reducedMotion, visible]);

  if (!isPublicPage || reducedMotion) return null;

  return (
    <div
      ref={dotRef}
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full mix-blend-difference transition-[width,height,opacity] duration-300 md:flex"
      style={{
        width: label ? 72 : 10,
        height: label ? 72 : 10,
        opacity: visible ? 1 : 0,
        backgroundColor: "#ffffff",
      }}
    >
      {label && <span className="text-[9px] font-semibold uppercase tracking-widest text-hotel-black">{label}</span>}
    </div>
  );
}
