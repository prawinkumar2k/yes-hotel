import { BedDouble, Wifi, Coffee, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { GoldButton, OutlineButton, TextLink } from "./HotelButtons";

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

  return (
    <section id="rooms" className="bg-hotel-ivory py-24 sm:py-32">
      <div className="container">
        <Reveal className="max-w-xl">
          <SectionLabel>Curated For You</SectionLabel>
          <h2 className="mt-6 font-serif text-4xl leading-tight text-hotel-black sm:text-5xl">
            Choose your stay.
          </h2>
          <p className="mt-5 text-base text-hotel-black/65 sm:text-lg">
            Beautifully designed rooms for business visits, family trips and
            relaxing city stays.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {isLoading && (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse bg-hotel-white p-7 h-96" />
            ))
          )}
          
          {error && (
            <p className="text-red-500">Failed to load rooms. Please try again.</p>
          )}

          {data && data.map((room: any, i: number) => (
            <Reveal key={room.name} delay={i * 120} className="group">
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <img
                  src={room.images?.[0] || "/placeholder.svg"}
                  alt={room.name}
                  className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-hotel-black/50 via-transparent to-transparent" />
                <span className="absolute bottom-4 right-4 font-serif text-3xl text-hotel-white/80">
                  0{i + 1}
                </span>
              </div>

              <div className="bg-hotel-white p-7 flex flex-col justify-between h-64">
                <div>
                  <h3 className="font-serif text-2xl text-hotel-black">
                    {room.name}
                  </h3>
                  <p className="mt-2 text-sm text-hotel-black/60 line-clamp-2">
                    {room.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-4 text-hotel-gold">
                  <BedDouble size={16} />
                  <Users size={16} />
                  <Wifi size={16} />
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-hotel-black/10 pt-5">
                  <span className="text-sm font-semibold text-hotel-black">
                    From ${room.basePrice} / night
                  </span>
                </div>

                <div className="mt-5 flex gap-3">
                  <OutlineButton className="flex-1 px-4 py-3 text-[11px]">
                    View Details
                  </OutlineButton>
                  <GoldButton className="flex-1 px-4 py-3 text-[11px]">
                    Book Now
                  </GoldButton>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="mt-14 flex justify-center">
          <TextLink href="#rooms">View All Rooms &rarr;</TextLink>
        </Reveal>
      </div>
    </section>
  );
}
