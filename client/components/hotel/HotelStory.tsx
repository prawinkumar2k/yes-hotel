import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function HotelStory() {
  return (
    <section id="about" className="relative py-28 bg-[#0b0b0b] text-white overflow-hidden">
      {/* Background Subtle Atmosphere Haze */}
      <div className="absolute inset-0 bg-radial-vignette opacity-50 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] relative z-10 space-y-20">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#262930] pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> EDITORIAL ARCHITECTURE & PHILOSOPHY
            </div>
            <h2 className="font-serif text-4xl sm:text-6xl text-white font-normal leading-tight">
              A Place to <span className="text-[#c9a227] italic font-serif">Pause</span> & <span className="font-bold">Reconnect</span>.
            </h2>
          </div>

          <p className="max-w-md text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
            YES HOTELS is designed as a sanctuary where time moves at your pace. Every line of marble, light axis, and custom amenity is tailored for your calm.
          </p>
        </div>

        {/* Asymmetric Composition Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Main 70% Viewport Image Container with Clip-Path */}
          <div className="lg:col-span-7 relative group">
            <div className="relative rounded-3xl overflow-hidden border border-[#262930] shadow-2xl aspect-[16/10]">
              <img
                src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80"
                alt="YES HOTELS Architectural Pool at Dusk"
                className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-transparent to-transparent" />
            </div>

            {/* Overlapping Circular Crop Detail Card */}
            <div className="absolute -bottom-8 -right-4 sm:-right-8 w-44 sm:w-56 h-44 sm:h-56 rounded-full border-4 border-[#0b0b0b] shadow-2xl overflow-hidden hidden sm:block group-hover:scale-110 transition-transform duration-500">
              <img
                src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
                alt="Luxury Suite Balcony Detail"
                className="w-full h-full object-cover filter brightness-90"
              />
            </div>
          </div>

          {/* Overlapping Editorial Content Column */}
          <div className="lg:col-span-5 space-y-6 lg:pl-6">
            <span className="font-mono text-xs text-[#c9a227] tracking-[0.3em] uppercase block">
              PHILOSOPHY 01 · TIME WELL SPENT
            </span>

            <h3 className="font-serif text-3xl sm:text-4xl text-white font-normal leading-tight">
              Spaces Built Around <span className="italic text-[#c9a227]">Natural Light</span> & Serenity.
            </h3>

            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              From open floor plans that seamlessly transition into coastal gardens to floor-to-ceiling glass suites, our environments foster a deep feeling of openness.
            </p>

            <div className="pt-4 grid grid-cols-2 gap-4 border-t border-[#262930] font-mono text-xs">
              <div>
                <span className="text-[#c9a227] font-bold block text-lg">100%</span>
                <span className="text-gray-400">Custom Architectural Design</span>
              </div>
              <div>
                <span className="text-[#c9a227] font-bold block text-lg">24 / 7</span>
                <span className="text-gray-400">Concierge & Butler Service</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#121316] hover:bg-[#1a1d24] text-[#e5c76b] font-mono font-bold text-xs uppercase tracking-widest rounded-xl border border-[#c9a227]/40 shadow-lg transition"
              >
                Read Our Story <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
