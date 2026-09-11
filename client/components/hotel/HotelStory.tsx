import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PANELS = [
  {
    kicker: "The Hotel",
    title: "More than\na stay.",
    copy: "Every detail, from the architecture to the last cup of coffee, is considered on purpose.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
  },
  {
    kicker: "01 — Architecture",
    title: "Built around\nlight.",
    copy: "Open floor plans and floor-to-ceiling glass keep every space connected to the sky outside.",
    image: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    kicker: "02 — Dining",
    title: "Spaces for\nthe table.",
    copy: "Dining rooms designed for lingering — meals, meetings, and the conversations in between.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  },
  {
    kicker: "03 — Wellness",
    title: "Room to\nslow down.",
    copy: "Quiet corners and unhurried mornings — comfort built into the pace of the place, not just the amenities.",
    image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1600&q=80",
  },
  {
    kicker: "04 — Rooms",
    title: "Comfort,\nconsidered.",
    copy: "Thoughtfully appointed rooms designed for deep rest, whatever brought you here.",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80",
  },
  {
    kicker: "05 — Experiences",
    title: "Warm\nhospitality.",
    copy: "Attentive service that feels personal — and a reservation experience as seamless as the stay itself.",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
  },
];

/**
 * Vertical scroll drives horizontal movement across full-bleed editorial
 * panels — replaces the previous 6-item icon grid. A real GSAP horizontal
 * pan (track translateX scrubbed to scroll progress) while the section is
 * pinned, not six cards in a row. Falls back to a plain vertical stack
 * under prefers-reduced-motion.
 */
export default function HotelStory() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !sectionRef.current || !trackRef.current) return;

    const ctx = gsap.context(() => {
      const track = trackRef.current!;
      const getScrollAmount = () => track.scrollWidth - window.innerWidth;

      const tween = gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${getScrollAmount()}`,
          scrub: 1,
          pin: true,
          invalidateOnRefresh: true,
        },
      });

      return () => tween.scrollTrigger?.kill();
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <section className="bg-hotel-black py-24 sm:py-32">
        <div className="space-y-1">
          {PANELS.map((p) => (
            <div key={p.kicker} className="grid grid-cols-1 items-center gap-8 px-6 py-16 lg:grid-cols-2 lg:px-16">
              <img src={p.image} alt={p.kicker} className="aspect-[4/3] w-full object-cover" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-hotel-gold">{p.kicker}</p>
                <h3 className="mt-4 whitespace-pre-line font-serif text-4xl leading-[1.05] text-hotel-white sm:text-5xl">
                  {p.title}
                </h3>
                <p className="mt-5 max-w-md text-base text-hotel-white/70">{p.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden bg-hotel-black">
      <div ref={trackRef} className="flex h-full w-max">
        {PANELS.map((p) => (
          <div key={p.kicker} className="relative flex h-full w-screen shrink-0 items-center overflow-hidden">
            <img src={p.image} alt={p.kicker} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-hotel-black/80 via-hotel-black/30 to-hotel-black/10" />
            <div className="relative z-10 max-w-xl px-8 sm:px-16">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-hotel-gold">{p.kicker}</p>
              <h3 className="mt-6 whitespace-pre-line font-serif text-5xl leading-[1.02] text-hotel-white sm:text-7xl">
                {p.title}
              </h3>
              <p className="mt-6 max-w-sm text-base text-hotel-white/70 sm:text-lg">{p.copy}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
