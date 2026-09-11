import { useEffect, useRef, type ElementType } from "react";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Word-by-word GSAP reveal — each word is wrapped in an overflow-hidden
 * span so it slides up from behind a mask, rather than the whole heading
 * fading in as one block. This is the actual "clip-path / mask reveal"
 * primitive the rest of the cinematic hero/editorial sections build on.
 *
 * Text stays real, readable DOM content (just wrapped in spans) — no
 * aria-hiding needed, screen readers read it normally.
 *
 * gsap.context() + ctx.revert() on cleanup: the animation and any
 * ScrollTrigger instances it creates are fully torn down on unmount, so
 * navigating away mid-animation can't leak a ScrollTrigger that keeps
 * firing against a detached element.
 */
export default function SplitReveal({
  text,
  as: Tag = "span",
  className,
  delay = 0,
  trigger = "mount",
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  /** "mount" animates immediately; "scroll" waits until the element scrolls into view. */
  trigger?: "mount" | "scroll";
}) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!ref.current || reducedMotion) return;
    const words = ref.current.querySelectorAll<HTMLElement>("[data-word]");
    if (words.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { yPercent: 130, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          ease: "power4.out",
          stagger: 0.05,
          delay: delay / 1000,
          scrollTrigger:
            trigger === "scroll"
              ? { trigger: ref.current, start: "top 85%", once: true }
              : undefined,
        }
      );
    }, ref);

    return () => ctx.revert();
  }, [reducedMotion, delay, trigger]);

  const words = text.split(" ");

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
          <span data-word style={reducedMotion ? undefined : { display: "inline-block" }}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </Tag>
  );
}
