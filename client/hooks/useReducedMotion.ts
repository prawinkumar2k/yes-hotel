import { useEffect, useState } from "react";

/**
 * Mirrors the CSS `@media (prefers-reduced-motion: reduce)` handling already
 * used for .reveal elements (see global.css), but as JS state — needed for
 * things CSS alone can't gate, like whether to autoplay a background video
 * at all.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
