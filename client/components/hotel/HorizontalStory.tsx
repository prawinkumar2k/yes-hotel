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
    image: "/videos/yes-02.mp4",
    link: "/rooms",
  },
  {
    num: "02",
    title: "MICHELIN GASTRONOMY",
    category: "DINING & BARS",
    description: "Culinary artistry with locally harvested coastal ingredients and rare vintage wines.",
    image: "/videos/yes-03.mp4",
    link: "/contact",
  },
  {
    num: "03",
    title: "INFINITY HORIZONS",
    category: "POOL & CABANAS",
    description: "Heated salt-water infinity pools blending seamlessly into the sunset ocean.",
    image: "/videos/yes-04.mp4",
    link: "/gallery",
  },
  {
    num: "04",
    title: "HOLISTIC SPA & WELLNESS",
    category: "RENEWAL",
    description: "Ayurvedic therapies, steam sanctuaries, and personalized sound bath rituals.",
    image: "/videos/yes-05.mp4",
    link: "/about",
  },
  {
    num: "05",
    title: "BANQUETS & EVENTS",
    category: "CELEBRATIONS",
    description: "Bespoke beachfront weddings and executive summits engineered with precision.",
    image: "/gallery/hotel-08.jpg",
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
    <section className="relative w-full bg-white text-slate-800 py-12 md:py-16 lg:py-24 border-t border-b border-slate-200 overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] space-y-6 md:space-y-8">
        
        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#866A1C] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> EDITORIAL MAGAZINE COLLECTION
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl text-slate-800 font-normal leading-tight">
              Curated <span className="text-[#c9a227] italic font-serif">Curations &amp; Spaces</span>.
            </h2>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-[#c9a227] hover:border-[#c9a227]/50 transition-all shadow-sm"
              title={isPlaying ? "Pause auto-scroll" : "Play auto-scroll"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={prevSlide}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700 hover:text-[#c9a227] hover:border-[#c9a227]/50 transition-all shadow-sm"
                aria-label="Previous scene"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700 hover:text-[#c9a227] hover:border-[#c9a227]/50 transition-all shadow-sm"
                aria-label="Next scene"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Carousel Feature */}
        <div 
          className="relative w-full h-[420px] sm:h-[520px] lg:h-[580px] rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100"
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
              {SCENES[currentIndex].image.endsWith(".mp4") ? (
                <video
                  src={SCENES[currentIndex].image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover filter brightness-[0.82] contrast-[1.05]"
                />
              ) : (
                <img
                  src={SCENES[currentIndex].image}
                  alt={SCENES[currentIndex].title}
                  className="w-full h-full object-cover filter brightness-[0.82] contrast-[1.05]"
                />
              )}
              {/* Gradient overlays for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent hidden md:block" />

              {/* Scene Info Overlay */}
              <div className="absolute inset-0 p-5 sm:p-8 md:p-12 lg:p-16 flex flex-col justify-between z-10">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold bg-[#c9a227]/90 text-black px-4 py-1.5 rounded-full backdrop-blur-md shadow-md">
                    SCENE {SCENES[currentIndex].num} / 05
                  </span>
                  <span className="font-mono text-xs text-white tracking-widest uppercase bg-black/50 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md">
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
                      className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#c9a227] hover:bg-[#b8911f] text-black font-semibold text-xs font-mono uppercase tracking-widest transition-all duration-300 shadow-xl"
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
                    currentIndex === idx ? "w-10 bg-[#c9a227]" : "w-3 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            <div className="text-xs font-mono text-white/70">
              0{currentIndex + 1} / 0{SCENES.length}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
