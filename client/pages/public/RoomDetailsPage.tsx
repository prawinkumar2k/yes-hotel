import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { Users, Bed, Wind, CheckCircle2, Wifi, Tv, Coffee } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

// Code-split: three.js + fiber + drei add real weight to the bundle, and a
// 3D scene is only relevant on this one page — no reason for every other
// route's initial load to pay for it.
const RoomShowcase3D = lazy(() => import("@/components/hotel/RoomShowcase3D"));

export default function RoomDetailsPage() {
  const { slug } = useParams();

  const { data: category, isLoading } = useQuery({
    queryKey: ["roomCategory", slug],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/categories/${slug}`);
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: !!slug,
  });

  usePageMeta(category?.name || "Room Details", category?.shortDescription || category?.description);

  if (isLoading) return <div className="min-h-screen pt-24 bg-hotel-ivory text-center">Loading...</div>;
  if (!category) return <div className="min-h-screen pt-24 bg-hotel-ivory text-center">Room category not found.</div>;

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <Navbar transparent={false} />
      
      {/* Hero Image */}
      <div className="relative h-[70vh]">
        <img src={category.images?.[0] || "/placeholder.svg"}
          alt={category.name} 
          className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-hotel-black/80 to-transparent flex flex-col justify-end p-12 text-hotel-white">
          <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
              <span className="text-xs tracking-[0.2em] uppercase text-hotel-gold font-semibold mb-3 block">Premium Accommodation</span>
              <h1 className="font-serif text-5xl md:text-7xl">{category.name}</h1>
            </div>
            <div className="text-right">
              <p className="text-hotel-white/60 uppercase tracking-widest text-xs mb-1">From</p>
              <p className="font-serif text-4xl text-hotel-gold">₹{category.basePrice}</p>
              <p className="text-hotel-white/60 uppercase tracking-widest text-[10px]">Per Night</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <h2 className="font-serif text-3xl text-hotel-black mb-6">Overview</h2>
              <p className="text-hotel-black/70 leading-relaxed text-lg">{category.description}</p>
            </div>
            
            <div>
              <h2 className="font-serif text-2xl text-hotel-black mb-6">Room Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8 border-y border-hotel-black/10">
                <div className="flex flex-col items-center justify-center text-center gap-3">
                  <Users size={24} className="text-hotel-gold"/>
                  <span className="text-xs uppercase tracking-widest text-hotel-black/60">Up to {category.capacity.adults} Guests</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center gap-3">
                  <span className="w-6 h-6 border border-hotel-gold flex items-center justify-center text-[10px] rounded">m²</span>
                  <span className="text-xs uppercase tracking-widest text-hotel-black/60">{category.size} sq.ft</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center gap-3">
                  <Bed size={24} className="text-hotel-gold"/>
                  <span className="text-xs uppercase tracking-widest text-hotel-black/60">{category.bedType || 'King Bed'}</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center gap-3">
                  <Wind size={24} className="text-hotel-gold"/>
                  <span className="text-xs uppercase tracking-widest text-hotel-black/60">Climate Control</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-hotel-black mb-6">Explore in 3D</h2>
              <Suspense
                fallback={
                  <div className="flex aspect-[16/10] w-full items-center justify-center border border-hotel-black/10 bg-hotel-ivory text-sm text-hotel-black/40">
                    Loading 3D preview…
                  </div>
                }
              >
                <RoomShowcase3D />
              </Suspense>
            </div>

            <div>
              <h2 className="font-serif text-2xl text-hotel-black mb-6">Amenities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Free High-Speed Wi-Fi", "55-inch Smart TV", "Mini Bar", "Premium Toiletries", 
                  "In-room Safe", "24/7 Room Service", "Coffee/Tea Maker", "Work Desk"
                ].map(item => (
                  <div key={item} className="flex items-center gap-3 text-hotel-black/70">
                    <CheckCircle2 size={16} className="text-hotel-gold" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-hotel-white border border-hotel-black/10 p-8 sticky top-32 shadow-sm">
              <h3 className="font-serif text-2xl text-hotel-black mb-6">Reserve this room</h3>
              <p className="text-sm text-hotel-black/60 mb-8">
                Check availability for your dates and secure your stay.
              </p>
              <Link to="/search">
                <GoldButton className="w-full py-4 text-lg">Check Availability</GoldButton>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
