import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { TextLink } from "./HotelButtons";
import { useGallery } from "@/hooks/usePublicData";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const FALLBACK_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    title: "Hotel Exterior",
  },
  {
    src: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
    title: "The Lobby",
  },
  {
    src: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    title: "Deluxe Room",
  },
  {
    src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    title: "Dining Area",
  },
  {
    src: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    title: "Executive Room",
  },
  {
    src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    title: "Hotel Interior",
  },
  {
    src: "https://images.unsplash.com/photo-1587985064135-0366536eab42?auto=format&fit=crop&w=1200&q=80",
    title: "Decorative Detail",
  },
  {
    src: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    title: "Relaxation Space",
  },
];

// A deliberately varied rhythm — one large feature tile, tall strips, a wide
// tile, and small tiles — cycled by index. Not a repeating 3-column card
// grid: sizes genuinely differ tile to tile.
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
  const { data } = useGallery({ limit: 8 });
  const reducedMotion = useReducedMotion();

  const IMAGES = data?.length
    ? data.map((img: any) => ({ src: img.imageUrl, title: img.altText || img.title }))
    : FALLBACK_IMAGES;

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
    <section id="gallery" className="bg-hotel-black py-24 sm:py-32">
      <div className="container">
        <Reveal className="max-w-xl">
          <SectionLabel light>The YES Hotels Story</SectionLabel>
          <h2 className="mt-6 font-serif text-4xl leading-tight text-hotel-white sm:text-5xl">
            A glimpse of
            <br />
            your next stay.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:[grid-auto-rows:180px]">
          {IMAGES.map((image, i) => (
            <motion.div
              key={image.title}
              className={`group relative cursor-pointer overflow-hidden ${SPAN_PATTERN[i % SPAN_PATTERN.length]}`}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 28 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: (i % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setActive(i)}
                data-cursor="VIEW"
                className="block h-full w-full"
              >
                <motion.img
                  layoutId={reducedMotion ? undefined : `gallery-image-${i}`}
                  src={image.src}
                  alt={image.title}
                  className="h-full min-h-[150px] w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-end bg-hotel-black/0 p-4 transition-colors duration-300 group-hover:bg-hotel-black/50">
                  <span className="translate-y-2 text-sm font-medium text-hotel-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {image.title}
                  </span>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        <Reveal delay={200} className="mt-14 flex justify-center">
          <TextLink href="#gallery">Explore Full Gallery &rarr;</TextLink>
        </Reveal>
      </div>

      {/* Fullscreen viewer: the clicked tile's own image (shared layoutId)
          animates from its grid position to fill the viewport, and reverses
          the same way on close — not a plain fade-in overlay. */}
      <AnimatePresence>
        {active !== null && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-hotel-black/90 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setActive(null)}
              className="absolute right-6 top-6 z-10 text-hotel-white transition-colors hover:text-hotel-gold"
            >
              <X size={28} />
            </button>

            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                setActive((v) => (v === null ? v : (v - 1 + IMAGES.length) % IMAGES.length));
              }}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-hotel-white/70 transition-colors hover:text-hotel-white sm:left-8"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                setActive((v) => (v === null ? v : (v + 1) % IMAGES.length));
              }}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-hotel-white/70 transition-colors hover:text-hotel-white sm:right-8"
            >
              <ChevronRight size={32} />
            </button>

            <motion.img
              layoutId={reducedMotion ? undefined : `gallery-image-${active}`}
              src={IMAGES[active].src}
              alt={IMAGES[active].title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-4xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
