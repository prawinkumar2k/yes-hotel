import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * A single floating image that follows the cursor, shown while hovering any
 * element tagged data-preview-image="<url>" nearby. Desktop-only (pointer:
 * fine), off under reduced motion — genuinely useful specifically for text
 * links that sit away from their own room's photo (e.g. "Details"/"Book
 * Now"), where the image isn't already on screen next to the link.
 */
export default function RoomHoverPreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const moveX = useRef<((v: number) => void) | null>(null);
  const moveY = useRef<((v: number) => void) | null>(null);

  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (!wrapRef.current) return;

    moveX.current = gsap.quickTo(wrapRef.current, "x", { duration: 0.5, ease: "power3.out" });
    moveY.current = gsap.quickTo(wrapRef.current, "y", { duration: 0.5, ease: "power3.out" });

    function onMove(e: MouseEvent) {
      moveX.current?.(e.clientX + 24);
      moveY.current?.(e.clientY - 90);

      const target = (e.target as HTMLElement)?.closest("[data-preview-image]") as HTMLElement | null;
      setSrc(target?.getAttribute("data-preview-image") ?? null);
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden h-32 w-48 overflow-hidden opacity-0 transition-opacity duration-200 md:block"
      style={{ opacity: src ? 1 : 0 }}
      aria-hidden="true"
    >
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}
