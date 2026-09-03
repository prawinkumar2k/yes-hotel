import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { Link } from "react-router-dom";
import { useContent } from "@/hooks/usePublicData";
import { usePageMeta } from "@/hooks/usePageMeta";

const FALLBACK = {
  title: "Our Story",
  subtitle: "Redefining luxury hospitality since 2010.",
  description:
    "At YES Hotels, we believe that true luxury lies in the details. From the moment you step into our grand lobby, you are enveloped in an atmosphere of refined elegance and warm hospitality. Our spaces are crafted with a meticulous attention to design, blending contemporary aesthetics with timeless comfort.\n\nOur mission is to create moments that linger long after checkout. Whether you are here for business, leisure, or a special celebration, our dedicated team is committed to ensuring every aspect of your stay is flawless. We don't just provide rooms; we curate experiences.",
  images: [
    "https://images.unsplash.com/photo-1542314831-c6a4d27df08f?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c0d129df?auto=format&fit=crop&q=80",
  ],
};

export default function AboutPage() {
  usePageMeta("About Us", "Discover the story behind YES Hotels and our commitment to refined, warm hospitality.");
  const { data } = useContent("about");
  const content = data ?? FALLBACK;
  const [heroImage, lobbyImage] = content.images?.length ? content.images : FALLBACK.images;
  const paragraphs = (content.description ?? FALLBACK.description).split("\n\n");

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <Navbar transparent={false} />

      {/* Hero */}
      <div className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Hotel exterior" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-hotel-black/40" />
        </div>
        <div className="relative z-10 text-center px-6">
          <h1 className="font-serif text-5xl md:text-7xl text-hotel-white mb-6">{content.title ?? FALLBACK.title}</h1>
          <p className="text-hotel-white/80 tracking-widest uppercase text-sm max-w-md mx-auto">
            {content.subtitle ?? FALLBACK.subtitle}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-hotel-black mb-8 leading-tight">
          {content.metadata?.tagline ?? "A sanctuary of elegance designed for the modern traveler."}
        </h2>
        {paragraphs.map((p: string, i: number) => (
          <p key={i} className="text-hotel-black/60 leading-relaxed mb-6 text-lg">
            {p}
          </p>
        ))}
        {lobbyImage && (
          <img src={lobbyImage} alt="Lobby" className="w-full h-[400px] object-cover mb-12 mt-6" />
        )}

        <Link to="/search" className="block sm:inline-block">
          <GoldButton className="w-full px-6 py-3 text-base sm:w-auto sm:px-10 sm:py-4 sm:text-lg">Experience YES Hotels</GoldButton>
        </Link>
      </div>
    </div>
  );
}
