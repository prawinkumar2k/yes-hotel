import { BedDouble, Wifi, Users, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import SplitReveal from "./SplitReveal";
import Magnetic from "./Magnetic";
import { TextLink } from "./HotelButtons";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Previously a 3-column grid of identical cards — the exact "square card"
 * feel this redesign is meant to move away from. Also fixed two real,
 * pre-existing bugs found while rewriting this: "View Details" and
 * "Book Now" had no onClick/Link at all (dead buttons), and prices were
 * prefixed with "$" while every other price on the site uses "₹".
 */
export default function Rooms() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["roomCategories"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/categories");
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
  });
  const reducedMotion = useReducedMotion();

  const rooms = (data ?? []).slice(0, 3);

  return (
    <section id="rooms" className="bg-hotel-ivory py-24 sm:py-32 lg:py-40">
      <div className="container">
        <Reveal className="max-w-xl">
          <SectionLabel>Curated For You</SectionLabel>
          <h2 className="mt-6 font-serif text-4xl leading-tight text-hotel-black sm:text-5xl">
            <SplitReveal as="span" text="Choose your stay." trigger="scroll" />
          </h2>
          <p className="mt-5 text-base text-hotel-black/65 sm:text-lg">
            Beautifully designed rooms for business visits, family trips and
            relaxing city stays.
          </p>
        </Reveal>

        {isLoading && (
          <div className="mt-20 space-y-24">
            {[0, 1].map((i) => (
              <div key={i} className="h-[70vh] animate-pulse bg-hotel-black/5" />
            ))}
          </div>
        )}

        {error && (
          <p className="mt-16 text-red-500">Failed to load rooms. Please try again.</p>
        )}

        <div className="mt-20 space-y-24 lg:space-y-32">
          {rooms.map((room: any, i: number) => (
            <RoomRow key={room._id ?? room.name} room={room} index={i} reducedMotion={reducedMotion} />
          ))}
        </div>

        <Reveal delay={200} className="mt-20 flex justify-center">
          <TextLink href="/rooms">View All Rooms &rarr;</TextLink>
        </Reveal>
      </div>
    </section>
  );
}

function RoomRow({ room, index, reducedMotion }: { room: any; index: number; reducedMotion: boolean }) {
  const reversed = index % 2 !== 0;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12 ${reversed ? "lg:flex-row-reverse" : ""}`}
    >
      {/* Large, asymmetric feature image — 65% width on desktop, never a
          square/uniform card. Index number overlaid large and translucent,
          an editorial-catalogue convention rather than a card badge. */}
      <Link
        to={`/rooms/${room.slug}`}
        data-cursor="EXPLORE"
        className="group relative block aspect-[4/5] w-full overflow-hidden lg:aspect-[16/11] lg:w-[65%]"
      >
        <img
          src={room.images?.[0] || "/placeholder.svg"}
          alt={room.name}
          className="h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-hotel-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="pointer-events-none absolute -bottom-6 left-4 font-serif text-[9rem] leading-none text-hotel-white/15 sm:-bottom-10 sm:text-[13rem]">
          0{index + 1}
        </span>
        <span className="absolute bottom-6 right-6 flex translate-y-2 items-center gap-2 bg-hotel-white px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-hotel-black opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          Explore <ArrowUpRight size={14} />
        </span>
      </Link>

      {/* Floating info panel — not a bordered card, just typography and
          space, offset over/beside the image rather than stacked under it. */}
      <div className="w-full lg:w-[35%]">
        <h3 className="font-serif text-3xl text-hotel-black sm:text-4xl">{room.name}</h3>
        <p className="mt-4 text-sm leading-relaxed text-hotel-black/60 sm:text-base">
          {room.description}
        </p>

        <div className="mt-6 flex items-center gap-5 text-hotel-gold-text">
          <span className="flex items-center gap-1.5 text-xs text-hotel-black/60">
            <BedDouble size={15} className="text-hotel-gold" /> {room.bedType || "King Bed"}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-hotel-black/60">
            <Users size={15} className="text-hotel-gold" /> Up to {room.capacity?.adults ?? 2}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-hotel-black/60">
            <Wifi size={15} className="text-hotel-gold" /> Wi-Fi
          </span>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-hotel-black/10 pt-6">
          <div>
            <p className="font-serif text-2xl text-hotel-black">₹{room.basePrice}</p>
            <p className="text-[10px] uppercase tracking-widest text-hotel-black/50">Per Night</p>
          </div>
          <div className="flex gap-3">
            <Magnetic strength={0.25}>
              <Link
                to={`/rooms/${room.slug}`}
                className="border border-hotel-black/20 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-hotel-black transition-colors hover:border-hotel-gold"
              >
                Details
              </Link>
            </Magnetic>
            <Magnetic strength={0.25}>
              <Link
                to="/search"
                className="bg-hotel-gold px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-hotel-black transition-colors hover:bg-hotel-champagne"
              >
                Book Now
              </Link>
            </Magnetic>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
