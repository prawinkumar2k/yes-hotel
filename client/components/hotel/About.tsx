import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { TextLink } from "./HotelButtons";
import { useContent } from "@/hooks/usePublicData";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const FALLBACK = {
  title: "A place that feels\nwonderfully away.",
  description:
    "Created for those who value beautiful spaces and meaningful moments, YES Hotels brings nature, comfort and considered service into perfect balance.\n\nWhether it is a family weekend, celebration or focused business trip, every detail makes your time together feel effortless.",
  images: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=80",
  ],
};

export default function About() {
  const { data } = useContent("homepage-about");
  const content = data ?? FALLBACK;
  const titleLines = (content.title ?? FALLBACK.title).split("\n");
  const paragraphs = (content.description ?? FALLBACK.description).split("\n\n");
  const [mainImage, detailImage] = content.images?.length ? content.images : FALLBACK.images;

  // Real scroll-parallax (framer-motion was installed but never actually
  // used anywhere in this codebase until now) — the main image moves at a
  // different rate than the page scroll, clipped by the image's own
  // overflow-hidden wrapper so it never causes horizontal/vertical overflow
  // of the section itself. Disabled under prefers-reduced-motion, same as
  // every other animation in this app.
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: imageWrapRef, offset: ["start end", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], reducedMotion ? ["0%", "0%"] : ["-8%", "8%"]);

  return (
    <section
      id="about"
      className="overflow-x-hidden bg-hotel-ivory py-24 sm:py-32 lg:py-40"
    >
      <div className="container grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <SectionLabel>Welcome to YES Hotels</SectionLabel>
          <h2 className="mt-6 font-serif text-4xl leading-[1.15] text-hotel-black sm:text-5xl lg:text-[3.4rem]">
            {titleLines.map((line: string, i: number) => (
              <span key={i}>
                {line}
                {i < titleLines.length - 1 && <br />}
              </span>
            ))}
          </h2>
        </Reveal>

        <Reveal delay={150} className="flex flex-col justify-center">
          {paragraphs.map((p: string, i: number) => (
            <p key={i} className="mt-5 text-base leading-relaxed text-hotel-black/70 sm:text-lg first:mt-0">
              {p}
            </p>
          ))}
          <div className="mt-8">
            <TextLink href="#gallery">Discover Our Story &rarr;</TextLink>
          </div>
        </Reveal>
      </div>

      <Reveal delay={200} className="container mt-16 lg:mt-24">
        <div className="relative mx-auto max-w-5xl">
          <div ref={imageWrapRef} className="aspect-[16/9] w-full overflow-hidden">
            <motion.img
              src={mainImage}
              alt="YES Hotels lounge interior"
              className="h-full w-full scale-125 object-cover will-change-transform"
              style={{ y: parallaxY }}
            />
          </div>
          {detailImage && (
            <div className="absolute -bottom-8 -right-4 hidden aspect-[4/3] w-1/3 overflow-hidden border-8 border-hotel-ivory shadow-2xl sm:block lg:-right-10">
              <img
                src={detailImage}
                alt="YES Hotels lobby detail"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}
