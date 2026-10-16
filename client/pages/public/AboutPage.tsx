import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { Link } from "react-router-dom";
import { useContent } from "@/hooks/usePublicData";
import { usePageMeta } from "@/hooks/usePageMeta";
import { HOTEL } from "@shared/hotel-info";
import { useHotelContact } from "@/hooks/usePublicData";
import { Check, Star, MapPin, Clock } from "lucide-react";

const FALLBACK = {
  title: "Our Story",
  subtitle: "A contemporary boutique hotel at Hosa Road Junction, Bengaluru",
  description:
    "YES HOTELS is a contemporary 3-star boutique hotel on Hosur Road, right at Hosa Road Junction in the Begur / Electronic City corridor. We built it for travellers who want a spotless, comfortable room, a team that genuinely helps, and a fair price.\n\nOur rooms are air-conditioned, with plush beds, a work desk, a flat-screen TV, tea and coffee, and free high-speed Wi-Fi. Our front desk is open 24 hours, parking is free, and Hosa Road Metro Station is a short walk away. Whether you are here for work, family or a quick overnight stop, we make your stay easy.",
  images: ["/gallery/hotel-11.jpg", "/gallery/hotel-24.jpg"],
};

export default function AboutPage() {
  usePageMeta("About Us", "YES HOTELS — a contemporary boutique hotel at Hosa Road Junction, Electronic City, Bengaluru. Clean rooms, 24-hour front desk, free Wi-Fi and parking.");
  const { data } = useContent("about");
  const content = data ?? FALLBACK;
  const contact = useHotelContact();
  const [heroImage, lobbyImage] = content.images?.length ? content.images : FALLBACK.images;
  const paragraphs = (content.description ?? FALLBACK.description).split("\n\n");

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <Navbar transparent={false} />

      {/* Hero */}
      <div className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Reception and lobby at YES HOTELS" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-hotel-black/40" />
        </div>
        <div className="relative z-10 text-center px-6">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl text-hotel-white mb-6">{content.title ?? FALLBACK.title}</h1>
          <p className="text-hotel-white/80 tracking-widest uppercase text-sm max-w-md mx-auto">
            {content.subtitle ?? FALLBACK.subtitle}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-hotel-black mb-8 leading-tight">
          {content.metadata?.tagline ?? "Clean, comfortable and easy to reach."}
        </h2>
        {paragraphs.map((p: string, i: number) => (
          <p key={i} className="text-hotel-black/60 leading-relaxed mb-6 text-lg">
            {p}
          </p>
        ))}
        {lobbyImage && (
          <img src={lobbyImage} alt="Guest room at YES HOTELS" className="w-full h-[220px] sm:h-[300px] md:h-[400px] object-cover mb-12 mt-6" />
        )}

        {/* What we offer — only what the hotel has */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-14">
          <div>
            <h3 className="font-serif text-2xl text-hotel-black mb-4">In every room</h3>
            <ul className="space-y-2">
              {HOTEL.inRoom.map((a) => <li key={a} className="flex gap-2 text-hotel-black/70"><Check size={16} className="text-hotel-gold mt-1 shrink-0" />{a}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-2xl text-hotel-black mb-4">At the hotel</h3>
            <ul className="space-y-2">
              {HOTEL.property.map((a) => <li key={a} className="flex gap-2 text-hotel-black/70"><Check size={16} className="text-hotel-gold mt-1 shrink-0" />{a}</li>)}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-14 text-hotel-black/70">
          <p className="flex gap-2"><MapPin size={18} className="text-hotel-gold shrink-0 mt-0.5" /><span>{contact.address}<br /><span className="text-sm text-hotel-black/60">{HOTEL.landmark}</span></span></p>
          <p className="flex gap-2"><Clock size={18} className="text-hotel-gold shrink-0 mt-0.5" /><span>Check-in from {contact.checkIn}<br />Check-out {contact.checkOut} · {HOTEL.frontDesk}</span></p>
        </div>

        <Link to="/search" className="block sm:inline-block">
          <GoldButton className="w-full px-6 py-3 text-base sm:w-auto sm:px-10 sm:py-4 sm:text-lg">Book Your Stay</GoldButton>
        </Link>
      </div>
    </div>
  );
}
