import React, { useState, useEffect } from "react";
import Hero3D from "./Hero3D";
import BookingBar from "./BookingBar";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ArrowDown, Sparkles } from "lucide-react";

const HERO_VIDEO_URL = "https://cdn.pixabay.com/video/2024/02/29/202392-918066367_tiny.mp4";
const HERO_POSTER_IMAGE = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80";

export default function Hero() {
  const reducedMotion = useReducedMotion();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setPointer({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      id="home"
      className="relative min-h-[100vh] w-full flex flex-col justify-between overflow-hidden bg-[#0b0b0b] text-white pt-28 pb-12"
    >
      {/* LAYER 1: Background Video / Image */}
      {reducedMotion ? (
        <img
          src={HERO_POSTER_IMAGE}
          alt="YES HOTELS cinematic pool and lounge"
          className="absolute inset-0 h-full w-full object-cover scale-105 transition-transform duration-1000"
        />
      ) : (
        <video
          className="absolute inset-0 h-full w-full object-cover scale-105 filter brightness-75 transition-all duration-1000"
          style={{
            transform: `scale(1.05) translate(${pointer.x * -10}px, ${pointer.y * -10}px)`,
          }}
          src={HERO_VIDEO_URL}
          poster={HERO_POSTER_IMAGE}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}

      {/* LAYER 2: Dark Atmospheric Haze */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-[#0b0b0b]/40 pointer-events-none" />

      {/* LAYER 3: Soft Radial Vignette */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-80" />

      {/* LAYER 4: Interactive WebGL Spatial 3D Scene */}
      {!reducedMotion && <Hero3D pointer={pointer} />}

      {/* LAYER 5 & 6: Floating Editorial Typography & Gold Metadata */}
      <div className="container relative z-20 mx-auto px-4 md:px-8 my-auto max-w-[1400px]">
        <div className="max-w-4xl space-y-6">
          {/* Layer 6: Champagne Gold Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/40 backdrop-blur-md text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase transition-all duration-700"
            style={{
              transform: `translate(${pointer.x * 12}px, ${pointer.y * 12}px)`,
            }}
          >
            <Sparkles size={13} className="text-[#c9a227]" />
            A Signature Luxury Hotel OS Experience
          </div>

          {/* Layer 5: Massive Overlapping Editorial Typography */}
          <h1
            className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-[7.5rem] leading-[0.95] tracking-tight text-white font-normal transition-transform duration-500 ease-out"
            style={{
              transform: `translate(${pointer.x * 20}px, ${pointer.y * 20}px)`,
            }}
          >
            <span className="block font-serif text-[#c9a227] italic">SAY YES</span>
            <span className="block font-sans font-bold text-white tracking-tighter">TO TIME</span>
            <span className="block font-serif text-gray-300 font-light pl-4 md:pl-12">WELL SPENT.</span>
          </h1>

          <p
            className="max-w-xl text-sm md:text-base text-gray-300 font-light leading-relaxed pl-1 border-l-2 border-[#c9a227] ml-1 transition-transform duration-700"
            style={{
              transform: `translate(${pointer.x * 15}px, ${pointer.y * 15}px)`,
            }}
          >
            Immerse in bespoke hospitality, spatial architecture, and seamless luxury stay operations.
          </p>
        </div>
      </div>

      {/* LAYER 7 & 9: Glassmorphic Booking Console & Scroll Indicator */}
      <div className="container relative z-30 mx-auto px-4 md:px-8 max-w-[1400px] space-y-4">
        <BookingBar />

        <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-ping" />
            <span>01 / 06 · ARCHITECTURAL LANDING</span>
          </div>

          <a href="#about" className="flex items-center gap-2 hover:text-[#c9a227] transition">
            <span>SCROLL TO EXPLORE</span>
            <ArrowDown size={14} className="animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
}
