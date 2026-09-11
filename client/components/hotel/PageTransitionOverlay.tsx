import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Deliberately excludes /search and /booking too, on top of the usual
// non-public prefixes — the brief is explicit that booking/payment workflow
// must not be touched by this visual pass, not just admin/customer/auth.
const EXCLUDED_PREFIXES = [
  "/admin",
  "/staff",
  "/customer",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/search",
  "/booking",
];

function isTransitionEligible(pathname: string) {
  return !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * A subtle cinematic wipe played over route changes between public
 * marketing pages only. React Router swaps the underlying page instantly
 * (no unmount delay to choreograph), so this is a single full-screen panel
 * that sweeps down to cover the viewport, then continues sweeping off the
 * bottom to reveal the already-mounted new page — not a fade, and no
 * changes to the route tree itself. Off under reduced motion, and never
 * fires on the initial page load (only on an actual navigation).
 */
export default function PageTransitionOverlay() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const prevPath = useRef(location.pathname);
  const [activeId, setActiveId] = useState<number | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const prev = prevPath.current;
    const next = location.pathname;
    prevPath.current = next;
    if (prev === next || reducedMotion) return;
    if (!isTransitionEligible(prev) || !isTransitionEligible(next)) return;
    idRef.current += 1;
    setActiveId(idRef.current);
  }, [location.pathname, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      {activeId !== null && (
        <motion.div
          key={activeId}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[90] bg-hotel-black"
          initial={{ y: "-100%" }}
          animate={{ y: ["-100%", "0%", "0%", "100%"] }}
          transition={{ duration: 0.7, times: [0, 0.35, 0.45, 1], ease: [0.76, 0, 0.24, 1] }}
          onAnimationComplete={() => setActiveId(null)}
        />
      )}
    </AnimatePresence>
  );
}
