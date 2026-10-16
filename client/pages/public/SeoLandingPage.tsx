import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Navbar from "@/components/hotel/Navbar";
import Footer from "@/components/hotel/Footer";
import { GoldButton } from "@/components/hotel/HotelButtons";
import {
  MapPin,
  Clock,
  Car,
  Train,
  Footprints,
  ShieldCheck,
  Wifi,
  Sparkles,
  Phone,
  Calendar,
  Users,
  ChevronDown,
  CheckCircle2,
  ArrowRight,
  Building,
  BedDouble,
  Receipt,
  HelpCircle,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { useHotelContact, useStartingPrice } from "@/hooks/usePublicData";

export default function SeoLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  // Phone from Admin → Settings; "From ₹…" is the lowest active room rate.
  const contact = useHotelContact();
  const fromPrice = useStartingPrice();
  const fromLabel = fromPrice ? `From ₹${fromPrice.toLocaleString("en-IN")}` : "Best direct rate";

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Fetch verified SEO landing page data from API
  const { data: pageData, isLoading, isError } = useQuery({
    queryKey: ["seo-landing-page", slug],
    queryFn: async () => {
      const res = await fetch(`/api/seo/pages/${slug}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load page");
      return json.data;
    },
    enabled: !!slug,
  });

  // Track page visit & store marketing attribution in sessionStorage
  useEffect(() => {
    if (!slug) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const attribution = {
        landingPage: `/hotels-near/${slug}`,
        utmSource: urlParams.get("utm_source") || "organic_seo",
        utmMedium: urlParams.get("utm_medium") || "search",
        utmCampaign: urlParams.get("utm_campaign") || slug,
        utmTerm: urlParams.get("utm_term") || undefined,
        utmContent: urlParams.get("utm_content") || undefined,
        referrer: document.referrer || undefined,
        device: window.innerWidth < 768 ? "mobile" : "desktop",
      };
      sessionStorage.setItem("yes:attribution", JSON.stringify(attribution));
    } catch {
      // Storage unavailable
    }
  }, [slug]);

  // Update document title, description and canonical link dynamically
  useEffect(() => {
    if (!pageData) return;
    document.title = `${pageData.metaTitle} | YES HOTELS`;

    let descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute("content", pageData.metaDescription);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute("href", pageData.canonicalUrl || `https://yeshotels.in/hotels-near/${slug}`);
    }
  }, [pageData, slug]);

  const handleBookingSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Track booking start
    fetch("/api/seo/track-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);

    navigate(`/search?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`);
  };

  const handleQuickBookRoom = (categoryId: string) => {
    fetch("/api/seo/track-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);

    navigate(`/booking/guest-details?category=${categoryId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-hotel-ivory flex items-center justify-center">
        <div className="text-center">
          <img src="/brand/yes-mark.png" alt="YES HOTELS" className="w-16 h-16 mx-auto mb-4 animate-pulse object-contain" />
          <p className="font-serif text-lg text-hotel-black">Loading destination details...</p>
        </div>
      </div>
    );
  }

  if (isError || !pageData) {
    return (
      <div className="min-h-screen bg-hotel-ivory flex flex-col justify-between">
        <Navbar transparent={false} />
        <div className="max-w-2xl mx-auto px-4 py-32 text-center">
          <h1 className="font-serif text-3xl text-hotel-black mb-4">Destination Not Found</h1>
          <p className="text-hotel-black/70 mb-8">
            We couldn't locate the requested locality guide. Explore our central boutique hotel at Hosa Road Junction.
          </p>
          <Link to="/">
            <GoldButton>Return to Homepage</GoldButton>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hotel-ivory selection:bg-hotel-gold selection:text-black">
      <Navbar transparent={false} />

      {/* Breadcrumb Navigation */}
      <div className="pt-24 pb-3 bg-white border-b border-hotel-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-hotel-black/60">
            <Link to="/" className="hover:text-hotel-gold transition">Home</Link>
            <span>/</span>
            <Link to="/rooms" className="hover:text-hotel-gold transition">Hotels Near</Link>
            <span>/</span>
            <span className="text-hotel-black font-medium">{pageData.targetLocality}</span>
          </nav>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-white to-hotel-ivory py-12 sm:py-16 border-b border-hotel-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              {/* Proximity Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Verified Proximity: {pageData.distanceKm === 0 ? "At Location (0 km)" : `${pageData.distanceKm} km away`}</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-hotel-black font-normal tracking-tight leading-tight mb-4">
                {pageData.h1}
              </h1>

              <p className="text-base sm:text-lg text-hotel-black/80 font-light leading-relaxed mb-6">
                {pageData.h2Subheading}
              </p>

              {/* Transit & Commute Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-white p-3.5 rounded-lg border border-hotel-black/10 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-hotel-gold/15 flex items-center justify-center text-hotel-gold shrink-0">
                    <Car size={18} />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-hotel-black/50 tracking-wider">Drive</span>
                    <span className="text-sm font-semibold text-hotel-black">{pageData.travelTimeMinutes?.car} mins</span>
                  </div>
                </div>

                {pageData.travelTimeMinutes?.metro && (
                  <div className="bg-white p-3.5 rounded-lg border border-hotel-black/10 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 shrink-0">
                      <Train size={18} />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-hotel-black/50 tracking-wider">Metro</span>
                      <span className="text-sm font-semibold text-hotel-black">{pageData.travelTimeMinutes.metro} mins</span>
                    </div>
                  </div>
                )}

                {pageData.travelTimeMinutes?.walking && (
                  <div className="bg-white p-3.5 rounded-lg border border-hotel-black/10 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-600 shrink-0">
                      <Footprints size={18} />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-hotel-black/50 tracking-wider">Walk</span>
                      <span className="text-sm font-semibold text-hotel-black">{pageData.travelTimeMinutes.walking} mins</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Contact & WhatsApp Pill */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-hotel-black/70">
                <a
                  href={contact.phoneHref}
                  className="inline-flex items-center gap-1.5 font-medium text-hotel-black hover:text-hotel-gold transition"
                >
                  <Phone size={14} className="text-hotel-gold" />
                  <span>Front Desk: {contact.phone}</span>
                </a>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  24-Hour Reception Available
                </span>
              </div>
            </div>

            {/* Right Booking Engine Card */}
            <div className="lg:col-span-5">
              <div className="bg-white p-6 sm:p-7 rounded-xl border border-hotel-gold/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-hotel-gold via-amber-300 to-hotel-gold" />

                <div className="flex items-center justify-between mb-5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-hotel-black/50 block">Direct Website Price</span>
                    <span className="text-2xl font-serif font-bold text-hotel-black">{fromLabel} <span className="text-xs font-sans font-normal text-hotel-black/60">/ night</span></span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 text-[11px] font-bold tracking-wide border border-amber-200">
                    Best Rate Guarantee
                  </span>
                </div>

                <form onSubmit={handleBookingSearch} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="landing-checkin" className="block text-[10px] uppercase tracking-widest font-bold text-hotel-black/60 mb-1.5">
                        Check In
                      </label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-black/40" />
                        <input
                          id="landing-checkin"
                          type="date"
                          min={today}
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                          className="w-full text-xs font-medium pl-8 pr-2 py-2.5 rounded-md border border-hotel-black/20 focus:outline-none focus:border-hotel-gold"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="landing-checkout" className="block text-[10px] uppercase tracking-widest font-bold text-hotel-black/60 mb-1.5">
                        Check Out
                      </label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-black/40" />
                        <input
                          id="landing-checkout"
                          type="date"
                          min={checkIn || today}
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          className="w-full text-xs font-medium pl-8 pr-2 py-2.5 rounded-md border border-hotel-black/20 focus:outline-none focus:border-hotel-gold"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="landing-adults" className="block text-[10px] uppercase tracking-widest font-bold text-hotel-black/60 mb-1.5">
                        Adults
                      </label>
                      <select
                        id="landing-adults"
                        value={adults}
                        onChange={(e) => setAdults(Number(e.target.value))}
                        className="w-full text-xs font-medium px-3 py-2.5 rounded-md border border-hotel-black/20 focus:outline-none focus:border-hotel-gold"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n} {n === 1 ? "Adult" : "Adults"}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="landing-children" className="block text-[10px] uppercase tracking-widest font-bold text-hotel-black/60 mb-1.5">
                        Children
                      </label>
                      <select
                        id="landing-children"
                        value={children}
                        onChange={(e) => setChildren(Number(e.target.value))}
                        className="w-full text-xs font-medium px-3 py-2.5 rounded-md border border-hotel-black/20 focus:outline-none focus:border-hotel-gold"
                      >
                        {[0, 1, 2].map((n) => (
                          <option key={n} value={n}>{n} Children</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <GoldButton type="submit" className="w-full justify-center py-3 text-sm font-semibold tracking-wider uppercase">
                    Check Availability & Book
                  </GoldButton>
                </form>

                <div className="mt-4 pt-4 border-t border-hotel-black/10 grid grid-cols-2 gap-2 text-[11px] text-hotel-black/70">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Free Wi-Fi & Parking</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>No Hidden Fees</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Lift to All Floors</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>GST Invoice Available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Route & Distance Map Card */}
      <section className="py-12 bg-white border-b border-hotel-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-hotel-ivory/60 border border-hotel-black/10 rounded-xl p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-hotel-gold block mb-1">
                  Accurate Travel & Directions
                </span>
                <h2 className="font-serif text-2xl text-hotel-black font-normal mb-2">
                  Getting to YES HOTELS from {pageData.destinationName}
                </h2>
                <p className="text-sm text-hotel-black/80 max-w-2xl leading-relaxed">
                  {pageData.distanceRouteDetails}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=12.8715,77.6534`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-hotel-black text-white text-xs font-semibold hover:bg-hotel-black/90 transition shadow-sm"
                >
                  <MapPin size={15} />
                  <span>Get Live Directions</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Room Categories with Instant Direct Booking */}
      <section className="py-14 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-bold uppercase tracking-widest text-hotel-gold block mb-1">
              Select Your Accommodation
            </span>
            <h2 className="font-serif text-3xl text-hotel-black font-normal">
              Clean, Modern AC Rooms for Every Guest
            </h2>
            <p className="text-sm text-hotel-black/70 mt-2">
              All 19 rooms feature individual air-conditioning, private hot shower bathrooms, electric kettles, and high-speed Wi-Fi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(pageData.roomCategories || []).map((cat: any) => (
              <div
                key={cat._id}
                className="bg-white rounded-xl border border-hotel-black/10 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={cat.images?.[0] || "/brand/icon-512.png"}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                      Up to {cat.capacity?.adults || 2} Guests
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-serif text-lg text-hotel-black font-semibold mb-1">{cat.name}</h3>
                    <p className="text-xs text-hotel-black/60 line-clamp-2 mb-3">
                      {cat.shortDescription || cat.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(cat.amenities || []).slice(0, 3).map((a: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-hotel-ivory text-hotel-black/70 text-[10px] font-medium border border-hotel-black/5">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-hotel-black/5 mt-2">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase text-hotel-black/50">Direct Rate</span>
                    <span className="font-serif text-lg font-bold text-hotel-black">
                      ₹{cat.basePrice?.toLocaleString("en-IN")}
                      <span className="text-[10px] font-normal text-hotel-black/50"> / night</span>
                    </span>
                  </div>

                  <button
                    onClick={() => handleQuickBookRoom(cat._id)}
                    className="w-full py-2.5 px-3 rounded-lg bg-hotel-gold text-black text-xs font-bold uppercase tracking-wider hover:bg-hotel-gold/90 transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Book Direct</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Overview & Why Stay at YES HOTELS */}
      <section className="py-14 bg-white border-t border-b border-hotel-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7">
              <span className="text-[11px] font-bold uppercase tracking-widest text-hotel-gold block mb-1">
                Authentic Hospitality
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-hotel-black font-normal mb-6">
                Why Guests Prefer YES HOTELS near {pageData.targetLocality}
              </h2>

              <div className="prose prose-sm text-hotel-black/80 max-w-none leading-relaxed space-y-4 whitespace-pre-line font-light">
                {pageData.overviewContent}
              </div>
            </div>

            <div className="lg:col-span-5 bg-hotel-ivory p-6 rounded-xl border border-hotel-black/10">
              <h3 className="font-serif text-lg text-hotel-black font-semibold mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-hotel-gold" />
                <span>Stay Guarantees</span>
              </h3>

              <ul className="space-y-3.5">
                {(pageData.stayHighlights || []).map((h: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-hotel-black/80">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-5 border-t border-hotel-black/10">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-hotel-black/50 mb-2">
                  Nearby Verified Hubs
                </span>
                <div className="space-y-2">
                  {(pageData.nearbyAttractions || []).map((att: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-hotel-black/5 last:border-none">
                      <span className="font-medium text-hotel-black">{att.name}</span>
                      <span className="text-hotel-black/60 font-semibold">{att.distanceKm} km</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      {pageData.faqs && pageData.faqs.length > 0 && (
        <section className="py-14 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <span className="text-[11px] font-bold uppercase tracking-widest text-hotel-gold block mb-1">
                Frequently Asked Questions
              </span>
              <h2 className="font-serif text-3xl text-hotel-black font-normal">
                Everything You Need to Know Before Booking
              </h2>
            </div>

            <div className="space-y-3">
              {pageData.faqs.map((faq: any, idx: number) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-hotel-black/10 overflow-hidden shadow-sm"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-serif text-base text-hotel-black font-medium hover:text-hotel-gold transition"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        size={18}
                        className={`text-hotel-black/40 transition-transform duration-200 shrink-0 ${
                          isOpen ? "rotate-180 text-hotel-gold" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-sm text-hotel-black/75 font-light leading-relaxed border-t border-hotel-black/5 pt-3">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Bottom Sticky Mobile CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-hotel-black/10 p-3 sm:hidden z-40 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-[10px] text-hotel-black/50 block font-bold uppercase">Direct Rate</span>
          <span className="font-serif text-base font-bold text-hotel-black">{fromLabel}</span>
        </div>
        <div className="flex gap-2">
          <a
            href={contact.phoneHref}
            className="p-2.5 rounded-lg border border-hotel-black/20 text-hotel-black"
          >
            <Phone size={16} />
          </a>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="px-5 py-2.5 rounded-lg bg-hotel-gold text-black text-xs font-bold uppercase tracking-wider"
          >
            Book Now
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
