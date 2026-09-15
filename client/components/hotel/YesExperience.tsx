import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Play, Pause } from "lucide-react";
import { Link } from "react-router-dom";

const STAGES = [
  {
    n: "01",
    label: "ARRIVE",
    copy: "Leave the ordinary world behind as bespoke architecture welcomes your stay.",
    image: "/gallery/hotel-01.png",
    tagline: "ARCHITECTURAL ENTRANCE & CONCIERGE",
    link: "/rooms",
  },
  {
    n: "02",
    label: "UNWIND",
    copy: "Let time slow down by private infinity pools overlooking panoramic horizons.",
    image: "/gallery/hotel-11.png",
    tagline: "SANCTUARY & INFINITY POOLS",
    link: "/gallery",
  },
  {
    n: "03",
    label: "INDULGE",
    copy: "Savor Michelin-inspired gastronomy and artisanal cocktails crafted for memory.",
    image: "/gallery/hotel-08.png",
    tagline: "FINE DINING & MIXOLOGY",
    link: "/contact",
  },
  {
    n: "04",
    label: "REMEMBER",
    copy: "Take the transcendent feeling of signature hospitality home with you forever.",
    image: "/gallery/hotel-13.png",
    tagline: "SUNSET SUITES & VILLA ESCAPES",
    link: "/about",
  },
];

export default function YesExperience() {
  const [activeStage, setActiveStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setActiveStage((prev) => (prev + 1) % STAGES.length);
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeStage]);

  return (
    <section className="relative w-full bg-[#0b0b0b] text-white py-24 border-t border-[#262930] overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#262930] pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> THE YES EXPERIENCE
            </div>
            <h2 className="font-serif text-4xl sm:text-6xl text-white font-normal leading-tight">
              A Four-Act <span className="text-[#c9a227] italic font-serif">Sanctuary Journey</span>.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2.5 rounded-full bg-[#121316] border border-[#262930] text-gray-400 hover:text-[#c9a227] transition-all"
              title={isPlaying ? "Pause auto-switch" : "Play auto-switch"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((stage, idx) => (
                <button
                  key={stage.n}
                  onClick={() => setActiveStage(idx)}
                  className={`px-4 py-2 rounded-full text-xs font-mono font-semibold tracking-wider transition-all duration-300 border ${
                    activeStage === idx
                      ? "bg-[#c9a227] text-black border-[#c9a227]"
                      : "bg-[#121316] text-gray-400 border-[#262930] hover:border-[#c9a227]/40 hover:text-white"
                  }`}
                >
                  {stage.n} · {stage.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stage Presentation Container */}
        <div 
          className="relative w-full min-h-[520px] rounded-3xl overflow-hidden border border-[#262930] bg-[#121316] shadow-2xl flex flex-col lg:flex-row items-stretch"
          onMouseEnter={() => setIsPlaying(false)}
          onMouseLeave={() => setIsPlaying(true)}
        >
          {/* Left Visual Area */}
          <div className="relative w-full lg:w-3/5 h-[320px] sm:h-[400px] lg:h-auto overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeStage}
                src={STAGES[activeStage].image}
                alt={STAGES[activeStage].label}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                style={{ imageRendering: "-webkit-optimize-contrast" as any }}
                className="w-full h-full object-cover filter brightness-[0.8] contrast-[1.04]"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-[#121316] via-transparent to-transparent lg:hidden" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#121316] hidden lg:block" />
          </div>

          {/* Right Content Details */}
          <div className="relative w-full lg:w-2/5 p-8 sm:p-12 flex flex-col justify-between space-y-8 z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="font-mono text-xs text-[#c9a227] tracking-[0.25em] uppercase font-bold">
                  STAGE {STAGES[activeStage].n} / 04 · {STAGES[activeStage].tagline}
                </div>

                <h3 className="font-serif text-5xl sm:text-6xl text-white font-normal tracking-tight">
                  {STAGES[activeStage].label}
                </h3>

                <p className="text-gray-300 text-sm sm:text-base font-light leading-relaxed">
                  {STAGES[activeStage].copy}
                </p>

                <div className="pt-4">
                  <Link
                    to={STAGES[activeStage].link}
                    className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#c9a227] text-black font-semibold text-xs font-mono uppercase tracking-widest hover:bg-[#e5c76b] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,162,39,0.3)]"
                  >
                    Experience Act {STAGES[activeStage].n} <ArrowRight size={15} />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Bottom Progress Bar */}
            <div className="space-y-2 border-t border-[#262930] pt-6">
              <div className="flex justify-between text-xs font-mono text-gray-400">
                <span>PROGRESSION</span>
                <span>ACT 0{activeStage + 1} OF 04</span>
              </div>
              <div className="h-1 w-full bg-[#262930] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#c9a227]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((activeStage + 1) / STAGES.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
