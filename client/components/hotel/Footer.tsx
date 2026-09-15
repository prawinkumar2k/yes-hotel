import React from "react";
import { Link } from "react-router-dom";
import { useHotelSettings } from "@/hooks/usePublicData";
import { Sparkles, ArrowRight, BedDouble } from "lucide-react";

const FALLBACK = {
  hotelName: "YES HOTELS",
  description:
    "A signature luxury hospitality brand crafted for spatial peace, bespoke service, and memories that stay long after checkout.",
  email: "reservations@yeshotels.com",
  phone: "+91 98765 43210",
  address: "Luxury Beach Promenade, Suite 100, Goa 403001",
};

export default function Footer() {
  const { data } = useHotelSettings();
  const settings = data ?? FALLBACK;

  return (
    <footer className="bg-[#0b0b0b] text-white border-t border-[#262930] pt-24 pb-12 relative overflow-hidden">
      {/* Background Vignette */}
      <div className="absolute inset-0 bg-radial-vignette opacity-60 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] relative z-10 space-y-20">
        {/* Massive Film-End Typography Banner */}
        <div className="text-center space-y-6 max-w-5xl mx-auto border-b border-[#262930] pb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
            <Sparkles size={13} className="text-[#c9a227]" /> THE END OF ORDINARY
          </div>

          <h2 className="font-serif text-5xl sm:text-7xl md:text-8xl font-normal tracking-tight text-white leading-none">
            SAY YES TO <br />
            <span className="text-[#c9a227] italic font-serif">TIME WELL SPENT.</span>
          </h2>

          <div className="pt-6">
            <Link
              to="/search"
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#c9a227] hover:bg-[#e5c76b] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-2xl shadow-2xl transition hover:scale-105"
            >
              Reserve Your Stay <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Links & Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 font-mono text-xs">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="font-serif text-2xl font-bold tracking-wider text-white flex items-center gap-2">
              <BedDouble className="text-[#c9a227]" size={20} />
              YES <span className="text-[#c9a227] italic font-normal">HOTELS</span>
            </Link>
            <p className="text-gray-400 font-sans font-light text-sm max-w-md leading-relaxed">
              {settings.description ?? FALLBACK.description}
            </p>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-4">
            <span className="text-[#c9a227] font-bold uppercase tracking-widest block">Navigation</span>
            <ul className="space-y-2 text-gray-300 font-sans text-sm">
              <li><Link to="/" className="hover:text-[#c9a227] transition">Home</Link></li>
              <li><Link to="/about" className="hover:text-[#c9a227] transition">About Us</Link></li>
              <li><Link to="/rooms" className="hover:text-[#c9a227] transition">Suites & Villas</Link></li>
              <li><Link to="/gallery" className="hover:text-[#c9a227] transition">Visual Gallery</Link></li>
              <li><Link to="/contact" className="hover:text-[#c9a227] transition">Contact Concierge</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <span className="text-[#c9a227] font-bold uppercase tracking-widest block">Concierge Desk</span>
            <ul className="space-y-2 text-gray-300 font-sans text-sm">
              <li>{settings.email ?? FALLBACK.email}</li>
              <li>{settings.phone ?? FALLBACK.phone}</li>
              <li className="text-gray-400 text-xs">{settings.address ?? FALLBACK.address}</li>
            </ul>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="border-t border-[#262930] pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-gray-500 gap-4">
          <p>© {new Date().getFullYear()} YES HOTELS LUXURY SUITES. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="hover:text-gray-300 transition">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-gray-300 transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
