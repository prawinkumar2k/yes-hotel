import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const STAGES = [
  {
    n: "01",
    label: "Arrive",
    copy: "Leave the ordinary behind.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80",
  },
  {
    n: "02",
    label: "Unwind",
    copy: "Let time slow down.",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1800&q=80",
  },
  {
    n: "03",
    label: "Indulge",
    copy: "Stay for the moments.",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1800&q=80",
  },
  {
    n: "04",
    label: "Remember",
    copy: "Take the feeling with you.",
    image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1800&q=80",
  },
];

/**
 * One real pinned cinematic sequence: the section is pinned for
 * STAGES.length viewport-heights of scroll while a GSAP timeline
 * (scrubbed 1:1 to scroll position) crossfades between stage images and
 * their accompanying numbered statement — a sequence, not four cards.
 * Falls back to a plain stacked (non-pinned) layout under
 * prefers-reduced-motion, so the content stays fully accessible either way.
 */
export default function YesExperience() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const images = imageRefs.current.filter(Boolean) as HTMLDivElement[];
      const texts = textRefs.current.filter(Boolean) as HTMLDivElement[];

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: `+=${STAGES.length * 100}%`,
          scrub: 1,
          pin: true,
        },
      });

      for (let i = 1; i < STAGES.length; i++) {
        tl.to(images[i - 1], { opacity: 0, scale: 1.08, duration: 1 }, i - 0.15)
          .to(images[i], { opacity: 1, scale: 1, duration: 1 }, i - 0.15)
          .to(texts[i - 1], { opacity: 0, y: -20, duration: 0.6 }, i - 0.15)
          .to(texts[i], { opacity: 1, y: 0, duration: 0.6 }, i);
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <section className="bg-hotel-black py-24 sm:py-32">
        <div className="container space-y-20">
          {STAGES.map((s) => (
            <div key={s.n} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
              <img src={s.image} alt={s.label} className="aspect-[4/3] w-full object-cover" />
              <div>
                <span className="font-serif text-sm text-hotel-gold">{s.n}</span>
                <h3 className="mt-2 font-serif text-4xl text-hotel-white">{s.label}</h3>
                <p className="mt-4 text-lg text-hotel-white/70">{s.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden bg-hotel-black">
      {STAGES.map((s, i) => (
        <div
          key={s.n}
          ref={(el) => (imageRefs.current[i] = el)}
          className="absolute inset-0"
          style={{ opacity: i === 0 ? 1 : 0 }}
        >
          <img src={s.image} alt={s.label} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-hotel-black/45" />
        </div>
      ))}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-hotel-gold">The YES Experience</p>
        <div className="relative mt-8 h-40 w-full max-w-2xl">
          {STAGES.map((s, i) => (
            <div
              key={s.n}
              ref={(el) => (textRefs.current[i] = el)}
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <span className="font-serif text-lg text-hotel-white/50">{s.n}</span>
              <h3 className="mt-2 font-serif text-5xl text-hotel-white sm:text-6xl">{s.label}</h3>
              <p className="mt-4 text-lg text-hotel-white/70">{s.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
