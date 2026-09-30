import Reveal from "./Reveal";

const FEATURES = [
  {
    number: "01",
    title: "Thoughtful Comfort",
    description: "Every detail designed for relaxation.",
  },
  {
    number: "02",
    title: "Beautiful Spaces",
    description: "Modern interiors created with care.",
  },
  {
    number: "03",
    title: "Warm Hospitality",
    description: "Service that makes you feel welcome.",
  },
  {
    number: "04",
    title: "Effortless Stays",
    description: "Simple booking and seamless experiences.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-hotel-ivory py-12 md:py-20 lg:py-32">
      <div className="container">
        <Reveal className="max-w-2xl">
          <h2 className="font-serif text-3xl leading-tight text-hotel-black sm:text-4xl lg:text-5xl">
            Made for every
            <br />
            kind of traveller.
          </h2>
        </Reveal>

        <div className="mt-10 md:mt-14 lg:mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.number} delay={i * 100}>
              <span className="font-serif text-3xl text-hotel-gold/40">
                {feature.number}
              </span>
              <div className="mt-4 h-px w-10 bg-hotel-gold" />
              <h3 className="mt-5 font-serif text-xl text-hotel-black">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-hotel-black/60">
                {feature.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
