import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";

const SCENES = [
  {
    num: "01",
    title: "SIGNATURE SUITES",
    category: "ACCOMMODATIONS",
    description: "Floor-to-ceiling glass, Italian marble, and ocean views designed for deep rest.",
    image: "/gallery/hotel-02.png",
    link: "/rooms",
  },
  {
    num: "02",
    title: "MICHELIN GASTRONOMY",
    category: "DINING & BARS",
    description: "Culinary artistry with locally harvested coastal ingredients and rare vintage wines.",
    image: "/gallery/hotel-10.png",
    link: "/contact",
  },
  {
    num: "03",
    title: "INFINITY HORIZONS",
    category: "POOL & CABANAS",
    description: "Heated salt-water infinity pools blending seamlessly into the sunset ocean.",
    image: "/gallery/hotel-11.png",
    link: "/gallery",
  },
  {
    num: "04",
    title: "HOLISTIC SPA & WELLNESS",
    category: "RENEWAL",
    description: "Ayurvedic therapies, steam sanctuaries, and personalized sound bath rituals.",
    image: "/gallery/hotel-12.png",
    link: "/about",
  },
  {
    num: "05",
    title: "BANQUETS & EVENTS",
    category: "CELEBRATIONS",
    description: "Bespoke beachfront weddings and executive summits engineered with precision.",
    image: "/gallery/hotel-08.png",
    link: "/contact",
  },
];

export default function HorizontalStory() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % SCENES.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + SCENES.length) % SCENES.length);
  };

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        nextSlide();
      }, 4500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentIndex]);

  return (
    <section className="relative w-full bg-[#0b0b0b] text-white py-24 border-t border-b border-[#262930] overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] space-y-8">
        
        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-[#262930] pb-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> EDITORIAL MAGAZINE COLLECTION
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl text-white font-normal leading-tight">
              Curated <span className="text-[#c9a227] italic font-serif">Curations & Spaces</span>.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2.5 rounded-full bg-[#121316] border border-[#262930] text-gray-400 hover:text-[#c9a227] hover:border-[#c9a227]/50 transition-all"
              title={isPlaying ? "Pause auto-scroll" : "Play auto-scroll"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevSlide}
                className="p-3 rounded-full bg-[#121316] border border-[#262930] text-white hover:text-[#c9a227] hover:border-[#c9a227]/50 transition-all shadow-lg"
                aria-label="Previous scene"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="p-3 rounded-full bg-[#121316] border border-[#262930] text-white hover:text-[#c9a227] hover:border-[#c9a227]/50 transition-all shadow-lg"
                aria-label="Next scene"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Carousel Feature */}
        <div 
          className="relative w-full h-[520px] sm:h-[580px] rounded-3xl overflow-hidden border border-[#262930] shadow-2xl bg-[#121316]"
          onMouseEnter={() => setIsPlaying(false)}
          onMouseLeave={() => setIsPlaying(true)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 w-full h-full"
            >
              <img
                src={SCENES[currentIndex].image}
                alt={SCENES[currentIndex].title}
                style={{ imageRendering: "-webkit-optimize-contrast" as any }}
                className="w-full h-full object-cover filter brightness-[0.75] contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b]/80 via-transparent to-transparent hidden md:block" />

              {/* Scene Info Overlay */}
              <div className="absolute inset-0 p-8 sm:p-12 md:p-16 flex flex-col justify-between z-10">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold bg-[#c9a227]/20 text-[#e5c76b] px-4 py-1.5 rounded-full border border-[#c9a227]/40 backdrop-blur-md">
                    SCENE {SCENES[currentIndex].num} / 05
                  </span>
                  <span className="font-mono text-xs text-gray-300 tracking-widest uppercase bg-black/40 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                    {SCENES[currentIndex].category}
                  </span>
                </div>

                <div className="space-y-4 max-w-2xl">
                  <h3 className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal text-white leading-tight drop-shadow-lg">
                    {SCENES[currentIndex].title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-200 font-light leading-relaxed max-w-xl drop-shadow-md">
                    {SCENES[currentIndex].description}
                  </p>
                  <div className="pt-4">
                    <Link
                      to={SCENES[currentIndex].link}
                      className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#c9a227] hover:bg-[#e5c76b] text-black font-semibold text-xs font-mono uppercase tracking-widest transition-all duration-300 shadow-xl hover:shadow-[0_0_25px_rgba(201,162,39,0.4)]"
                    >
                      Explore Collection <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress Bar & Mini Tabs */}
          <div className="absolute bottom-6 left-8 right-8 z-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {SCENES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    currentIndex === idx ? "w-10 bg-[#c9a227]" : "w-3 bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            <div className="text-xs font-mono text-gray-400">
              0{currentIndex + 1} / 0{SCENES.length}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
