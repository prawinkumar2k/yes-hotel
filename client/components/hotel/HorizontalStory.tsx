import React, { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const SCENES = [
  {
    num: "01",
    title: "SIGNATURE SUITES",
    category: "ACCOMMODATIONS",
    description: "Floor-to-ceiling glass, Italian marble, and ocean views designed for deep rest.",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80",
    link: "/rooms",
  },
  {
    num: "02",
    title: "MICHELIN GASTRONOMY",
    category: "DINING & BARS",
    description: "Culinary artistry with locally harvested coastal ingredients and rare vintage wines.",
    image: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1600&q=80",
    link: "/contact",
  },
  {
    num: "03",
    title: "INFINITY HORIZONS",
    category: "POOL & CABANAS",
    description: "Heated salt-water infinity pools blending seamlessly into the sunset ocean.",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
    link: "/gallery",
  },
  {
    num: "04",
    title: "HOLISTIC SPA & WELLNESS",
    category: "RENEWAL",
    description: "Ayurvedic therapies, steam sanctuaries, and personalized sound bath rituals.",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=80",
    link: "/about",
  },
  {
    num: "05",
    title: "BANQUETS & EVENTS",
    category: "CELEBRATIONS",
    description: "Bespoke beachfront weddings and executive summits engineered with precision.",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=80",
    link: "/contact",
  },
];

export default function HorizontalStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !containerRef.current || !sliderRef.current) return;

    const ctx = gsap.context(() => {
      const totalWidth = sliderRef.current!.scrollWidth - window.innerWidth;

      gsap.to(sliderRef.current, {
        x: -totalWidth,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 1,
          end: () => `+=${totalWidth}`,
          invalidateOnRefresh: true,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <section className="bg-[#0b0b0b] py-20 text-white border-t border-[#262930]">
        <div className="container mx-auto px-4 max-w-6xl space-y-12">
          <h2 className="font-serif text-4xl text-[#c9a227]">The Editorial Collection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SCENES.map((scene) => (
              <div key={scene.num} className="bg-[#121316] border border-[#262930] rounded-2xl p-6 space-y-4">
                <img src={scene.image} alt={scene.title} className="w-full aspect-video object-cover rounded-xl" />
                <span className="text-xs font-mono text-[#c9a227]">{scene.num} · {scene.category}</span>
                <h3 className="font-serif text-2xl text-white">{scene.title}</h3>
                <p className="text-gray-400 text-xs">{scene.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="relative h-screen w-full overflow-hidden bg-[#0b0b0b] text-white border-t border-b border-[#262930]">
      {/* Header Label */}
      <div className="absolute top-8 left-8 md:left-16 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121316]/80 border border-[#c9a227]/30 backdrop-blur-md text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
        <Sparkles size={14} className="text-[#c9a227]" /> EDITORIAL MAGAZINE SCROLL
      </div>

      {/* Horizontal Slider Tracks */}
      <div ref={sliderRef} className="flex items-center h-full gap-8 px-8 md:px-16 w-max">
        {SCENES.map((scene) => (
          <div
            key={scene.num}
            className="w-[85vw] md:w-[60vw] lg:w-[48vw] h-[72vh] bg-[#121316] border border-[#262930] rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-[#c9a227]/60 transition-all duration-500"
          >
            {/* Background Image with Hover Scale */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <img
                src={scene.image}
                alt={scene.title}
                className="w-full h-full object-cover filter brightness-60 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent" />
            </div>

            {/* Scene Header */}
            <div className="relative z-10 flex justify-between items-start">
              <span className="font-mono text-xs font-bold bg-[#c9a227]/20 text-[#e5c76b] px-3 py-1 rounded-full border border-[#c9a227]/30">
                SCENE {scene.num}
              </span>
              <span className="font-mono text-xs text-gray-400 tracking-widest uppercase">
                {scene.category}
              </span>
            </div>

            {/* Scene Bottom Typography */}
            <div className="relative z-10 space-y-3 max-w-xl">
              <h3 className="font-serif text-3xl md:text-5xl font-normal text-white leading-tight">
                {scene.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-300 font-light leading-relaxed">
                {scene.description}
              </p>
              <div className="pt-2">
                <Link
                  to={scene.link}
                  className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#c9a227] hover:text-[#e5c76b] uppercase tracking-widest transition"
                >
                  Explore Collection <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
