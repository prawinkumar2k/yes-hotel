import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/hotel/Navbar";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useHotelContact } from "@/hooks/usePublicData";

/** Hub page: every area we serve, with distance and travel time, linking to each area page. */
export default function AreasPage() {
  usePageMeta("Hotels near Hosa Road Metro, Electronic City & South Bengaluru", "YES HOTELS at Hosa Road Junction: distances and travel times to Hosa Road Metro, Electronic City, Bommasandra, Narayana Health City, Bommanahalli, Singasandra, Kudlu Gate, Begur and Hebbagodi.");
  const contact = useHotelContact();
  const { data: pages = [] } = useQuery({
    queryKey: ["seo-pages"],
    queryFn: async () => (await (await fetch("/api/seo/pages")).json()).data as any[],
    staleTime: 5 * 60 * 1000,
  });
  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-serif text-4xl text-hotel-black mb-4 text-center">Where to stay near Hosa Road Metro and South Bengaluru</h1>
        <p className="text-center text-hotel-black/70 mb-10">YES HOTELS is at Hosa Road Junction, Hosur Main Road. Choose your destination to see the distance and how to get here. Call {contact.phone} to book.</p>
        <ul className="grid sm:grid-cols-2 gap-4">
          {pages.map((p) => (
            <li key={p.slug}>
              <Link to={`/hotels-near/${p.slug}`} className="block h-full rounded-xl border border-hotel-black/10 bg-white p-5 hover:border-hotel-gold transition">
                <span className="block font-serif text-xl text-hotel-black">{p.destinationName}</span>
                {typeof p.distanceKm === "number" && <span className="block text-sm text-hotel-black/60 mt-1">{p.distanceKm === 0 ? "At the hotel" : `${p.distanceKm} km`}</span>}
                <span className="block text-sm text-hotel-black/70 mt-2">{p.h1}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
