import Reveal from "./Reveal";

const STATS = [
  { value: "24/7", label: "Guest Assistance" },
  { value: "100%", label: "Warm Hospitality" },
  { value: "1", label: "Memorable Stay" },
];

export default function Stats() {
  return (
    <section className="bg-hotel-black py-20 sm:py-28">
      <div className="container grid grid-cols-1 divide-y divide-hotel-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STATS.map((stat, i) => (
          <Reveal
            key={stat.label}
            delay={i * 120}
            className="flex flex-col items-center gap-3 py-10 sm:py-0"
          >
            <span className="font-serif text-5xl text-hotel-gold sm:text-6xl">
              {stat.value}
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-hotel-white/70">
              {stat.label}
            </span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
