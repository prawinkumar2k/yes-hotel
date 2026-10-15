import React from "react";
import { Link } from "react-router-dom";
import { useHotelSettings } from "@/hooks/usePublicData";
import { HOTEL, hotelAddressOneLine } from "@shared/hotel-info";
import { Sparkles, ArrowRight, BedDouble } from "lucide-react";
import BrandLogo from "@/components/hotel/BrandLogo";

const DESCRIPTION =
  "A contemporary 3-star boutique hotel at Hosa Road Junction, Electronic City — clean, comfortable rooms beside Hosa Road Metro, with a 24-hour front desk.";

export default function Footer() {
  const { data } = useHotelSettings();
  // Contact details come from the hotel's own facts; an email shows only when one is saved in settings.
  const email: string | undefined = (data as any)?.email || undefined;

  return (
    <footer className="bg-[#0b0b0b] text-white border-t border-[#262930] pt-16 md:pt-20 lg:pt-24 pb-8 md:pb-10 lg:pb-12 relative overflow-hidden">
      {/* Background Vignette */}
      <div className="absolute inset-0 bg-radial-vignette opacity-60 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] relative z-10 space-y-12 md:space-y-16 lg:space-y-20">
        {/* Massive Film-End Typography Banner */}
        <div className="text-center space-y-6 max-w-5xl mx-auto border-b border-[#262930] pb-12 md:pb-16 lg:pb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#e5c76b] text-xs font-mono font-bold tracking-widest uppercase">
            <Sparkles size={13} className="text-[#c9a227]" /> THE END OF ORDINARY
          </div>

          <h2 className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-normal tracking-tight text-white leading-none">
            SAY YES TO <br />
            <span className="text-[#c9a227] italic font-serif">TIME WELL SPENT.</span>
          </h2>

          <div className="pt-6">
            <Link
              to="/search"
              className="inline-flex items-center gap-3 min-h-[44px] px-6 md:px-8 py-3.5 md:py-4 bg-[#c9a227] hover:bg-[#e5c76b] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-2xl shadow-2xl transition hover:scale-105"
            >
              Reserve Your Stay <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Links & Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-10 lg:gap-12 font-mono text-xs">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="font-serif text-2xl font-bold tracking-wider text-white flex items-center gap-2">
              <BrandLogo variant="full" className="h-20 w-auto" />
            </Link>
            <p className="text-gray-400 font-sans font-light text-sm max-w-md leading-relaxed">
              {DESCRIPTION}
            </p>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-4">
            <span className="text-[#c9a227] font-bold uppercase tracking-widest block">Navigation</span>
            <ul className="space-y-2 text-gray-300 font-sans text-sm">
              <li><Link to="/" className="hover:text-[#c9a227] transition">Home</Link></li>
              <li><Link to="/about" className="hover:text-[#c9a227] transition">About Us</Link></li>
              <li><Link to="/rooms" className="hover:text-[#c9a227] transition">Rooms</Link></li>
              <li><Link to="/gallery" className="hover:text-[#c9a227] transition">Gallery</Link></li>
              <li><Link to="/contact" className="hover:text-[#c9a227] transition">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <span className="text-[#c9a227] font-bold uppercase tracking-widest block">Front Desk · 24 Hours</span>
            <ul className="space-y-2 text-gray-300 font-sans text-sm">
              <li><a href={HOTEL.phoneHref} className="hover:text-[#c9a227] transition">{HOTEL.phones[0]}</a></li>
              {email && <li><a href={`mailto:${email}`} className="hover:text-[#c9a227] transition">{email}</a></li>}
              <li><a href={HOTEL.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-[#c9a227] transition">Instagram @{HOTEL.instagram}</a></li>
              <li className="text-gray-400 text-xs">{hotelAddressOneLine()}</li>
              <li className="text-gray-400 text-xs">Check-in {HOTEL.checkIn} · Check-out {HOTEL.checkOut}</li>
            </ul>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="border-t border-[#262930] pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-gray-500 gap-4">
          <p>© {new Date().getFullYear()} YES HOTELS, Bengaluru. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="hover:text-gray-300 transition">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-gray-300 transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
