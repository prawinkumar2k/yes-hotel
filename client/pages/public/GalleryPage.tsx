import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Navbar from "@/components/hotel/Navbar";
import { useGallery } from "@/hooks/usePublicData";
import { Loader2, ImageOff } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "HOTEL", label: "Hotel" },
  { value: "ROOMS", label: "Rooms" },
  { value: "DINING", label: "Dining" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "EXPERIENCE", label: "Experience" },
  { value: "EVENTS", label: "Events" },
];

// A varied rhythm of tile sizes (large feature, tall, wide, small), cycled
// by position — not a uniform 3-column grid of identical squares.
const SPAN_PATTERN = [
  "md:col-span-2 md:row-span-2",
  "",
  "md:row-span-2",
  "",
  "",
  "md:col-span-2",
  "md:row-span-2",
  "",
  "",
];

export default function GalleryPage() {
  usePageMeta("Gallery", "A visual tour of YES Hotels — our rooms, dining, amenities, and exteriors.");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  const { data: images, isLoading, isError } = useGallery({
    category: activeCategory || undefined,
    limit: 100
  });

  useEffect(() => {
    if (activeIndex === null || !images?.length) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveIndex(null);
      if (e.key === "ArrowRight") setActiveIndex((v) => (v === null ? v : (v + 1) % images!.length));
      if (e.key === "ArrowLeft") setActiveIndex((v) => (v === null ? v : (v - 1 + images!.length) % images!.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, images]);

  const activeImage = activeIndex !== null ? images?.[activeIndex] : null;

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="font-serif text-5xl text-hotel-black mb-6">Gallery</h1>
          <p className="text-hotel-black/60 max-w-2xl mx-auto">
            A visual journey through the exceptional spaces, amenities, and experiences that define YES Hotels.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-5 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                activeCategory === cat.value
                  ? "bg-hotel-gold border-hotel-gold text-hotel-black"
                  : "border-gray-300 text-gray-600 hover:border-hotel-gold hover:text-hotel-gold bg-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-hotel-gold" />
          </div>
        )}

        {isError && (
          <div className="text-center py-20">
            <ImageOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Gallery temporarily unavailable. Please try again later.</p>
          </div>
        )}

        {!isLoading && !isError && images?.length === 0 && (
          <div className="text-center py-20">
            <ImageOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No images in this category yet.</p>
          </div>
        )}

        {!isLoading && !isError && images && images.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:[grid-auto-rows:220px]">
            {images.map((img: any, i: number) => (
              <motion.div
                key={img._id}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: Math.min(i % 9, 9) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative overflow-hidden bg-hotel-black cursor-pointer ${SPAN_PATTERN[i % SPAN_PATTERN.length]}`}
                onClick={() => setActiveIndex(i)}
              >
                <div className="absolute inset-0 bg-hotel-black/20 group-hover:bg-transparent transition-colors duration-500 z-10" />
                <motion.img
                  layoutId={reducedMotion ? undefined : `gallerypage-image-${img._id}`}
                  src={img.imageUrl}
                  alt={img.altText}
                  className="w-full h-full min-h-[220px] object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                {img.title && (
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/70 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white font-medium">{img.title}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen viewer: the clicked tile's own image expands from its
          grid position to fill the viewport (shared layoutId), and reverses
          the same way on close. */}
      <AnimatePresence>
        {activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveIndex(null)}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute top-6 right-6 z-10 text-white transition-colors hover:text-hotel-gold"
              onClick={() => setActiveIndex(null)}
            >
              <X size={28} />
            </button>

            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((v) => (v === null ? v : (v - 1 + images!.length) % images!.length));
              }}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/70 transition-colors hover:text-white sm:left-8"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((v) => (v === null ? v : (v + 1) % images!.length));
              }}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-white/70 transition-colors hover:text-white sm:right-8"
            >
              <ChevronRight size={32} />
            </button>

            <motion.img
              layoutId={reducedMotion ? undefined : `gallerypage-image-${activeImage._id}`}
              src={activeImage.imageUrl}
              alt="Gallery"
              className="max-w-full max-h-[90vh] shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
