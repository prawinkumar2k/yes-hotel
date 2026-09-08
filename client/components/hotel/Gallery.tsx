import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { TextLink } from "./HotelButtons";
import { useGallery } from "@/hooks/usePublicData";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const FALLBACK_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    title: "Hotel Exterior",
    span: "row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
    title: "The Lobby",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    title: "Deluxe Room",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    title: "Dining Area",
    span: "row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    title: "Executive Room",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    title: "Hotel Interior",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1587985064135-0366536eab42?auto=format&fit=crop&w=1200&q=80",
    title: "Decorative Detail",
    span: "",
  },
  {
    src: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    title: "Relaxation Space",
    span: "row-span-2",
  },
];

export default function Gallery() {
  const [active, setActive] = useState<number | null>(null);
  const { data } = useGallery({ limit: 8 });
  const reducedMotion = useReducedMotion();

  const IMAGES = data?.length
    ? data.map((img: any, i: number) => ({
        src: img.imageUrl,
        title: img.altText || img.title,
        span: i % 3 === 0 ? "row-span-2" : "",
      }))
    : FALLBACK_IMAGES;

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
              className={`group relative cursor-pointer overflow-hidden ${image.span}`}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 28 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: (i % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setActive(i)}
                className="block h-full w-full"
              >
                <img
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

      {active !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-hotel-black/90 p-6"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setActive(null)}
            className="absolute right-6 top-6 text-hotel-white"
          >
            <X size={28} />
          </button>
          <img
            src={IMAGES[active].src}
            alt={IMAGES[active].title}
            className="max-h-[85vh] max-w-4xl object-contain"
          />
        </div>
      )}
    </section>
  );
}
