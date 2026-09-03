import { Star } from "lucide-react";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { useTestimonials } from "@/hooks/usePublicData";

export default function Testimonials() {
  const { data, isLoading } = useTestimonials();
  const testimonials = data ?? [];

  if (!isLoading && testimonials.length === 0) return null;

  return (
    <section className="bg-hotel-ivory py-24 sm:py-32">
      <div className="container">
        <Reveal className="max-w-xl">
          <SectionLabel>Guest Stories</SectionLabel>
          <h2 className="mt-6 font-serif text-4xl leading-tight text-hotel-black sm:text-5xl">
            Loved by those
            <br />
            who stayed.
          </h2>
        </Reveal>

        {isLoading ? (
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse bg-hotel-white h-56 border border-hotel-black/10" />
            ))}
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {testimonials.slice(0, 6).map((t: any, i: number) => (
              <Reveal key={t._id} delay={i * 100} className="bg-hotel-white p-8 border border-hotel-black/10 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-hotel-gold mb-4">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} size={14} fill={s < t.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <p className="text-sm text-hotel-black/70 leading-relaxed">"{t.comment}"</p>
                </div>
                <div className="mt-6 pt-4 border-t border-hotel-black/10">
                  <p className="font-serif text-hotel-black">{t.name}</p>
                  {t.location && <p className="text-xs text-hotel-black/50">{t.location}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
