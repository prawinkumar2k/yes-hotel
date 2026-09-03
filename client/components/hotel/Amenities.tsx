import {
  BedDouble,
  HeartHandshake,
  UtensilsCrossed,
  Briefcase,
  CalendarCheck,
  Sparkles,
} from "lucide-react";
import Reveal from "./Reveal";

const ITEMS = [
  {
    icon: BedDouble,
    title: "Comfortable Rooms",
    description: "Thoughtfully designed for deep rest.",
  },
  {
    icon: HeartHandshake,
    title: "Warm Hospitality",
    description: "Attentive service that feels personal.",
  },
  {
    icon: UtensilsCrossed,
    title: "Dining Spaces",
    description: "Spaces for meals, meetings and conversations.",
  },
  {
    icon: Briefcase,
    title: "Business Friendly",
    description: "Comfort and convenience for every work trip.",
  },
  {
    icon: CalendarCheck,
    title: "Easy Booking",
    description: "A seamless reservation experience.",
  },
  {
    icon: Sparkles,
    title: "Prime Experience",
    description: "Every detail designed around your comfort.",
  },
];

export default function Amenities() {
  return (
    <section className="bg-hotel-ivory py-24 sm:py-32">
      <div className="container">
        <Reveal className="max-w-xl">
          <h2 className="font-serif text-4xl leading-tight text-hotel-black sm:text-5xl">
            More than a stay.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 90}>
              <item.icon size={30} strokeWidth={1.25} className="text-hotel-gold" />
              <h3 className="mt-5 font-serif text-xl text-hotel-black">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-hotel-black/60">
                {item.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
