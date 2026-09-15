import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const NON_PUBLIC_PREFIXES = ["/admin", "/staff", "/customer", "/login", "/register", "/forgot-password", "/reset-password"];

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

    const xTo = gsap.quickTo(dotRef.current, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(dotRef.current, "y", { duration: 0.35, ease: "power3.out" });

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
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-[width,height,opacity,background-color] duration-300 md:flex border border-[#c9a227]/50 shadow-lg"
      style={{
        width: label ? 80 : 12,
        height: label ? 80 : 12,
        opacity: visible ? 1 : 0,
        backgroundColor: label ? "#c9a227" : "#e5c76b",
        color: "#0b0b0b",
      }}
    >
      {label && <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-black">{label}</span>}
    </div>
  );
}
