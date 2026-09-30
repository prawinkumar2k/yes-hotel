import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function HotelStory() {
  return (
    <section id="about" className="relative py-12 md:py-20 lg:py-28 bg-white text-slate-800 overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-amber-50/30 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] relative z-10 space-y-12 md:space-y-16 lg:space-y-20">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#866A1C] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> EDITORIAL ARCHITECTURE &amp; PHILOSOPHY
            </div>
            <h2 className="font-serif text-4xl sm:text-6xl text-slate-800 font-normal leading-tight">
              A Place to <span className="text-[#c9a227] italic font-serif">Pause</span> &amp; <span className="font-bold">Reconnect</span>.
            </h2>
          </div>

          <p className="max-w-md text-xs sm:text-sm text-slate-500 font-light leading-relaxed">
            YES HOTELS is designed as a sanctuary where time moves at your pace. Every line of marble, light axis, and custom amenity is tailored for your calm.
          </p>
        </div>

        {/* Asymmetric Composition Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Main 70% Viewport Image Container with Clip-Path */}
          <div className="lg:col-span-7 relative group">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl aspect-[16/10]">
              <img
                src="/gallery/hotel-51.jpg"
                alt="YES HOTELS Architectural Pool at Dusk"
                className="w-full h-full object-cover filter brightness-95 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>

            {/* Overlapping Circular Crop Detail Card */}
            <div className="absolute -bottom-8 -right-4 sm:-right-8 w-44 sm:w-56 h-44 sm:h-56 rounded-full border-4 border-white shadow-2xl overflow-hidden hidden sm:block group-hover:scale-110 transition-transform duration-500">
              <img
                src="/gallery/hotel-52.jpg"
                alt="Luxury Suite Balcony Detail"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Overlapping Editorial Content Column */}
          <div className="lg:col-span-5 space-y-6 lg:pl-6">
            <span className="font-mono text-xs text-[#866A1C] tracking-[0.3em] uppercase block">
              PHILOSOPHY 01 · TIME WELL SPENT
            </span>

            <h3 className="font-serif text-3xl sm:text-4xl text-slate-800 font-normal leading-tight">
              Spaces Built Around <span className="italic text-[#c9a227]">Natural Light</span> &amp; Serenity.
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 font-light leading-relaxed">
              From open floor plans that seamlessly transition into coastal gardens to floor-to-ceiling glass suites, our environments foster a deep feeling of openness.
            </p>

            <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-200 font-mono text-xs">
              <div>
                <span className="text-[#c9a227] font-bold block text-lg">100%</span>
                <span className="text-slate-500">Custom Architectural Design</span>
              </div>
              <div>
                <span className="text-[#c9a227] font-bold block text-lg">24 / 7</span>
                <span className="text-slate-500">Concierge &amp; Butler Service</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-700 shadow-lg transition"
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
