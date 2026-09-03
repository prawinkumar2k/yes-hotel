import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { GoldButton, OutlineButton } from "./HotelButtons";
import BookingBar from "./BookingBar";
import { useContent } from "@/hooks/usePublicData";

const FALLBACK = {
  title: "Say yes to\ntime well spent.",
  subtitle: "Thoughtful rooms and warm hospitality—beautifully brought together.",
  metadata: { label: "A Signature Stay by YES Hotels" },
  images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80"],
};

export default function Hero() {
  const { data } = useContent("homepage-hero");
  const content = data ?? FALLBACK;
  const heroImage = content.images?.[0] || FALLBACK.images[0];
  const titleLines = (content.title ?? FALLBACK.title).split("\n");

  return (
    <section
      id="home"
      className="relative flex min-h-[100vh] flex-col justify-end overflow-hidden bg-hotel-black"
    >
      <img
        src={heroImage}
        alt="YES HOTELS cinematic pool and lounge at dusk"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-hotel-black via-hotel-black/60 to-hotel-black/30" />
      <div className="absolute inset-0 bg-hotel-black/20" />

      <div className="container relative z-10 flex flex-1 flex-col justify-center pb-24 pt-40 sm:pb-32">
        <Reveal>
          <SectionLabel light className="justify-center sm:justify-start">
            ✦ {content.metadata?.label ?? FALLBACK.metadata.label}
          </SectionLabel>
        </Reveal>

        <Reveal delay={100}>
          <h1 className="mt-6 max-w-3xl text-center font-serif text-5xl leading-[1.08] text-hotel-white sm:text-left sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            {titleLines.map((line: string, i: number) => (
              <span key={i}>
                {line}
                {i < titleLines.length - 1 && <br />}
              </span>
            ))}
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-md text-center text-base text-hotel-white/75 sm:mx-0 sm:text-left">
            {content.subtitle ?? FALLBACK.subtitle}
          </p>
        </Reveal>

        <Reveal delay={300}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <OutlineButton href="#rooms" light>
              Explore Rooms
            </OutlineButton>
            <GoldButton href="#booking">Book Your Stay &rarr;</GoldButton>
          </div>
        </Reveal>
      </div>

      <div className="relative z-10 mb-0 sm:mb-[-56px] lg:mb-[-40px]">
        <div className="container">
          <Reveal delay={350}>
            <BookingBar />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
