import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Sparkles } from "lucide-react";

const STAGES = [
  {
    n: "01",
    label: "ARRIVE",
    copy: "Leave the ordinary world behind as bespoke architecture welcomes your stay.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80",
    tagline: "ARCHITECTURAL ENTRANCE & CONCIERGE",
  },
  {
    n: "02",
    label: "UNWIND",
    copy: "Let time slow down by private infinity pools overlooking panoramic horizons.",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2000&q=80",
    tagline: "SANCTUARY & INFINITY POOLS",
  },
  {
    n: "03",
    label: "INDULGE",
    copy: "Savor Michelin-inspired gastronomy and artisanal cocktails crafted for memory.",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=2000&q=80",
    tagline: "FINE DINING & MIXOLOGY",
  },
  {
    n: "04",
    label: "REMEMBER",
    copy: "Take the transcendent feeling of signature hospitality home with you forever.",
    image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=2000&q=80",
    tagline: "SUNSET SUITES & VILLA ESCAPES",
  },
];

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
          end: `+=${STAGES.length * 120}%`,
          scrub: 1,
          pin: true,
        },
      });

      for (let i = 1; i < STAGES.length; i++) {
        tl.to(images[i - 1], { opacity: 0, scale: 1.1, duration: 1 }, i - 0.15)
          .to(images[i], { opacity: 1, scale: 1, duration: 1 }, i - 0.15)
          .to(texts[i - 1], { opacity: 0, y: -30, duration: 0.6 }, i - 0.15)
          .to(texts[i], { opacity: 1, y: 0, duration: 0.6 }, i);
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <section className="bg-[#0b0b0b] py-24 text-white">
        <div className="container mx-auto px-4 max-w-6xl space-y-20">
          {STAGES.map((s) => (
            <div key={s.n} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
              <img src={s.image} alt={s.label} className="aspect-[4/3] w-full object-cover rounded-2xl border border-[#262930]" />
              <div className="space-y-3">
                <span className="font-mono text-xs text-[#c9a227] tracking-widest">{s.n} · {s.tagline}</span>
                <h3 className="font-serif text-5xl text-white">{s.label}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative h-screen w-full overflow-hidden bg-[#0b0b0b] text-white">
      {/* Background Image Layers */}
      {STAGES.map((s, i) => (
        <div
          key={s.n}
          ref={(el) => (imageRefs.current[i] = el)}
          className="absolute inset-0 transition-all duration-700"
          style={{ opacity: i === 0 ? 1 : 0 }}
        >
          <img src={s.image} alt={s.label} className="h-full w-full object-cover filter brightness-75 scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-[#0b0b0b]/40" />
          <div className="absolute inset-0 bg-radial-vignette opacity-70" />
        </div>
      ))}

      {/* Floating Center Stage Content */}
      <div className="relative z-20 flex h-full flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/40 backdrop-blur-md text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase mb-8">
          <Sparkles size={14} className="text-[#c9a227]" /> THE YES EXPERIENCE · CINEMATIC SCENE
        </div>

        <div className="relative h-64 w-full flex items-center justify-center">
          {STAGES.map((s, i) => (
            <div
              key={s.n}
              ref={(el) => (textRefs.current[i] = el)}
              className="absolute inset-0 flex flex-col items-center justify-center space-y-4"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <div className="font-mono text-xs text-[#c9a227] tracking-[0.3em] uppercase">
                {s.n} / 04 · {s.tagline}
              </div>
              <h3 className="font-serif text-6xl sm:text-8xl font-normal tracking-tight text-white">
                {s.label}
              </h3>
              <p className="max-w-xl text-base sm:text-lg text-gray-300 font-light leading-relaxed">
                {s.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
