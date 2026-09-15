import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Sparkles, Eye } from "lucide-react";
import { LOCAL_GALLERY_IMAGES } from "@/lib/gallery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const SPAN_PATTERN = [
  "sm:col-span-2 sm:row-span-2",
  "",
  "sm:row-span-2",
  "",
  "sm:col-span-2",
  "sm:row-span-2",
  "",
  "",
];

export default function Gallery() {
  const [active, setActive] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const IMAGES = LOCAL_GALLERY_IMAGES.slice(0, 8);

  useEffect(() => {
    if (active === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((v) => (v === null ? v : (v + 1) % IMAGES.length));
      if (e.key === "ArrowLeft") setActive((v) => (v === null ? v : (v - 1 + IMAGES.length) % IMAGES.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, IMAGES.length]);

  return (
    <section id="gallery" className="bg-[#0b0b0b] py-28 text-white border-t border-[#262930]">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#262930] pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> VISUAL ARCHIVE & ATMOSPHERE
            </div>
            <h2 className="font-serif text-4xl sm:text-6xl text-white font-normal leading-tight">
              A Glimpse of <span className="text-[#c9a227] italic font-serif">Your Sanctuary</span>.
            </h2>
          </div>

          <p className="max-w-md text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
            Moments captured across our coastal suites, private infinity pools, and Michelin-inspired dining salons.
          </p>
        </div>

        {/* Irregular Masonry Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:[grid-auto-rows:220px]">
          {IMAGES.map((image, i) => (
            <motion.div
              key={image.title}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-[#262930] ${SPAN_PATTERN[i % SPAN_PATTERN.length]}`}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: (i % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setActive(i)}
                data-cursor="VIEW"
                className="block h-full w-full relative"
              >
                <motion.img
                  layoutId={reducedMotion ? undefined : `gallery-image-${i}`}
                  src={image.src}
                  alt={image.title}
                  style={{ imageRendering: "-webkit-optimize-contrast" as any }}
                  className="h-full min-h-[160px] w-full object-cover filter brightness-[0.97] contrast-[1.05] saturate-[1.05] transition-all duration-700 group-hover:scale-105 group-hover:brightness-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/20 to-transparent opacity-50 group-hover:opacity-85 transition-opacity duration-300" />

                <div className="absolute inset-0 flex flex-col justify-end p-4 text-left opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="text-[10px] font-mono text-[#c9a227] uppercase tracking-widest font-semibold">ARCHIVE 0{i + 1}</span>
                  <span className="text-sm font-serif text-white font-semibold flex items-center gap-1.5 drop-shadow-md">
                    <Eye size={14} className="text-[#c9a227]" /> {image.title}
                  </span>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fullscreen Shared-Layout Lightbox Modal */}
      <AnimatePresence>
        {active !== null && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0b0b]/90 backdrop-blur-2xl p-4 sm:p-8 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            {/* Ambient Image Glow */}
            <img
              src={IMAGES[active].src}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-20 scale-125 pointer-events-none select-none"
            />

            <button
              type="button"
              aria-label="Close"
              onClick={() => setActive(null)}
              className="absolute right-6 top-6 z-20 text-white hover:text-[#c9a227] p-2.5 rounded-2xl bg-[#121316]/80 backdrop-blur-md border border-[#262930] hover:border-[#c9a227]/50 transition-all shadow-xl"
            >
              <X size={24} />
            </button>

            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                setActive((v) => (v === null ? v : (v - 1 + IMAGES.length) % IMAGES.length));
              }}
              className="absolute left-6 top-1/2 z-20 -translate-y-1/2 text-white/80 hover:text-white p-3.5 rounded-full bg-[#121316]/80 backdrop-blur-md border border-[#262930] hover:border-[#c9a227]/50 transition-all shadow-2xl"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                setActive((v) => (v === null ? v : (v + 1) % IMAGES.length));
              }}
              className="absolute right-6 top-1/2 z-20 -translate-y-1/2 text-white/80 hover:text-white p-3.5 rounded-full bg-[#121316]/80 backdrop-blur-md border border-[#262930] hover:border-[#c9a227]/50 transition-all shadow-2xl"
            >
              <ChevronRight size={24} />
            </button>

            <div className="relative z-10 space-y-4 text-center max-w-5xl flex flex-col items-center">
              <div className="relative overflow-hidden rounded-3xl border border-[#c9a227]/30 bg-[#121316] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-2">
                <motion.img
                  layoutId={reducedMotion ? undefined : `gallery-image-${active}`}
                  src={IMAGES[active].src}
                  alt={IMAGES[active].title}
                  style={{ imageRendering: "-webkit-optimize-contrast" as any }}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[78vh] max-w-full rounded-2xl object-contain filter contrast-[1.04] saturate-[1.04] brightness-[0.99]"
                />
              </div>
              <div className="px-6 py-2 rounded-full bg-[#121316]/90 border border-[#262930] backdrop-blur-md inline-flex items-center gap-3">
                <span className="text-xs font-mono text-[#c9a227] uppercase tracking-widest">{IMAGES[active].category}</span>
                <span className="text-gray-500">•</span>
                <p className="font-serif text-lg text-white font-medium">{IMAGES[active].title}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
